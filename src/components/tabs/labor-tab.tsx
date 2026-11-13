
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Labor, Attendance, AttendanceStatus, attendanceStatuses, LaborTransaction, wageTypes, WageType, Site, paymentMethods, WorkLog, PaymentMethod, LaborTransactionType, EmploymentStatus, Company } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Users, Check, X, Minus, ChevronLeft, ChevronRight, Download, IndianRupee, Loader2, Filter, Ruler, LogOut, CheckSquare, Undo2, CreditCard, UserPlus, MoreVertical, Briefcase, User as UserIcon, FileText } from 'lucide-react';
import { PayslipDialog } from '@/components/payslip-dialog';
import { useToast } from '@/hooks/use-toast';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { Separator } from '../ui/separator';
import { Label } from '../ui/label';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDate, getDaysInMonth, isSameMonth, isBefore, isValid, isAfter, differenceInDays, differenceInMonths } from 'date-fns';
import Papa from 'papaparse';
import { onSubCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId, getSubCollection, addDocToGlobalCollection, onGlobalCollectionSnapshot, deleteDocWithId, markAttendance } from '@/context/site-context';
import { AddLaborTransactionDialog } from '../add-labor-transaction-dialog';
import { useAuth } from '@/context/auth-context';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { db } from '@/lib/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { formatCurrency, todayISO } from '@/lib/utils';
import { LogWorkDialog } from '../log-work-dialog';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { logActivity } from '@/lib/activity-log';


const formSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  role: z.string().min(2, 'Role is too short'),
  wageType: z.enum(wageTypes, { required_error: "Please select a wage type." }),
  wage: z.coerce.number().optional(),
  dateOfJoining: z.string().optional(),
  contractType: z.string().optional(),
  pricePerUnit: z.coerce.number().optional(),
  unit: z.string().optional(),
}).refine(data => {
    if (data.wageType === 'Daily' || data.wageType === 'Monthly') {
        return data.wage !== undefined && data.wage > 0;
    }
    return true;
}, {
    message: 'Wage must be a positive number for Daily or Monthly types.',
    path: ['wage'],
});

interface LaborTabProps {
  site: Site;
  wageSummary: any[];
  company?: Company;
}

export function LaborTab({ site, wageSummary: initialWageSummary, company }: LaborTabProps) {
  const { id: siteId, companyId } = site;
  const [labors, setLabors] = useState<Labor[]>([]);
  const [allAttendances, setAllAttendances] = useState<Attendance[]>([]);
  const [transactions, setTransactions] = useState<LaborTransaction[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isWorkLogDialogOpen, setIsWorkLogDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTransactionDeleteOpen, setIsTransactionDeleteOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [selectedLabor, setSelectedLabor] = useState<Labor | null>(null);
  const [payslipLabor, setPayslipLabor] = useState<Labor | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<LaborTransaction | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [attendanceChanges, setAttendanceChanges] = useState<{[laborId: string]: AttendanceStatus}>({});

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [monthView, setMonthView] = useState<'firstHalf' | 'secondHalf'>('firstHalf');

  const [searchTerm, setSearchTerm] = useState('');

  // Filters for transaction history
  const [laborerFilter, setLaborerFilter] = useState<string[]>([]);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);


  const { toast } = useToast();
  const { user, isAdmin } = useAuth();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  useEffect(() => {
    if (!siteId || !companyId) return;

    const unsubLabors = onGlobalCollectionSnapshot<Labor>(
        'labors',
        companyId,
        (globalLabors) => {
            const siteAndUnassignedLabors = globalLabors.filter(l => (l.siteId === siteId || (l.employmentStatus === 'Off Roll' && initialWageSummary.find(s => s.id === l.id))) && !l.isDeleted);
            setLabors(siteAndUnassignedLabors);
        }
    );

    const unsubAttendances = onSubCollectionSnapshot<Attendance>(
        'attendances',
        companyId,
        siteId,
        setAllAttendances
    );
    const unsubTransactions = onSubCollectionSnapshot<LaborTransaction>(
        'labor_transactions',
        companyId,
        siteId,
        setTransactions
    );

    const unsubWorkLogs = onSubCollectionSnapshot<WorkLog>(
        'work_logs',
        companyId,
        siteId,
        setWorkLogs
    );
    
    return () => {
      unsubLabors();
      unsubAttendances();
      unsubTransactions();
      unsubWorkLogs();
    };
  }, [siteId, companyId, initialWageSummary]);

    const wageSummary = useMemo(() => {
    return labors.map(labor => {
        const laborTransactions = transactions.filter(t => t.laborId === labor.id && !t.isDeleted);
        const totalPaid = laborTransactions.filter(t => t.type === 'Payment').reduce((sum, t) => sum + t.amount, 0);

        let totalWages = 0;
        let daysWorked = 0;
        const joiningDate = labor.dateOfJoining ? new Date(labor.dateOfJoining) : null;
        
        if (labor.wageType === 'Contract') {
            totalWages = workLogs.filter(wl => wl.laborerId === labor.id && !wl.isDeleted).reduce((sum, log) => sum + log.wageEarned, 0);
            daysWorked = workLogs.filter(wl => wl.laborerId === labor.id && !wl.isDeleted).length;
        } else if (labor.wageType === 'Monthly' && labor.wage && joiningDate && isValid(joiningDate) && !isAfter(joiningDate, today)) {
            const monthsWorked = differenceInMonths(today, joiningDate) + 1;
            totalWages = monthsWorked * labor.wage; // Include current month
            daysWorked = differenceInDays(today, joiningDate);
        } else if (labor.wageType === 'Daily' && joiningDate && labor.wage) {
            // Someone joining in the future has earned nothing yet.
            if (isValid(joiningDate) && !isAfter(joiningDate, today)) {
                const allDays = eachDayOfInterval({ start: joiningDate, end: today });
                // Look attendance up by date instead of scanning every record for every day.
                const attendanceByDate = new Map(allAttendances.filter(a => a.laborId === labor.id).map(a => [a.date, a]));
                let totalDailyWages = 0;
                let daysWorkedCount = 0;

                allDays.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const record = attendanceByDate.get(dateStr);
                    const status = record?.status || (isBefore(day, today) ? 'Present' : 'Unmarked');
                    
                    let dayValue = 0;
                    if (status === 'Present') dayValue = 1;
                    else if (status === 'Half-day') dayValue = 0.5;
                    
                    if (dayValue > 0) {
                        daysWorkedCount += dayValue;
                        totalDailyWages += dayValue * labor.wage!;
                    }
                });
                daysWorked = daysWorkedCount;
                totalWages = totalDailyWages;
            }
        }

        return {
            id: labor.id,
            name: labor.name,
            role: labor.role,
            wageType: labor.wageType,
            daysWorked,
            totalWages,
            totalPaid: totalPaid,
            balance: totalWages - totalPaid,
        };
    });
  }, [labors, allAttendances, transactions, workLogs, today]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const wageType = form.watch('wageType');

  useEffect(() => {
    if (selectedLabor) {
      form.reset({
        name: selectedLabor.name,
        role: selectedLabor.role,
        wageType: selectedLabor.wageType,
        wage: selectedLabor.wage || 0,
        dateOfJoining: selectedLabor.dateOfJoining || '',
        contractType: selectedLabor.contractType || '',
        pricePerUnit: selectedLabor.pricePerUnit || 0,
        unit: selectedLabor.unit || '',
      });
    } else {
      if (isDialogOpen) {
        form.reset({ name: '', role: '', wageType: undefined, wage: 0, dateOfJoining: todayISO(), contractType: '', pricePerUnit: 0, unit: '' });
      }
    }
  }, [selectedLabor, form, isDialogOpen]);

   useEffect(() => {
    setMonthView('firstHalf');
  }, [currentMonth]);
  
  const handleOpenDialog = (labor: Labor | null = null) => {
    setSelectedLabor(labor);
    setIsDialogOpen(true);
  };
  
  const handleOpenDeleteDialog = (labor: Labor) => {
    setSelectedLabor(labor);
    setIsDeleteDialogOpen(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (selectedLabor) {
      try {
        await softDeleteDocWithId('labors', selectedLabor.id);
        toast({ title: 'Laborer Deleted', description: `"${selectedLabor.name}" has been removed.` });
      } catch (e) {
        toast({ variant: "destructive", title: 'Error', description: `Could not delete "${selectedLabor.name}".` });
      }
    }
    setIsDeleteDialogOpen(false);
    setSelectedLabor(null);
  };

  const handleReleaseLaborer = async (laborer: Labor) => {
    await updateDocWithId('labors', laborer.id, { employmentStatus: 'Off Roll' });
    toast({ title: 'Laborer Released', description: `${laborer.name}'s status has been set to "Off Roll".` });
  };
  
  const handleReactivateLaborer = async (laborer: Labor) => {
    await updateDocWithId('labors', laborer.id, { employmentStatus: 'On Roll', siteId: siteId });
    toast({ title: 'Laborer Re-activated', description: `${laborer.name} is now on roll for this site.` });
  };


  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
        if (selectedLabor) {
            await updateDocWithId('labors', selectedLabor.id, { ...selectedLabor, ...values });
            toast({ title: 'Laborer Updated', description: `"${values.name}" has been updated.` });
        } else {
            await addDocWithSiteId('labors', companyId, siteId, { ...values, employmentStatus: 'On Roll' });
            toast({ title: 'Laborer Added', description: `"${values.name}" has been added.` });
        }
        setIsDialogOpen(false);
        setSelectedLabor(null);
    } catch(e) {
        toast({ variant: "destructive", title: 'Error', description: "Could not save laborer details." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleAttendanceChange = (laborId: string, status: AttendanceStatus) => {
    setAttendanceChanges(prev => ({...prev, [laborId]: status}));
  };

  const handleSaveAttendance = async () => {
    if (!companyId) return;
    setIsSubmitting(true);
    const batch = writeBatch(db);
    
    const changesToSave = { ...attendanceChanges };
    
    try {
        for (const [laborId, status] of Object.entries(changesToSave)) {
            await markAttendance(companyId, siteId, laborId, selectedDate, status, batch);
        }
        
        await batch.commit();
        const counts = Object.values(changesToSave).reduce((acc, st) => ({ ...acc, [st]: (acc[st] || 0) + 1 }), {} as Record<string, number>);
        logActivity({
            companyId, siteId, action: 'other', entity: 'attendances',
            summary: `Saved attendance for ${selectedDate}: ${Object.entries(counts).map(([st, n]) => `${n} ${st}`).join(', ')}`
                + ` (${Object.keys(changesToSave).map(id => labors.find(l => l.id === id)?.name ?? 'worker').slice(0, 8).join(', ')}${Object.keys(changesToSave).length > 8 ? '...' : ''})`,
        });

        setAttendanceChanges({});
        toast({ title: 'Attendance Saved', description: `Attendance for ${selectedDate} has been updated.` });
    } catch(e) {
         console.error("Failed to save attendance:", e);
         toast({ variant: "destructive", title: 'Error', description: "Could not save attendance." });
    } finally {
        setIsSubmitting(false);
    }
  };
  
  const getAttendanceForLabor = (laborId: string, date: string): AttendanceStatus => {
    if (attendanceChanges[laborId] && date === selectedDate) {
      return attendanceChanges[laborId];
    }
    const record = allAttendances.find(a => a.laborId === laborId && a.date === date);
    if (record) {
      return record.status;
    }
    if (isAfter(new Date(date), today)) {
        return 'Unmarked';
    }
    return 'Present';
  };
  
  useEffect(() => {
    setAttendanceChanges({});
  }, [selectedDate]);

  const filteredLabors = useMemo(() => {
    return labors.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [labors, searchTerm]);

  const attendanceLabors = useMemo(() => {
    return labors.filter(l => l.wageType !== 'Contract' && l.siteId === siteId && l.employmentStatus === 'On Roll');
  }, [labors, siteId]);

  const contractLabors = useMemo(() => {
    return labors.filter(l => l.wageType === 'Contract');
  }, [labors]);

  const monthlyReport = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    let daysInMonth = eachDayOfInterval({ start, end });
    
    if (monthView === 'firstHalf') {
        daysInMonth = daysInMonth.slice(0, 15);
    } else {
        daysInMonth = daysInMonth.slice(15);
    }

    const reportData = filteredLabors
      .filter(l => l.wageType !== 'Contract') // Exclude contract laborers from attendance report
      .map(laborer => {
        const attendanceByDate: { [date: string]: AttendanceStatus } = {};
        const joiningDate = laborer.dateOfJoining ? new Date(laborer.dateOfJoining) : null;
        
        daysInMonth.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          if (joiningDate && isBefore(day, joiningDate) && format(day, 'yyyy-MM-dd') !== format(joiningDate, 'yyyy-MM-dd')) {
              attendanceByDate[dateStr] = 'Unmarked';
          } else {
              attendanceByDate[dateStr] = getAttendanceForLabor(laborer.id, dateStr);
          }
        });
        return {
          laborerId: laborer.id,
          laborerName: laborer.name,
          attendance: attendanceByDate,
        };
      });

    return { days: daysInMonth, reportData };
  }, [currentMonth, filteredLabors, allAttendances, monthView]);

  const changeMonth = (offset: number) => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
    setCurrentMonth(newMonth);
  };
  
  const getAttendanceIcon = (status: AttendanceStatus, date: Date) => {
    if (isAfter(date, today)) {
        return null;
    }
    switch (status) {
      case 'Present': return <Check className="h-5 w-5 text-green-600 mx-auto" />;
      case 'Absent': return <X className="h-5 w-5 text-red-600 mx-auto" />;
      case 'Half-day': return <Minus className="h-5 w-5 text-yellow-600 mx-auto" />;
      default: return null;
    }
  }

  const exportToCSV = (data: any[], filename: string) => {
    // Papa.unparse has no per-value transform option, so blank out "Unmarked" statuses before converting.
    const cleaned = data.map(row =>
        row && typeof row === 'object' && row.status === 'Unmarked' ? { ...row, status: '' } : row
    );
    const csv = Papa.unparse(cleaned);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportMonthlyReport = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start, end });

    const headers = ['Laborer', ...days.map(d => format(d, 'yyyy-MM-dd'))];
    
    const data = filteredLabors
      .filter(l => l.wageType !== 'Contract')
      .map(laborer => {
        const row: { [key: string]: string } = { 'Laborer': laborer.name };
        const joiningDate = laborer.dateOfJoining ? new Date(laborer.dateOfJoining) : null;
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          let status: AttendanceStatus | '' = '';
          if (!joiningDate || (joiningDate && !isBefore(day, joiningDate))) {
              status = getAttendanceForLabor(laborer.id, dateStr);
          }
          row[dateStr] = status === 'Unmarked' ? '' : status;
        });
        return row;
    });

    exportToCSV(data, `monthly_attendance_${format(currentMonth, 'yyyy-MM')}.csv`);
  };

  const sortedTransactions = useMemo(() => {
    return transactions.filter(t => !t.isDeleted)
      .filter(t => laborerFilter.length === 0 || laborerFilter.includes(t.laborId))
      .filter(t => paymentMethodFilter.length === 0 || (t.paymentMethod && paymentMethodFilter.includes(t.paymentMethod)))
      .filter(t => dateFilter === '' || t.date === dateFilter)
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, laborerFilter, paymentMethodFilter, dateFilter]);
  
  useEffect(() => {
    if (sortedTransactions.length > 0) {
        const latestTransaction = sortedTransactions[0];
        const latestTransactionIndex = sortedTransactions.findIndex(t => t.id === latestTransaction.id);
        const newPage = Math.floor(latestTransactionIndex / itemsPerPage) + 1;
        setCurrentPage(newPage);
    } else {
        setCurrentPage(1);
    }
  }, [sortedTransactions, itemsPerPage]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedTransactions, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedTransactions.length / itemsPerPage);

  const uniqueLaborersWithTransactions = useMemo(() => {
      const laborerIds = new Set(transactions.map(t => t.laborId));
      return labors.filter(l => laborerIds.has(l.id));
  }, [transactions, labors]);

  const uniquePaymentMethods = useMemo(() => {
      const methods = new Set(transactions.map(t => t.paymentMethod).filter(Boolean) as string[]);
      return Array.from(methods);
  }, [transactions]);

  const getLaborerName = (laborId: string) => {
    return labors.find(l => l.id === laborId)?.name || 'Unknown';
  }

  const clearFilters = () => {
    setLaborerFilter([]);
    setPaymentMethodFilter([]);
    setDateFilter('');
  }
  
  const getWageLabel = () => {
    switch (wageType) {
        case 'Daily': return 'Daily Wage (Rs.)';
        case 'Monthly': return 'Monthly Salary (Rs.)';
        case 'Contract': return 'Contract Amount (Rs.)';
        default: return 'Wage (Rs.)';
    }
  };
  
  const handleOpenTransactionDialog = (transaction: LaborTransaction | null = null) => {
    setSelectedTransaction(transaction);
    setIsTransactionDialogOpen(true);
  };
  
  const handleDeleteTransactionConfirm = async () => {
    if (selectedTransaction) {
      // Soft delete keeps an audit trail of payment records (lists already hide isDeleted items).
      await softDeleteDocWithId('labor_transactions', selectedTransaction.id);
      toast({ title: 'Transaction Deleted' });
    }
    setIsTransactionDeleteOpen(false);
  };
  
  const getStatusBadgeVariant = (status: 'On Roll' | 'Off Roll') => {
    switch(status) {
      case 'On Roll': return 'secondary';
      case 'Off Roll': return 'outline';
      default: return 'outline';
    }
  }


  return (
    <div className="space-y-6 bg-muted/20 -m-8 p-8">
      <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle className="text-2xl font-bold">Labor Management</CardTitle>
                  <CardDescription>Track worker payments, balances, and status for this site.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setIsWorkLogDialogOpen(true)}><Briefcase className="mr-2 h-4 w-4" />Log Work</Button>
                  <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" /> Add Laborer</Button>
              </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Worker</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Work Days</TableHead>
                  <TableHead className="text-right">Total Wages</TableHead>
                  <TableHead className="text-right">Total Paid</TableHead>
                  <TableHead className="text-right">Balance Due</TableHead>
                  <TableHead className="text-right w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wageSummary.length > 0 ? (
                  wageSummary.map((summary) => {
                    const laborer = labors.find((l) => l.id === summary.id);
                    const status = laborer?.employmentStatus || 'On Roll';
                    return (
                      <TableRow key={summary.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback>
                                <UserIcon className="h-5 w-5 text-muted-foreground" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-semibold">{summary.name}</p>
                              <p className="text-xs text-muted-foreground">{summary.role}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant={getStatusBadgeVariant(status)}>{status}</Badge></TableCell>
                        <TableCell>{summary.daysWorked}</TableCell>
                        <TableCell className="text-right">{formatCurrency(summary.totalWages)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(summary.totalPaid)}</TableCell>
                        <TableCell className={`text-right font-bold ${summary.balance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(summary.balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                             {status === 'On Roll' && laborer ? (
                                <Button size="sm" variant="outline" onClick={() => handleReleaseLaborer(laborer)}>Release</Button>
                              ) : laborer && (
                                <Button size="sm" variant="secondary" onClick={() => handleReactivateLaborer(laborer)}>Re-activate</Button>
                              )}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreVertical className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => handleOpenTransactionDialog(null)}>
                                      <IndianRupee className="mr-2 h-4 w-4" /> Log Payment
                                    </DropdownMenuItem>
                                    {laborer && (
                                      <DropdownMenuItem onSelect={() => setPayslipLabor(laborer)}>
                                        <FileText className="mr-2 h-4 w-4" /> Payslip (PDF)
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onSelect={() => handleOpenDialog(laborer)}>
                                        <Edit className="mr-2 h-4 w-4" /> Edit Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleOpenDeleteDialog(laborer!)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete Laborer
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                             </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      <p className="font-semibold">No Laborers Added</p>
                      <p className="text-muted-foreground text-sm">Get started by adding a new laborer to this site.</p>
                      <Button className="mt-4" onClick={() => handleOpenDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add Laborer
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>A log of all payments and transactions for this site.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
              <TableHeader>
                  <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Laborer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length > 0 ? paginatedTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                        <TableCell>{format(new Date(transaction.date), 'PPP')}</TableCell>
                        <TableCell>{getLaborerName(transaction.laborId)}</TableCell>
                        <TableCell>{transaction.type}</TableCell>
                        <TableCell>{transaction.paymentMethod || 'N/A'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
                        {isAdmin && (
                        <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => handleOpenTransactionDialog(transaction)}>
                            <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedTransaction(transaction); setIsTransactionDeleteOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </TableCell>
                        )}
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={isAdmin ? 6 : 5} className="h-24 text-center">
                            <p className="font-semibold">No Transactions Found</p>
                            <p className="text-muted-foreground text-sm">Try adjusting your filters or logging a new transaction.</p>
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
          </Table>
        </CardContent>
         <CardFooter className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsFilterDialogOpen(true)}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filter
                </Button>
                {(laborerFilter.length > 0 || paymentMethodFilter.length > 0 || dateFilter !== '') && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear Filters
                    </Button>
                )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span className="text-nowrap">Rows:</span>
                    <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
                        <SelectTrigger className="w-16 h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[5, 10, 20, 50].map(val => (
                                <SelectItem key={val} value={String(val)}>{val}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <span>Page {totalPages > 0 ? currentPage : 0} of {totalPages}</span>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>Next</Button>
                </div>
            </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 mb-2"><CheckSquare /> Attendance Sheet</CardTitle>
          <CardDescription>Mark daily attendance for laborers on this site. Contract-based laborers are excluded.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
                <Label htmlFor="attendance-date" className="font-semibold">Select Date:</Label>
                <Input 
                    id="attendance-date"
                    type="date"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-auto"
                    max={todayStr}
                />
            </div>
            <Button onClick={handleSaveAttendance} disabled={isSubmitting || Object.keys(attendanceChanges).length === 0}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Attendance
            </Button>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Attendance Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceLabors.length > 0 ? attendanceLabors.map(labor => (
                  <TableRow key={labor.id}>
                    <TableCell className="font-medium">{labor.name}</TableCell>
                    <TableCell>{labor.role}</TableCell>
                    <TableCell>
                      <Select
                        value={getAttendanceForLabor(labor.id, selectedDate)}
                        onValueChange={(status: AttendanceStatus) => handleAttendanceChange(labor.id, status)}
                        disabled={isAfter(new Date(selectedDate), today) || isSubmitting}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Choose option" />
                        </SelectTrigger>
                        <SelectContent>
                          {attendanceStatuses.map(status => (
                            <SelectItem key={status} value={status}>
                              {status === 'Unmarked' ? 'Choose option' : status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center h-24">No daily or monthly wage laborers assigned to this site.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Monthly Attendance Report</CardTitle>
            <div className="flex items-center justify-between gap-4 mt-4">
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
                <Tabs defaultValue="firstHalf" value={monthView} onValueChange={(value) => setMonthView(value as any)} className="w-auto">
                    <TabsList>
                        <TabsTrigger value="firstHalf">Days 1-15</TabsTrigger>
                        <TabsTrigger value="secondHalf">Days 16-{getDaysInMonth(currentMonth)}</TabsTrigger>
                    </TabsList>
                </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Input 
                placeholder="Search by laborer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Button variant="outline" size="sm" onClick={handleExportMonthlyReport} disabled={filteredLabors.length === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] sticky left-0 bg-background z-10 font-semibold">Laborer</TableHead>
                  {monthlyReport.days.map(day => (
                    <TableHead key={day.toISOString()} className="text-center p-1">
                      <div className='flex flex-col items-center text-xs'>
                         <span>{format(day, 'EEE')}</span>
                         <span className="font-semibold text-base">{getDate(day)}</span>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyReport.reportData.length > 0 ? monthlyReport.reportData.map(laborerReport => (
                  <TableRow key={laborerReport.laborerId}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10">{laborerReport.laborerName}</TableCell>
                    {monthlyReport.days.map(day => (
                      <TableCell key={day.toISOString()} className="text-center">
                         {getAttendanceIcon(laborerReport.attendance[format(day, 'yyyy-MM-dd')], day)}
                      </TableCell>
                    ))}
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={monthlyReport.days.length + 1} className="text-center h-24">No attendance data for this month.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filter Transaction History</DialogTitle>
            <DialogDescription>
              Select filters to apply to the transaction log.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="laborer-filter" className="text-right">
                  Laborer
                </Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="col-span-3 justify-between">
                            {laborerFilter.length > 0 ? `${laborerFilter.length} selected` : "Select laborers..."}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Search laborers..." />
                            <CommandList>
                                <CommandEmpty>No laborers found.</CommandEmpty>
                                <CommandGroup>
                                    {uniqueLaborersWithTransactions.map(l => (
                                        <CommandItem
                                            key={l.id}
                                            onSelect={() => {
                                                const newFilter = laborerFilter.includes(l.id)
                                                    ? laborerFilter.filter(item => item !== l.id)
                                                    : [...laborerFilter, l.id];
                                                setLaborerFilter(newFilter);
                                            }}
                                        >
                                            <Checkbox
                                                className="mr-2"
                                                checked={laborerFilter.includes(l.id)}
                                            />
                                            {l.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="method-filter" className="text-right">
                  Method
                </Label>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="col-span-3 justify-between">
                            {paymentMethodFilter.length > 0 ? `${paymentMethodFilter.length} selected` : "Select methods..."}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Search methods..." />
                            <CommandList>
                                <CommandEmpty>No methods found.</CommandEmpty>
                                <CommandGroup>
                                    {uniquePaymentMethods.map(name => (
                                        <CommandItem
                                            key={name}
                                            onSelect={() => {
                                                const newFilter = paymentMethodFilter.includes(name)
                                                    ? paymentMethodFilter.filter(item => item !== name)
                                                    : [...paymentMethodFilter, name];
                                                setPaymentMethodFilter(newFilter);
                                            }}
                                        >
                                            <Checkbox
                                                className="mr-2"
                                                checked={paymentMethodFilter.includes(name)}
                                            />
                                            {name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
              </div>
               <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date-filter" className="text-right">
                  Date
                </Label>
                <Input
                  id="date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="col-span-3"
                />
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { clearFilters(); setIsFilterDialogOpen(false); }}>Clear All Filters</Button>
            <Button onClick={() => setIsFilterDialogOpen(false)}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={(isOpen) => { setIsDialogOpen(isOpen); if (!isOpen) setSelectedLabor(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedLabor ? 'Edit' : 'Add New'} Laborer</DialogTitle>
            <DialogDescription>Fill in the details for the worker.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <fieldset disabled={isSubmitting} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="e.g., John Smith" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role / Trade</FormLabel>
                    <FormControl><Input placeholder="e.g., Electrician" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="wageType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Wage Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Choose wage type" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {wageTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                 {wageType === 'Contract' ? (
                  <>
                    <FormField control={form.control} name="contractType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type of Contract</FormLabel>
                        <FormControl><Input placeholder="e.g., Plastering, Tiling" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="flex gap-2">
                       <FormField control={form.control} name="pricePerUnit" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Price Per Unit (Rs.)</FormLabel>
                          <FormControl><Input type="number" placeholder="e.g., 25" {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="unit" render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Unit</FormLabel>
                          <FormControl><Input placeholder="e.g., sqft, item" {...field} value={field.value || ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </>
                ) : (
                  wageType && <FormField control={form.control} name="wage" render={({ field }) => (
                    <FormItem>
                      <FormLabel>{getWageLabel()}</FormLabel>
                      <FormControl><Input type="number" placeholder="e.g., 800" {...field} value={field.value || ''} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}
                <FormField control={form.control} name="dateOfJoining" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Joining (Optional)</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedLabor ? 'Save Changes' : 'Add Laborer'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AddLaborTransactionDialog
        open={isTransactionDialogOpen}
        onOpenChange={setIsTransactionDialogOpen}
        labors={labors}
        siteId={siteId}
      />
       <LogWorkDialog 
        open={isWorkLogDialogOpen}
        onOpenChange={setIsWorkLogDialogOpen}
        siteId={siteId}
        contractLabors={contractLabors}
      />
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={handleDeleteConfirm}
        title="Delete Laborer"
        description={`Are you sure you want to delete "${selectedLabor?.name}"? This action will hide it from the list but keep the data.`}
      />
      <DeleteConfirmationDialog 
        open={isTransactionDeleteOpen} 
        onOpenChange={setIsTransactionDeleteOpen} 
        onConfirm={handleDeleteTransactionConfirm}
        title="Delete Transaction"
        description={`Are you sure you want to delete this transaction? This action cannot be undone.`}
      />
      <PayslipDialog
        open={!!payslipLabor}
        onOpenChange={(open) => { if (!open) setPayslipLabor(null); }}
        labor={payslipLabor}
        siteName={site.name}
        companyName={company?.name || ''}
        logoUrl={company?.logoUrl}
        attendances={allAttendances}
        workLogs={workLogs}
        transactions={transactions}
      />
    </div>
  );
}
