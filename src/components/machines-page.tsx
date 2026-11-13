

'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Machine, MaintenanceLog, FuelLog, Site, acquisitionTypes, AcquisitionType, maintenanceCostAllocations, MaintenanceCostAllocation, fuelTypes, FuelType, purchaseTypes, PurchaseType, EmiPayment, RentalPayment, MachineAttendance, machineAttendanceStatuses, MachineAttendanceStatus, Document, Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Construction, Edit, Trash2, Wrench, Truck, AlertCircle, Fuel, CreditCard, Download, IndianRupee, ChevronLeft, ChevronRight, Check, X, Minus, Loader2, FileText, View, Tractor } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Separator } from './ui/separator';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { onGlobalCollectionSnapshot, addDocToGlobalCollection, updateDocWithId, softDeleteDocWithId, addMaintenanceLogDb, addDocWithSiteId, getSubCollection, generateEmiSchedule, markEmiAsPaid, getEmiPaymentsForMachine, markMachineAttendance, assignRentedMachineToSite, addDocumentDb, deleteDocumentDb } from '@/context/site-context';
import { useSite } from '@/context/site-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { collection, doc, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, isPast, differenceInDays, eachDayOfInterval, startOfMonth, endOfMonth, getDaysInMonth, getDate, isAfter, isBefore, isSameMonth } from 'date-fns';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import type jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { AddRentalPaymentDialog } from './add-rental-payment-dialog';
import { Label } from './ui/label';
import { useAuth } from '@/context/auth-context';


const maintenanceFormSchema = z.object({
  machineId: z.string(),
  task: z.string().min(5, 'Task description is too short'),
  details: z.string().optional(),
  scheduledDate: z.string().min(1, 'Date is required'),
  kmDriven: z.coerce.number().optional(),
  nextServiceKm: z.coerce.number().optional(),
  cost: z.coerce.number().optional(),
  costAllocation: z.enum(maintenanceCostAllocations).optional(),
});

const fuelFormSchema = z.object({
  vehicleName: z.string().min(1, "Vehicle name is required."),
  fuelType: z.enum(fuelTypes, { required_error: "Fuel type is required." }),
  quantity: z.coerce.number().positive("Quantity must be positive."),
  cost: z.coerce.number().positive("Cost must be positive."),
  date: z.string().min(1, "Date is required."),
});

const MAX_FILE_SIZE = 5000000; // 5MB
const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
const documentFormSchema = z.object({
  name: z.string().min(3, 'Document name is too short'),
  expiryDate: z.string().optional(),
  file: z.any()
    .refine((files) => files?.length > 0, 'File is required.')
    .refine((files) => files?.[0]?.size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => ACCEPTED_MIME_TYPES.includes(files?.[0]?.type),
      ".jpg, .jpeg, .png, and .pdf files are accepted."
    ),
});

interface MachinesPageProps {
    companyId: string | null | undefined;
}

export function MachinesPage({ companyId }: MachinesPageProps) {
  const { sites } = useSite();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [emiPayments, setEmiPayments] = useState<EmiPayment[]>([]);
  const [rentalPayments, setRentalPayments] = useState<RentalPayment[]>([]);
  const [machineAttendances, setMachineAttendances] = useState<MachineAttendance[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allSiteNames, setAllSiteNames] = useState<string[]>([]);
  const [allCompanies, setAllCompanies] = useState<Company[]>([]);

  const [isMachineFormOpen, setIsMachineFormOpen] = useState(false);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [isFuelDialogOpen, setIsFuelDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isRentalPaymentDialogOpen, setIsRentalPaymentDialogOpen] = useState(false);
  const [isDocumentDialogOpen, setIsDocumentDialogOpen] = useState(false);
  const [isDocumentDeleteOpen, setIsDocumentDeleteOpen] = useState(false);
  const [isSummaryViewOpen, setIsSummaryViewOpen] = useState(false);
  const [expandedEmiSchedules, setExpandedEmiSchedules] = useState<{ [key: string]: boolean }>({});
  
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);


  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthView, setMonthView] = useState<'firstHalf' | 'secondHalf'>('firstHalf');

  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  // Only this user's company is needed (for the PDF header); reading all companies is blocked by the security rules.
  useEffect(() => {
    if (!userProfile?.companyId) return;
    const unsub = onSnapshot(doc(db, 'companies', userProfile.companyId), (snap) => {
        setAllCompanies(snap.exists() ? [{ id: snap.id, ...snap.data() } as Company] : []);
    });
    return () => unsub();
  }, [userProfile?.companyId]);
  
  const currentCompany = allCompanies.find(c => c.id === userProfile?.companyId);

  useEffect(() => {
    setAllSiteNames(sites.map(s => s.name.toLowerCase()));
  }, [sites]);
  
  const machineFormSchema = z.object({
    name: z.string().min(2, 'Name is too short')
        .refine(name => !allSiteNames.includes(name.toLowerCase()), {
            message: 'This name is already in use by a site.'
        })
        .refine(name => {
          const lowerCaseName = name.toLowerCase();
          const allMachineNames = machines.map(m => m.name.toLowerCase());
          if (selectedMachine) {
            return lowerCaseName === selectedMachine.name.toLowerCase() || !allMachineNames.includes(lowerCaseName);
          }
          return !allMachineNames.includes(lowerCaseName);
        }, {
            message: 'This machine name is already in use.'
        }),
    vehicleNumber: z.string().min(2, 'Vehicle number is too short'),
    acquisition: z.enum(acquisitionTypes, { required_error: "Please select an acquisition type." }),
    date: z.string().min(1, 'Date is required'),
    dailyRentalPrice: z.coerce.number().optional(),
    purchaseType: z.enum(purchaseTypes).optional(),
    purchasePrice: z.coerce.number().optional(),
    interestRate: z.coerce.number().optional(),
    loanTenureYears: z.coerce.number().optional(),
  });


  useEffect(() => {
    if (!companyId) {
        setMachines([]);
        setMaintenanceLogs([]);
        setFuelLogs([]);
        setEmiPayments([]);
        setRentalPayments([]);
        setMachineAttendances([]);
        setDocuments([]);
        return;
    };

    const unsubscribes = [
      onGlobalCollectionSnapshot<Machine>('machines', companyId, setMachines),
      onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, setMaintenanceLogs),
      onGlobalCollectionSnapshot<FuelLog>('fuel_logs', companyId, setFuelLogs),
      onGlobalCollectionSnapshot<RentalPayment>('rental_payments', companyId, setRentalPayments),
      onGlobalCollectionSnapshot<MachineAttendance>('machine_attendances', companyId, setMachineAttendances),
      onGlobalCollectionSnapshot<Document>('documents', companyId, (docs) => setDocuments(docs.filter(d => d.machineId))),
    ];

    const q = query(collection(db, 'emi_payments'), where('companyId', '==', companyId));
    const unsubEmi = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmiPayment));
        const sortedData = data.sort((a,b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        setEmiPayments(sortedData.filter(p => !p.isDeleted));
    });
    unsubscribes.push(unsubEmi);
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    }
  }, [companyId]);

  const machineForm = useForm<z.infer<typeof machineFormSchema>>({
    resolver: zodResolver(machineFormSchema),
  });
  
  const maintenanceForm = useForm<z.infer<typeof maintenanceFormSchema>>({
    resolver: zodResolver(maintenanceFormSchema),
  });

  const fuelForm = useForm<z.infer<typeof fuelFormSchema>>({
    resolver: zodResolver(fuelFormSchema),
  });

   const assignFormSchema = z.object({
    siteId: z.string().min(1, 'Please select a site.'),
    assignmentDate: z.string().min(1, 'Please select a date.'),
  });
  
   const assignForm = useForm<z.infer<typeof assignFormSchema>>({
    resolver: zodResolver(assignFormSchema),
    defaultValues: {
      siteId: undefined,
      assignmentDate: new Date().toISOString().split('T')[0],
    },
  });
  
  const documentForm = useForm<z.infer<typeof documentFormSchema>>({
    resolver: zodResolver(documentFormSchema),
  });

  const acquisitionType = machineForm.watch('acquisition');
  const purchaseType = machineForm.watch('purchaseType');

  useEffect(() => {
    if (selectedMachine) {
      machineForm.reset({
        name: selectedMachine.name || '',
        vehicleNumber: selectedMachine.vehicleNumber || '',
        acquisition: selectedMachine.acquisition,
        date: selectedMachine.date,
        dailyRentalPrice: selectedMachine.dailyRentalPrice || 0,
        purchaseType: selectedMachine.purchaseType,
        purchasePrice: selectedMachine.purchasePrice || 0,
        interestRate: selectedMachine.interestRate || 0,
        loanTenureYears: selectedMachine.loanTenureYears || 0,
      });
    } else {
      machineForm.reset({
        name: '',
        vehicleNumber: '',
        acquisition: undefined,
        date: new Date().toISOString().split('T')[0],
        dailyRentalPrice: 0,
        purchaseType: undefined,
        purchasePrice: 0,
        interestRate: 0,
        loanTenureYears: 0,
      });
    }
  }, [selectedMachine, machineForm]);

  const handleOpenMachineForm = (machine: Machine | null = null) => {
    setSelectedMachine(machine);
    setIsMachineFormOpen(true);
  };
  
  const handleOpenMaintenanceDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    const lastLog = maintenanceLogs
        .filter(log => log.machineId === machine.id)
        .sort((a,b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime())[0];
        
    maintenanceForm.reset({
        machineId: machine.id,
        task: '',
        details: '',
        scheduledDate: new Date().toISOString().split('T')[0],
        cost: 0,
        kmDriven: lastLog?.nextServiceKm || 0,
        nextServiceKm: 0,
        costAllocation: 'General Expenses',
    });
    setIsMaintenanceDialogOpen(true);
  };

  const handleOpenFuelDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    fuelForm.reset({
      vehicleName: machine.name,
      fuelType: undefined,
      quantity: 0,
      cost: 0,
      date: new Date().toISOString().split('T')[0],
    });
    setIsFuelDialogOpen(true);
  };
  
  const handleOpenAssignDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    assignForm.reset({
      siteId: machine.assignedSiteId || undefined,
      assignmentDate: machine.assignmentDate || new Date().toISOString().split('T')[0],
    });
    setIsAssignDialogOpen(true);
  };

  const handleOpenRentalPaymentDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    setIsRentalPaymentDialogOpen(true);
  };
  
  const handleOpenDocumentDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    documentForm.reset({ name: '', file: undefined });
    setIsDocumentDialogOpen(true);
  };

  const handleOpenDocumentDeleteDialog = (doc: Document) => {
    setSelectedDocument(doc);
    setIsDocumentDeleteOpen(true);
  };
  
  const handleDeleteDialog = (machine: Machine) => {
    setSelectedMachine(machine);
    setIsDeleteDialogOpen(true);
  };

  const handleOpenSummaryView = (doc: Document) => {
    setSelectedDocument(doc);
    setIsSummaryViewOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if(selectedMachine) {
      await softDeleteDocWithId('machines', selectedMachine.id);
      toast({ title: "Machine Deleted", description: `"${selectedMachine.name}" has been deleted.` });
    }
    setIsDeleteDialogOpen(false);
    setSelectedMachine(null);
  };

  const handleDeleteDocumentConfirm = async () => {
    if (!selectedDocument) return;
    try {
      await deleteDocumentDb(selectedDocument);
      toast({ title: "Document Deleted", description: `"${selectedDocument.name}" has been deleted.` });
      setIsDocumentDeleteOpen(false);
      setSelectedDocument(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not delete the document." });
    }
  };


  const calculateEMI = (principal: number, rate: number, tenure: number) => {
    if (principal <= 0 || rate <= 0 || tenure <= 0) return 0;
    const monthlyRate = rate / 12 / 100;
    const numberOfMonths = tenure * 12;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfMonths)) / (Math.pow(1 + monthlyRate, numberOfMonths) - 1);
    return emi;
  };

  const onMachineSubmit = async (values: z.infer<typeof machineFormSchema>) => {
    if (!companyId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot add machine without a company context.' });
        return;
    }
    setIsSubmitting(true);
    try {
        let machineId: string;
        const machineData: Partial<Omit<Machine, 'id' | 'isDeleted' | 'assignmentDate'>> = {
            name: values.name,
            vehicleNumber: values.vehicleNumber,
            acquisition: values.acquisition,
            date: values.date,
        };

        if (values.acquisition === 'Rented') {
            machineData.dailyRentalPrice = values.dailyRentalPrice;
        } else if (values.acquisition === 'Company-Owned') {
            machineData.purchaseType = values.purchaseType;
            machineData.purchasePrice = values.purchasePrice;
            if (values.purchaseType === 'Loan') {
                machineData.interestRate = values.interestRate;
                machineData.loanTenureYears = values.loanTenureYears;
            }
        }
        
        const finalMachineData = Object.fromEntries(
            Object.entries(machineData).filter(([, value]) => value !== undefined && value !== null && value !== '')
        );


        if (selectedMachine) {
            machineId = selectedMachine.id;
            await updateDocWithId('machines', machineId, finalMachineData);
            toast({ title: 'Machine Updated', description: `"${values.name}" has been updated.` });
        } else {
            const newDoc = await addDocToGlobalCollection('machines', companyId, finalMachineData);
            machineId = newDoc.id;
            toast({ title: 'Machine Logged', description: `"${values.name}" has been logged.` });
        }

        if (
            values.acquisition === 'Company-Owned' &&
            values.purchaseType === 'Loan' &&
            values.purchasePrice &&
            values.interestRate &&
            values.loanTenureYears
        ) {
            const emiAmount = calculateEMI(values.purchasePrice, values.interestRate, values.loanTenureYears);
            await generateEmiSchedule(companyId, machineId, values.date, values.loanTenureYears, emiAmount);
            toast({ title: 'EMI Schedule Generated', description: 'EMI payment schedule has been created.' });
        }

        setIsMachineFormOpen(false);
        setSelectedMachine(null);
        machineForm.reset();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save machine log.' });
    } finally {
      setIsSubmitting(false);
    }
};

  const onMaintenanceSubmit = async (values: z.infer<typeof maintenanceFormSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
      await addMaintenanceLogDb(companyId, values.machineId, values);
      toast({ title: "Maintenance Log Added", description: `Task "${values.task}" has been logged.` });
  
      maintenanceForm.reset();
      setIsMaintenanceDialogOpen(false);
      setSelectedMachine(null);
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to log maintenance task.'})
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const onFuelSubmit = async (values: z.infer<typeof fuelFormSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
      const machine = machines.find(m => m.name === values.vehicleName);
      const siteId = machine?.assignedSiteId || null;
      
      await addDocToGlobalCollection('fuel_logs', companyId, { ...values, siteId });
      toast({ title: "Fuel Log Added", description: `Fuel entry for ${values.vehicleName} has been logged.` });
      
      fuelForm.reset();
      setIsFuelDialogOpen(false);
      setSelectedMachine(null);
    } catch(e) {
      console.error(e)
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to log fuel entry.'})
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDocumentSubmit = async (values: z.infer<typeof documentFormSchema>) => {
    if (!companyId || !selectedMachine) return;
    const file = values.file[0];
    if (!file) return;

    setIsSubmitting(true);
    setIsExtracting(true);
    try {
      await addDocumentDb(
          companyId, 
          'main', 
          { name: values.name, file, expiryDate: values.expiryDate }, 
          () => setIsExtracting(false),
          selectedMachine.id
      );
      toast({ title: "Document Uploaded", description: `"${values.name}" has been uploaded. AI analysis is in progress.` });
      documentForm.reset();
      setIsDocumentDialogOpen(false);
    } catch(error) {
        console.error("Upload error:", error)
        toast({ variant: 'destructive', title: "Upload Failed", description: "Could not upload the selected file." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignSite = async (values: z.infer<typeof assignFormSchema>) => {
    if (!selectedMachine) return;
    setIsSubmitting(true);
    try {
        await assignRentedMachineToSite(selectedMachine, values.siteId, values.assignmentDate);
        toast({ title: "Machine Assigned", description: `${selectedMachine.name} assignment has been updated.`});
      
      setIsAssignDialogOpen(false);
      setSelectedMachine(null);
    } catch(e) {
        console.error("Assignment error:", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to assign machine.'});
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkEmiAsPaid = async (paymentId: string) => {
    try {
      await markEmiAsPaid(paymentId);
      toast({ title: 'Payment Marked', description: 'EMI payment has been marked as paid.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to mark payment.' });
    }
  };

  const getSiteName = (siteId: string) => {
    return sites.find(s => s.id === siteId)?.name || 'Unknown Site';
  }

  const getEmiStatusVariant = (status: EmiPayment['status']) => {
    switch (status) {
      case 'Paid': return 'default';
      case 'Upcoming': return 'secondary';
      case 'Overdue': return 'destructive';
      default: return 'outline';
    }
  };
  
  const handleExportEmiPdf = async (machine: Machine, payments: EmiPayment[]) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`EMI Schedule for ${machine.name}`, 14, 22);
    doc.setFontSize(12);
    doc.text(`Vehicle Number: ${machine.vehicleNumber}`, 14, 30);

    const tableColumn = ["Due Date", "Amount", "Status", "Payment Date"];
    const tableRows: (string | number)[][] = [];

    payments.forEach(payment => {
        const paymentData = [
            format(new Date(payment.dueDate), 'PPP'),
            `₹${payment.amount.toLocaleString()}`,
            payment.status,
            payment.paymentDate ? format(new Date(payment.paymentDate), 'PPP') : 'N/A'
        ];
        tableRows.push(paymentData);
    });

    autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 35,
    });

    doc.save(`emi-schedule-${machine.name.replace(/\s+/g, '-')}.pdf`);
    toast({ title: "PDF Exported", description: "EMI schedule has been downloaded."});
  };

  const toggleEmiScheduleView = (machineId: string) => {
    setExpandedEmiSchedules(prev => ({ ...prev, [machineId]: !prev[machineId] }));
  };
  
  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newMonth);
  };
  
  const getAttendanceIcon = (status: MachineAttendanceStatus) => {
    switch (status) {
      case 'Present':
        return <Check className="h-5 w-5 text-green-600 mx-auto" />;
      case 'Unmarked':
        return <Check className="h-5 w-5 text-gray-400 mx-auto" />;
      case 'Absent':
        return <X className="h-5 w-5 text-red-600 mx-auto" />;
      case 'Half-day':
        return <Minus className="h-5 w-5 text-yellow-600 mx-auto" />;
      default:
        return null;
    }
  };

  const rentSummaries = useMemo(() => {
    const summaryMap: { [machineId: string]: { totalRentDue: number; daysUsed: number } } = {};
    
    machines.forEach(machine => {
        if (machine.acquisition !== 'Rented' || !machine.dailyRentalPrice || !machine.assignmentDate) {
            summaryMap[machine.id] = { totalRentDue: 0, daysUsed: 0 };
            return;
        }

        const today = new Date();
        const startDate = new Date(machine.assignmentDate);
        let totalRentDue = 0;
        let daysUsed = 0;

        if (!isAfter(startDate, today)) {
            const rentalPeriod = eachDayOfInterval({ start: startDate, end: today });
            const machineAttendanceForMachine = machineAttendances.filter(a => a.machineId === machine.id);

            rentalPeriod.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const attendance = machineAttendanceForMachine.find(a => a.date === dateStr);
                const status = attendance?.status || 'Unmarked';

                if (status === 'Present' || status === 'Unmarked') {
                    totalRentDue += machine.dailyRentalPrice!;
                    daysUsed += 1;
                } else if (status === 'Half-day') {
                    totalRentDue += machine.dailyRentalPrice! / 2;
                }
            });
        }
        summaryMap[machine.id] = { totalRentDue, daysUsed };
    });
    return summaryMap;
  }, [machines, machineAttendances]);
  
  const monthlyReports = useMemo(() => {
      const reports: { [machineId: string]: { days: Date[]; attendance: { [date: string]: MachineAttendanceStatus } } } = {};
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      let daysInMonth = eachDayOfInterval({ start, end });
      
      if (monthView === 'firstHalf') {
          daysInMonth = daysInMonth.slice(0, 15);
      } else {
          daysInMonth = daysInMonth.slice(15);
      }

      machines.forEach(machine => {
        const machineAttendanceForMachine = machineAttendances.filter(a => a.machineId === machine.id);
        const attendanceByDate: { [date: string]: MachineAttendanceStatus } = {};
        const rentalStartDate = machine.assignmentDate ? new Date(machine.assignmentDate) : new Date(machine.date);

        daysInMonth.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
             if (isBefore(day, rentalStartDate) && format(day, 'yyyy-MM-dd') !== format(rentalStartDate, 'yyyy-MM-dd')) {
                attendanceByDate[dateStr] = 'Absent';
            } else {
                const attendance = machineAttendanceForMachine.find(a => a.date === dateStr);
                attendanceByDate[dateStr] = attendance?.status || 'Unmarked';
            }
        });
        reports[machine.id] = { days: daysInMonth, attendance: attendanceByDate };
      });

      return reports;
  }, [currentMonth, machines, machineAttendances, monthView]);

  const handleExportRentalPdf = async (machine: Machine, rentSummary: { totalRentDue: number; daysUsed: number }, payments: RentalPayment[], monthlyReport: { days: Date[]; attendance: { [date: string]: MachineAttendanceStatus } }) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const today = new Date();
    let yPos = 20;

    // Header
    doc.setFontSize(22);
    doc.text(currentCompany?.name || 'MANGEMENT', 14, yPos);
    yPos += 10;
    doc.setFontSize(16);
    doc.text('Machine Rental Report', 14, yPos);
    yPos += 10;

    // Report Details
    doc.setFontSize(12);
    doc.text(`Report Date: ${format(today, 'PPP')}`, 14, yPos);
    doc.text(`Machine: ${machine.name} (${machine.vehicleNumber})`, 105, yPos, { align: 'center' });
    yPos += 6;
    doc.text(`Rental Period: ${format(new Date(machine.assignmentDate || machine.date), 'PPP')} to ${format(today, 'PPP')}`, 14, yPos);
    yPos += 10;

    autoTable(doc, {
        body: [
            ['Daily Rate', `₹${(machine.dailyRentalPrice || 0).toLocaleString()}`],
            ['Total Days Used', `${rentSummary.daysUsed}`],
            ['Total Rent Due', `₹${rentSummary.totalRentDue.toLocaleString()}`],
            ['Total Paid', `₹${payments.reduce((acc, p) => acc + p.amount, 0).toLocaleString()}`],
            ['Balance Due', `₹${(rentSummary.totalRentDue - payments.reduce((acc, p) => acc + p.amount, 0)).toLocaleString()}`],
        ],
        startY: yPos,
        theme: 'plain',
        styles: { fontSize: 12 },
        bodyStyles: { fontStyle: 'bold' },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Payments Table
    if (payments.length > 0) {
        doc.setFontSize(14);
        doc.text('Payment Log', 14, yPos);
        yPos += 7;
        autoTable(doc, {
            head: [['Date', 'Amount Paid', 'Notes']],
            body: payments.map(p => [
                format(new Date(p.date), 'PPP'),
                `₹${p.amount.toLocaleString()}`,
                p.notes || ''
            ]),
            startY: yPos,
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
    }
    
    // Usage Table
    doc.setFontSize(14);
    doc.text(`Daily Usage Log - ${format(currentMonth, 'MMMM yyyy')}`, 14, yPos);
    yPos += 7;
    autoTable(doc, {
        head: [['Date', 'Status']],
        body: monthlyReport.days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const status = monthlyReport.attendance[dateStr];
            return [dateStr, status];
        }),
        startY: yPos,
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;

    // Footer
    doc.setFontSize(10);
    doc.text('This is an auto-generated report from MANGEMENT.', 105, yPos, { align: 'center' });

    doc.save(`rental-report-${machine.name.replace(/\s+/g, '-')}-${format(today, 'yyyy-MM-dd')}.pdf`);
    toast({ title: "PDF Report Generated", description: "The rental report has been downloaded." });
  };


  if (!companyId) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Tractor /> Global Machine Management</CardTitle>
                <CardDescription>Select a company to view and manage machines.</CardDescription>
            </CardHeader>
        </Card>
    );
  }


  return (
    <div className="space-y-6">
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
            <CardTitle className="flex items-center gap-2"><Tractor /> Global Machine Management</CardTitle>
            <CardDescription>Track all company-owned and rented machines across all sites.</CardDescription>
            </div>
            {userProfile && (
              <Button onClick={() => handleOpenMachineForm()}>
                  <Plus className="mr-2 h-4 w-4" /> Add Machine
              </Button>
            )}
        </CardHeader>
        <CardContent>
            {isMachineFormOpen && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>{selectedMachine ? 'Edit' : 'Add New'} Machine</CardTitle>
                        <CardDescription>Fill in the details of the machine.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...machineForm}>
                            <form onSubmit={machineForm.handleSubmit(onMachineSubmit)} className="space-y-4">
                            <fieldset disabled={isSubmitting} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={machineForm.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Machine Name/Identifier</FormLabel>
                                    <FormControl><Input placeholder="e.g., Excavator EX-01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )} />
                                <FormField control={machineForm.control} name="vehicleNumber" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Vehicle Number</FormLabel>
                                    <FormControl><Input placeholder="e.g., MH12AB1234" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )} />
                                <FormField control={machineForm.control} name="acquisition" render={({ field }) => (
                                <FormItem><FormLabel>Acquisition Type</FormLabel>
                                <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    machineForm.setValue('purchaseType', undefined);
                                }} value={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Choose an option"/></SelectTrigger></FormControl>
                                    <SelectContent>
                                    {acquisitionTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                                    </SelectContent>
                                </Select><FormMessage /></FormItem>
                                )} />
                                <FormField control={machineForm.control} name="date" render={({ field }) => (
                                <FormItem><FormLabel>Acquisition Date</FormLabel>
                                <FormControl><Input type="date" {...field} /></FormControl>
                                <FormMessage /></FormItem>
                                )} />

                                {acquisitionType === 'Rented' && (
                                <>
                                    <FormField control={machineForm.control} name="dailyRentalPrice" render={({ field }) => (
                                    <FormItem className="md:col-span-2">
                                        <FormLabel>Daily Rental Price (₹)</FormLabel>
                                        <FormControl><Input type="number" placeholder="e.g., 2000" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )} />
                                </>
                                )}
                                {acquisitionType === 'Company-Owned' && (
                                <>
                                    <FormField
                                        control={machineForm.control}
                                        name="purchaseType"
                                        render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>Purchase Method</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                className="flex gap-4"
                                                >
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl>
                                                    <RadioGroupItem value="Cash" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">Cash</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl>
                                                    <RadioGroupItem value="Loan" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">Loan</FormLabel>
                                                </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    
                                    {purchaseType && (
                                        <FormField control={machineForm.control} name="purchasePrice" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Total Purchase Price (₹)</FormLabel>
                                                <FormControl><Input type="number" placeholder="e.g., 500000" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )} />
                                    )}

                                    {purchaseType === 'Loan' && (
                                        <>
                                            <FormField control={machineForm.control} name="interestRate" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Annual Interest Rate (%)</FormLabel>
                                                <FormControl><Input type="number" placeholder="e.g., 8.5" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )} />
                                            <FormField control={machineForm.control} name="loanTenureYears" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Loan Tenure (Years)</FormLabel>
                                                <FormControl><Input type="number" placeholder="e.g., 5" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                            )} />
                                        </>
                                    )}
                                </>
                                )}
                            </fieldset>
                            <CardFooter className="px-0 pt-4 justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => {setIsMachineFormOpen(false); setSelectedMachine(null)}} disabled={isSubmitting}>Cancel</Button>
                                <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {selectedMachine ? 'Save Changes' : 'Add Machine'}
                                </Button>
                            </CardFooter>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            )}

            <Accordion type="single" collapsible className="w-full">
                {machines.map(machine => {
                    const machineMaintenanceLogs = maintenanceLogs.filter(log => log.machineId === machine.id);
                    const machineFuelLogs = fuelLogs.filter(log => log.vehicleName === machine.name);
                    const machineRentalPayments = rentalPayments.filter(p => p.machineId === machine.id);
                    const machineDocuments = documents.filter(doc => doc.machineId === machine.id);
                    
                    const totalPaid = machineRentalPayments.reduce((acc, p) => acc + p.amount, 0);
                    
                    const rentSummary = rentSummaries[machine.id] || { totalRentDue: 0, daysUsed: 0 };
                    const monthlyReport = monthlyReports[machine.id];

                    const allMachineEmiPayments = emiPayments
                      .filter(p => p.machineId === machine.id);
                    
                    const isExpanded = expandedEmiSchedules[machine.id];
                    
                    const nextPaymentIndex = allMachineEmiPayments.findIndex(p => p.status === 'Upcoming' || p.status === 'Overdue');
                    const visibleEmiPayments = isExpanded ? allMachineEmiPayments : allMachineEmiPayments.slice(Math.max(0, nextPaymentIndex - 1), nextPaymentIndex + 2);

                    const lastKm = Math.max(...machineMaintenanceLogs.map(l => l.kmDriven || 0), 0);
                    const nextServiceKm = Math.max(...machineMaintenanceLogs.map(l => l.nextServiceKm || 0), 0);
                    const kmToService = nextServiceKm - lastKm;
                    const rentalStartDate = machine.assignmentDate ? new Date(machine.assignmentDate) : new Date(machine.date);

                    return (
                        <AccordionItem value={machine.id} key={machine.id}>
                            <AccordionTrigger>
                                <div className="flex items-center justify-between w-full pr-4">
                                    <div className='flex items-center gap-4'>
                                        <span className='font-bold text-lg'>{machine.name}</span>
                                        <span className="text-sm text-muted-foreground">{machine.acquisition} {machine.purchaseType && `(${machine.purchaseType})`}</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {machine.assignedSiteId ? (
                                            <Badge variant="secondary" className="flex items-center gap-2">
                                                <Truck className="h-4 w-4" />
                                                On-site: {getSiteName(machine.assignedSiteId)}
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline">Available</Badge>
                                        )}
                                        {nextServiceKm > 0 && kmToService <= 1000 && (
                                            <Badge variant="destructive" className="flex items-center gap-2">
                                                <AlertCircle className="h-4 w-4" />
                                                Service due in {kmToService} km
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-4 bg-muted/50 rounded-md">
                                <div className="space-y-6">
                                    {machine.acquisition === 'Company-Owned' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-4 bg-background">
                                                <h4 className="font-semibold mb-2 flex items-center gap-2"><Wrench /> Maintenance History</h4>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Task</TableHead>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead className="text-right">Cost</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {machineMaintenanceLogs.length > 0 ? (
                                                            machineMaintenanceLogs.map(log => (
                                                                <TableRow key={log.id}>
                                                                    <TableCell>{log.task}</TableCell>
                                                                    <TableCell>{log.scheduledDate}</TableCell>
                                                                    <TableCell className="text-right">₹{log.cost?.toLocaleString() || 'N/A'}</TableCell>
                                                                </TableRow>
                                                            ))
                                                        ) : (
                                                            <TableRow><TableCell colSpan={3} className="text-center h-24">No maintenance history.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            <div className="p-4 bg-background">
                                                <h4 className="font-semibold mb-2 flex items-center gap-2"><Fuel /> Fuel Log</h4>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Quantity (L)</TableHead>
                                                            <TableHead className="text-right">Cost</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {machineFuelLogs.length > 0 ? (
                                                            machineFuelLogs.map(log => (
                                                                <TableRow key={log.id}>
                                                                    <TableCell>{log.date}</TableCell>
                                                                    <TableCell>{log.quantity}</TableCell>
                                                                    <TableCell className="text-right">₹{log.cost.toLocaleString()}</TableCell>
                                                                </TableRow>
                                                            ))
                                                        ) : (
                                                            <TableRow><TableCell colSpan={3} className="text-center h-24">No fuel logs.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            <div className="p-4 bg-background">
                                                <div className="flex items-center justify-between mb-2">
                                                    <h4 className="font-semibold flex items-center gap-2"><FileText /> Documents</h4>
                                                    <Button size="sm" onClick={() => handleOpenDocumentDialog(machine)}>
                                                        <Plus className="mr-2 h-4 w-4" />Upload
                                                    </Button>
                                                </div>
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Name</TableHead>
                                                            <TableHead>Expiry Date</TableHead>
                                                            <TableHead>AI Summary</TableHead>
                                                            <TableHead className="text-right">Actions</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {machineDocuments.length > 0 ? (
                                                            machineDocuments.map(doc => {
                                                                const isExpired = doc.expiryDate && isPast(new Date(doc.expiryDate));
                                                                const expiresSoon = doc.expiryDate && !isExpired && differenceInDays(new Date(doc.expiryDate), new Date()) <= 30;
                                                                return (
                                                                    <TableRow key={doc.id}>
                                                                        <TableCell>{doc.name}</TableCell>
                                                                        <TableCell>
                                                                            {doc.expiryDate ? format(new Date(doc.expiryDate), 'PPP') : 'N/A'}
                                                                            {isExpired && <Badge variant="destructive" className="ml-2">Expired</Badge>}
                                                                            {expiresSoon && <Badge variant="secondary" className="ml-2 bg-orange-400">Expires Soon</Badge>}
                                                                        </TableCell>
                                                                        <TableCell className="max-w-[200px] truncate">
                                                                            {doc.extractedText || 'N/A'}
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            {doc.extractedText && (
                                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenSummaryView(doc)}>
                                                                                <View className="h-4 w-4" />
                                                                            </Button>
                                                                            )}
                                                                            <Button variant="ghost" size="icon" asChild>
                                                                                <a href={doc.url} download={doc.name} target="_blank" rel="noopener noreferrer">
                                                                                    <Download className="h-4 w-4" />
                                                                                </a>
                                                                            </Button>
                                                                            <Button variant="ghost" size="icon" onClick={() => handleOpenDocumentDeleteDialog(doc)}>
                                                                                <Trash2 className="h-4 w-4 text-destructive" />
                                                                            </Button>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })
                                                        ) : (
                                                            <TableRow><TableCell colSpan={4} className="text-center h-24">No documents uploaded.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                    {machine.acquisition === 'Rented' && (
                                        <>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="p-4 bg-background">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="font-semibold flex items-center gap-2"><IndianRupee /> Rental Payments</h4>
                                                        <Button size="sm" onClick={() => handleOpenRentalPaymentDialog(machine)}>
                                                            <Plus className="mr-2 h-4 w-4" />Log Payment
                                                        </Button>
                                                    </div>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Date</TableHead>
                                                                <TableHead className="text-right">Amount Paid</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {machineRentalPayments.length > 0 ? (
                                                                machineRentalPayments.map(log => (
                                                                    <TableRow key={log.id}>
                                                                        <TableCell>{log.date}</TableCell>
                                                                        <TableCell className="text-right">₹{log.amount.toLocaleString()}</TableCell>
                                                                    </TableRow>
                                                                ))
                                                            ) : (
                                                                <TableRow><TableCell colSpan={2} className="text-center h-24">No payments logged.</TableCell></TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                                <div className="p-4 bg-background">
                                                    <h4 className="font-semibold mb-2 flex items-center gap-2"><Fuel /> Fuel Log</h4>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Date</TableHead>
                                                                <TableHead>Quantity (L)</TableHead>
                                                                <TableHead className="text-right">Cost</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {machineFuelLogs.length > 0 ? (
                                                                machineFuelLogs.map(log => (
                                                                    <TableRow key={log.id}>
                                                                        <TableCell>{log.date}</TableCell>
                                                                        <TableCell>{log.quantity}</TableCell>
                                                                        <TableCell className="text-right">₹{log.cost.toLocaleString()}</TableCell>
                                                                </TableRow>
                                                                ))
                                                            ) : (
                                                                <TableRow><TableCell colSpan={3} className="text-center h-24">No fuel logs.</TableCell></TableRow>
                                                            )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            </div>
                                            <Card>
                                                <CardHeader className="p-4 flex flex-row justify-between items-center">
                                                    <CardTitle className="text-base">Rental Payment Summary</CardTitle>
                                                    <Button size="sm" variant="outline" onClick={() => handleExportRentalPdf(machine, rentSummary, machineRentalPayments, monthlyReport)}>
                                                        <Download className="mr-2 h-4 w-4" /> Download Report
                                                    </Button>
                                                </CardHeader>
                                                <CardContent className="p-4 pt-0 text-sm space-y-1">
                                                    <div className="flex justify-between"><span>Daily Rate:</span> <span>₹{(machine.dailyRentalPrice || 0).toLocaleString()}</span></div>
                                                        <div className="flex justify-between"><span>Days Used:</span> <span>{rentSummary.daysUsed}</span></div>
                                                    <Separator className='my-1'/>
                                                    <div className="flex justify-between font-semibold"><span>Total Rent Due:</span> <span>₹{rentSummary.totalRentDue.toLocaleString()}</span></div>
                                                    <div className="flex justify-between text-green-600"><span>Total Paid:</span> <span>₹{totalPaid.toLocaleString()}</span></div>
                                                    <Separator className='my-1'/>
                                                    <div className="flex justify-between font-bold"><span>Balance:</span> <span className={rentSummary.totalRentDue - totalPaid > 0 ? 'text-destructive' : 'text-green-600'}>₹{(rentSummary.totalRentDue - totalPaid).toLocaleString()}</span></div>

                                                </CardContent>
                                            </Card>
                                        </>
                                    )}
                                    {machine.acquisition === 'Rented' && monthlyReport && (
                                        <div className='mt-6'>
                                            <h4 className="font-semibold mb-2">Daily Usage Log</h4>
                                            <div className="flex items-center justify-between gap-4 my-4">
                                                <div className="flex items-center gap-4">
                                                    <Button variant="outline" size="icon" onClick={() => changeMonth(-1)}>
                                                        <ChevronLeft className="h-4 w-4" />
                                                    </Button>
                                                    <span className="text-lg font-semibold w-36 text-center">
                                                        {format(currentMonth, 'MMMM yyyy')}
                                                    </span>
                                                    <Button variant="outline" size="icon" onClick={() => changeMonth(1)}>
                                                        <ChevronRight className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                    <Button 
                                                        variant={monthView === 'firstHalf' ? 'default' : 'outline'}
                                                        onClick={() => setMonthView('firstHalf')}
                                                        size="sm"
                                                    >
                                                        Days 1-15
                                                    </Button>
                                                    <Button 
                                                        variant={monthView === 'secondHalf' ? 'default' : 'outline'}
                                                        onClick={() => setMonthView('secondHalf')}
                                                        size="sm"
                                                    >
                                                        Days 16-{getDaysInMonth(currentMonth)}
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="border rounded-lg overflow-x-auto">
                                                <Table>
                                                    <TableHeader>
                                                    <TableRow>
                                                        {monthlyReport.days.map(day => (
                                                        <TableHead key={day.toISOString()} className="text-center p-2">
                                                            <div className='flex flex-col items-center'>
                                                            <span>{format(day, 'EEE')}</span>
                                                            <span>{getDate(day)}</span>
                                                            </div>
                                                        </TableHead>
                                                        ))}
                                                    </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        <TableRow>
                                                            {monthlyReport.days.map(day => {
                                                                const dateStr = format(day, 'yyyy-MM-dd');
                                                                const status = monthlyReport.attendance[dateStr];
                                                                const isBeforeRental = isBefore(day, rentalStartDate) && format(day, 'yyyy-MM-dd') !== format(rentalStartDate, 'yyyy-MM-dd');

                                                                return (
                                                                    <TableCell key={day.toISOString()} className="text-center p-1">
                                                                        <Select
                                                                            value={status}
                                                                            onValueChange={(newStatus: MachineAttendanceStatus) => companyId && markMachineAttendance(companyId, machine.id, dateStr, newStatus)}
                                                                            disabled={isAfter(day, new Date()) || isBeforeRental}
                                                                        >
                                                                            <SelectTrigger className="w-12 h-12 p-0 justify-center border-0 bg-transparent shadow-none">
                                                                                <SelectValue>
                                                                                    <div className="w-8 h-8 rounded-full flex items-center justify-center">
                                                                                         { !isBeforeRental && getAttendanceIcon(status) }
                                                                                    </div>
                                                                                </SelectValue>
                                                                            </SelectTrigger>
                                                                            <SelectContent>
                                                                                {machineAttendanceStatuses.map(s => (
                                                                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                                                                ))}
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </TableCell>
                                                                )
                                                            })}
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                    {machine.acquisition === 'Company-Owned' && machine.purchaseType === 'Loan' && (
                                        <div className="mt-6">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="font-semibold flex items-center gap-2"><CreditCard /> EMI Payment Schedule</h4>
                                                <div className="flex gap-2">
                                                    <Button size="sm" variant="outline" onClick={() => handleExportEmiPdf(machine, allMachineEmiPayments)} disabled={allMachineEmiPayments.length === 0}>
                                                        <Download className="mr-2 h-4 w-4" /> Export PDF
                                                    </Button>
                                                    {allMachineEmiPayments.length > 3 && (
                                                        <Button size="sm" variant="outline" onClick={() => toggleEmiScheduleView(machine.id)}>
                                                            {isExpanded ? 'View Less' : 'View All'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="border rounded-lg bg-background">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Due Date</TableHead>
                                                            <TableHead>Amount</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead className="text-right">Action</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {visibleEmiPayments.length > 0 ? (
                                                            visibleEmiPayments.map(payment => {
                                                                const dueDate = new Date(payment.dueDate);
                                                                const isPaymentPast = isPast(dueDate) && payment.status !== 'Paid';
                                                                const paymentStatus = isPaymentPast ? 'Overdue' : payment.status;
                                                                const isDueSoon = differenceInDays(dueDate, new Date()) <= 7 && payment.status === 'Upcoming';
                                                                const isPayable = isSameMonth(dueDate, new Date()) || isPast(dueDate);

                                                                return (
                                                                    <TableRow key={payment.id}>
                                                                        <TableCell>
                                                                            {format(dueDate, 'PPP')}
                                                                            {isDueSoon && <Badge variant="destructive" className="ml-2">Due Soon</Badge>}
                                                                        </TableCell>
                                                                        <TableCell>₹{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                                                        <TableCell>
                                                                            <Badge variant={getEmiStatusVariant(paymentStatus)}>{paymentStatus}</Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-right">
                                                                            {payment.status === 'Upcoming' && (
                                                                                <Button size="sm" onClick={() => handleMarkEmiAsPaid(payment.id)} disabled={!isPayable}>Mark as Paid</Button>
                                                                            )}
                                                                            {payment.status === 'Paid' && payment.paymentDate && (
                                                                                <span className="text-sm text-muted-foreground">Paid on {format(new Date(payment.paymentDate), 'PPP')}</span>
                                                                            )}
                                                                        </TableCell>
                                                                    </TableRow>
                                                                )
                                                            })
                                                        ) : (
                                                            <TableRow><TableCell colSpan={4} className="text-center h-24">No EMI schedule found.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-6 justify-end">
                                        <Button size="sm" variant="outline" onClick={() => handleOpenAssignDialog(machine)}><Truck className="mr-2 h-4 w-4" /> {machine.assignedSiteId ? 'Re-assign' : 'Assign to Site'}</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleOpenFuelDialog(machine)}><Fuel className="mr-2 h-4 w-4" /> Log Fuel</Button>
                                        {machine.acquisition === 'Company-Owned' && <Button size="sm" variant="outline" onClick={() => handleOpenMaintenanceDialog(machine)}><Wrench className="mr-2 h-4 w-4" /> Log Maintenance</Button>}
                                        <Button size="sm" variant="ghost" onClick={() => handleOpenMachineForm(machine)}><Edit className="mr-2 h-4 w-4" /> Edit</Button>
                                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeleteDialog(machine)}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
            </Accordion>
        </CardContent>
    </Card>

    {/* Dialogs */}
      
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Maintenance for {selectedMachine?.name}</DialogTitle>
            <DialogDescription>Describe the task, cost, and service details.</DialogDescription>
          </DialogHeader>
          <Form {...maintenanceForm}>
            <form onSubmit={maintenanceForm.handleSubmit(onMaintenanceSubmit)} className="space-y-4">
              <fieldset disabled={isSubmitting} className="space-y-4">
                <FormField control={maintenanceForm.control} name="task" render={({ field }) => (
                  <FormItem><FormLabel>Task</FormLabel>
                  <FormControl><Input placeholder="e.g., Generator Fuel Refill" {...field} /></FormControl>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={maintenanceForm.control} name="details" render={({ field }) => (
                  <FormItem><FormLabel>Details (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Add any relevant details here." {...field} /></FormControl>
                  <FormMessage /></FormItem>
                )} />
                <FormField
                  control={maintenanceForm.control}
                  name="cost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 250.75" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={maintenanceForm.control}
                  name="costAllocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost Allocation</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Allocate cost to..."/></SelectTrigger></FormControl>
                        <SelectContent>
                          {maintenanceCostAllocations.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                )}/>
                <Separator />
                <FormField
                  control={maintenanceForm.control}
                  name="kmDriven"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kilometers Driven at Service</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 50000" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={maintenanceForm.control}
                  name="nextServiceKm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Service Due (KM)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g., 60000" {...field} value={field.value ?? ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={maintenanceForm.control} name="scheduledDate" render={({ field }) => (
                  <FormItem><FormLabel>Date of Service</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage /></FormItem>
                )} />
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsMaintenanceDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log Task
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isFuelDialogOpen} onOpenChange={setIsFuelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Fuel for {selectedMachine?.name}</DialogTitle>
            <DialogDescription>Enter the details for this fuel transaction.</DialogDescription>
          </DialogHeader>
          <Form {...fuelForm}>
            <form onSubmit={fuelForm.handleSubmit(onFuelSubmit)} className="space-y-4">
               <fieldset disabled={isSubmitting} className="space-y-4">
                <FormField control={fuelForm.control} name="fuelType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuel Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select fuel type"/></SelectTrigger></FormControl>
                        <SelectContent>
                          {fuelTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                )} />
                <FormField control={fuelForm.control} name="quantity" render={({ field }) => (<FormItem><FormLabel>Quantity (Liters)</FormLabel><FormControl><Input type="number" placeholder="e.g., 50" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={fuelForm.control} name="cost" render={({ field }) => (<FormItem><FormLabel>Total Cost (₹)</FormLabel><FormControl><Input type="number" placeholder="e.g., 5000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={fuelForm.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
               </fieldset>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsFuelDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log Fuel
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>Assign {selectedMachine?.name} to a Site</DialogTitle>
                  <DialogDescription>
                      Select a site to assign this machine to, or choose "Available (Unassigned)" to check it back in.
                  </DialogDescription>
              </DialogHeader>
                <Form {...assignForm}>
                  <form onSubmit={assignForm.handleSubmit(handleAssignSite)} className="space-y-4 py-4">
                    <fieldset disabled={isSubmitting} className="space-y-4">
                      <FormField
                        control={assignForm.control}
                        name="siteId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Site</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a site..." />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="unassigned">Available (Unassigned)</SelectItem>
                                    {sites
                                      .filter(site => site.status === 'Active' || site.status === 'Planning')
                                      .map(site => (
                                        <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={assignForm.control}
                        name="assignmentDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assignment Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>
                    <DialogFooter>
                        <Button variant="ghost" type="button" onClick={() => setIsAssignDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Update Assignment
                        </Button>
                    </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
      
      <Dialog open={isDocumentDialogOpen} onOpenChange={setIsDocumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document for {selectedMachine?.name}</DialogTitle>
            <DialogDescription>Provide a name and select a file to upload.</DialogDescription>
          </DialogHeader>
          <Form {...documentForm}>
            <form onSubmit={documentForm.handleSubmit(onDocumentSubmit)} className="space-y-4 py-4">
              <fieldset disabled={isSubmitting || isExtracting} className="space-y-4">
                <FormField
                    control={documentForm.control}
                    name="name"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Document Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Vehicle Permit" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={documentForm.control}
                    name="expiryDate"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Expiry Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={documentForm.control}
                    name="file"
                    render={({ field: { onChange, onBlur, name, ref } }) => (
                    <FormItem>
                        <FormLabel>File</FormLabel>
                        <FormControl>
                          <Input 
                              type="file" 
                              ref={ref}
                              name={name}
                              onBlur={onBlur}
                              onChange={(e) => onChange(e.target.files)}
                              disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
              </fieldset>
              <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setIsDocumentDialogOpen(false)} disabled={isSubmitting || isExtracting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting || isExtracting}>
                    {(isSubmitting || isExtracting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting && !isExtracting && 'Uploading...'}
                    {isExtracting && 'Analyzing...'}
                    {!isSubmitting && !isExtracting && 'Upload'}
                  </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      <DeleteConfirmationDialog 
        open={isDocumentDeleteOpen}
        onOpenChange={setIsDocumentDeleteOpen}
        onConfirm={handleDeleteDocumentConfirm}
        title="Delete Document"
        description={`Are you sure you want to delete the document "${selectedDocument?.name}"? This action cannot be undone.`}
      />

      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Machine"
        description={`Are you sure you want to delete "${selectedMachine?.name}"? This action will hide it from the list but keep the data.`}
      />
      {selectedMachine && companyId && (
        <AddRentalPaymentDialog
            open={isRentalPaymentDialogOpen}
            onOpenChange={setIsRentalPaymentDialogOpen}
            machine={selectedMachine}
        />
      )}
      <Dialog open={isSummaryViewOpen} onOpenChange={setIsSummaryViewOpen}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>AI Summary for {selectedDocument?.name}</DialogTitle>
                <DialogDescription>
                    This is the text extracted and summarized by the AI.
                </DialogDescription>
            </DialogHeader>
            <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto rounded-md border p-4">
                <pre className="whitespace-pre-wrap font-sans">{selectedDocument?.extractedText}</pre>
            </div>
            <DialogFooter>
                <Button onClick={() => setIsSummaryViewOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



    
