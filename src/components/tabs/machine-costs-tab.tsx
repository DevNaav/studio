

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Fuel, Wrench, IndianRupee, Truck, LogOut, Plus } from 'lucide-react';
import { Machine, MaintenanceLog, FuelLog, Expense, MachineAttendance, AcquisitionType, acquisitionTypes, PurchaseType, purchaseTypes, Site } from '@/lib/types';
import { onGlobalCollectionSnapshot, onSubCollectionSnapshot, updateDocWithId, addDocToGlobalCollection, generateEmiSchedule, addDocWithSiteId } from '@/context/site-context';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useToast } from '@/hooks/use-toast';
import { FinalizeRentalDialog } from '../finalize-rental-dialog';
import { format, isAfter, eachDayOfInterval, differenceInDays } from 'date-fns';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useAuth } from '@/context/auth-context';

interface MachineCostsTabProps {
  site: Site;
}

const machineFormSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  vehicleNumber: z.string().min(2, 'Vehicle number is too short'),
  acquisition: z.enum(acquisitionTypes, { required_error: "Please select an acquisition type." }),
  date: z.string().min(1, 'Date is required'),
  dailyRentalPrice: z.coerce.number().optional(),
  purchaseType: z.enum(purchaseTypes).optional(),
  purchasePrice: z.coerce.number().optional(),
  interestRate: z.coerce.number().optional(),
  loanTenureYears: z.coerce.number().optional(),
});


export function MachineCostsTab({ site }: MachineCostsTabProps) {
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allMaintenanceLogs, setAllMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [allFuelLogs, setAllFuelLogs] = useState<FuelLog[]>([]);
  const [allMachineAttendances, setAllMachineAttendances] = useState<MachineAttendance[]>([]);
  const [siteExpenses, setSiteExpenses] = useState<Expense[]>([]);
  const [machineToRelease, setMachineToRelease] = useState<(Machine & { totalCost: number; balance: number }) | null>(null);
  const [isFinalizeRentalOpen, setIsFinalizeRentalOpen] = useState(false);
  const [isMachineFormOpen, setIsMachineFormOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const { toast } = useToast();
  const { userProfile } = useAuth();
  
  const machineForm = useForm<z.infer<typeof machineFormSchema>>({
    resolver: zodResolver(machineFormSchema),
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


  useEffect(() => {
    if (!site?.companyId || !site.id) return;
    const companyId = site.companyId;

    const unsubMachines = onGlobalCollectionSnapshot<Machine>('machines', companyId, setAllMachines);
    const unsubMaintenance = onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, setAllMaintenanceLogs);
    const unsubFuel = onGlobalCollectionSnapshot<FuelLog>('fuel_logs', companyId, setAllFuelLogs);
    const unsubAttendances = onGlobalCollectionSnapshot<MachineAttendance>('machine_attendances', companyId, setAllMachineAttendances);
    const unsubExpenses = onSubCollectionSnapshot<Expense>('expenses', companyId, site.id, setSiteExpenses);

    return () => {
      unsubMachines();
      unsubMaintenance();
      unsubFuel();
      unsubAttendances();
      unsubExpenses();
    };
  }, [site.id, site.companyId]);

  const siteMachines = useMemo(() => {
    return allMachines.filter(m => m.assignedSiteId === site.id && !m.isDeleted);
  }, [allMachines, site.id]);

  const machineIdsOnSite = useMemo(() => siteMachines.map(m => m.id), [siteMachines]);

  const maintenanceLogs = useMemo(() => {
    return allMaintenanceLogs
      .filter(log => machineIdsOnSite.includes(log.machineId) && !log.isDeleted)
      .sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
  }, [allMaintenanceLogs, machineIdsOnSite]);
  
  const fuelLogs = useMemo(() => {
    return allFuelLogs
      .filter(log => log.siteId === site.id && !log.isDeleted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allFuelLogs, site.id]);

  const emiCosts = useMemo(() => {
    return siteExpenses.filter(expense => 
      expense.machineId && 
      machineIdsOnSite.includes(expense.machineId) && 
      expense.category === 'EMI' &&
      !expense.isDeleted
    );
  }, [siteExpenses, machineIdsOnSite]);
  
  const calculateEMI = (principal: number, rate: number, tenureYears: number) => {
    if (principal <= 0 || rate <= 0 || tenureYears <= 0) return 0;
    const monthlyRate = rate / 12 / 100;
    const numberOfMonths = tenureYears * 12;
    const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, numberOfMonths)) / (Math.pow(1 + monthlyRate, numberOfMonths) - 1);
    return emi;
  };
  
  const totalAccruedRent = useMemo(() => {
    let totalRent = 0;
    const machineIdsOnSite = siteMachines.map(m => m.id);
    
    siteMachines.forEach(machine => {
        if (!machine.assignmentDate || !machine.dailyRentalPrice) return;

        const startDate = new Date(machine.assignmentDate);
        const today = new Date();
        if (isAfter(startDate, today)) return;

        const rentalPeriod = eachDayOfInterval({ start: startDate, end: today });
        const machineAttendanceForMachine = allMachineAttendances.filter(a => a.machineId === machine.id);

        rentalPeriod.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const attendance = machineAttendanceForMachine.find(a => a.date === dateStr);
            const status = attendance?.status || 'Unmarked';

            if (status === 'Present' || status === 'Unmarked') {
                totalRent += machine.dailyRentalPrice!;
            } else if (status === 'Half-day') {
                totalRent += machine.dailyRentalPrice! / 2;
            }
        });
    });

    const finalizedRent = siteExpenses
      .filter(e => e.category === 'Rental' && !e.isDeleted && e.machineId && machineIdsOnSite.includes(e.machineId))
      .reduce((acc, expense) => acc + expense.amount, 0);

    return totalRent + finalizedRent;
  }, [siteMachines, allMachineAttendances, siteExpenses]);


  const totalMaintenanceCost = useMemo(() => {
    return maintenanceLogs.reduce((acc, log) => acc + (log.cost || 0), 0);
  }, [maintenanceLogs]);

  const totalFuelCost = useMemo(() => {
    return fuelLogs.reduce((acc, log) => acc + (log.cost || 0), 0);
  }, [fuelLogs]);

  const totalEmiCost = useMemo(() => {
    return emiCosts.reduce((acc, expense) => acc + (expense.amount || 0), 0);
  }, [emiCosts]);

  const totalRentalAndEmiCost = totalEmiCost + totalAccruedRent;
  const totalMachineCost = totalMaintenanceCost + totalFuelCost + totalRentalAndEmiCost;
  
  const handleOpenReleaseDialog = (machine: Machine) => {
    const totalPaid = siteExpenses
        .filter(e => e.category === 'Rental' && e.machineId === machine.id)
        .reduce((sum, e) => sum + e.amount, 0);

    const accruedCost = rentAndEmiLog.find(log => log.id === `accrued-${machine.id}`)?.cost || 0;
    
    setMachineToRelease({ 
        ...machine, 
        totalCost: accruedCost, 
        balance: accruedCost - totalPaid
    });
    setIsFinalizeRentalOpen(true);
  }
  
  const handleOpenMachineForm = (machine: Machine | null = null) => {
    setSelectedMachine(machine);
    setIsMachineFormOpen(true);
  };
  
  const onMachineSubmit = async (values: z.infer<typeof machineFormSchema>) => {
    const companyId = site.companyId;
    if (!companyId) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot add machine without a company context.' });
        return;
    }
    try {
        let machineId: string;
        const machineData: Partial<Omit<Machine, 'id' | 'isDeleted' | 'companyId'>> = {
            name: values.name,
            vehicleNumber: values.vehicleNumber,
            acquisition: values.acquisition,
            date: values.date,
            dailyRentalPrice: values.dailyRentalPrice,
        };

        if (values.acquisition === 'Company-Owned') {
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
            const newDoc = await addDocToGlobalCollection('machines', companyId, { ...finalMachineData, assignedSiteId: site.id, assignmentDate: new Date().toISOString().split('T')[0] });
            machineId = newDoc.id;
            toast({ title: 'Machine Logged', description: `"${values.name}" has been logged and assigned to this site.` });
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
    }
  };

    const rentAndEmiLog = useMemo(() => {
    const log: any[] = [];
    const processedMachineIds = new Set<string>();

    // 1. Add all historical finalized expenses (both EMI and Rental)
    const finalizedExpenses = siteExpenses.filter(e => (e.category === 'Rental' || e.category === 'EMI') && !e.isDeleted);
    
    finalizedExpenses.forEach(e => {
        if (e.machineId) { // Check if machineId exists
            log.push({
                id: e.id,
                machine: allMachines.find(m => m.id === e.machineId),
                description: e.description,
                date: e.date,
                cost: e.amount
            });
            processedMachineIds.add(e.machineId);
        }
    });

    // 2. Add live accrued costs for currently assigned machines that are NOT yet in the log
    siteMachines.forEach(m => {
        if (processedMachineIds.has(m.id)) return; // Skip if already processed as a finalized expense

        let accruedCost = 0;
        let description = '';

        if (m.dailyRentalPrice && m.assignmentDate) {
            // This applies to both Rented and Company-Owned with a rental price
            const startDate = new Date(m.assignmentDate);
            const today = new Date();
            if (!isAfter(startDate, today)) {
                const rentalPeriod = eachDayOfInterval({ start: startDate, end: today });
                const machineAttendanceForMachine = allMachineAttendances.filter(a => a.machineId === m.id);

                rentalPeriod.forEach(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const attendance = machineAttendanceForMachine.find(a => a.date === dateStr);
                    const status = attendance?.status || 'Unmarked';
                    if (status === 'Present' || status === 'Unmarked') {
                        accruedCost += m.dailyRentalPrice!;
                    } else if (status === 'Half-day') {
                        accruedCost += m.dailyRentalPrice! / 2;
                    }
                });
            }
            description = `Accrued Rental Cost for ${m.name}`;
        } else if (m.acquisition === 'Company-Owned' && m.purchaseType === 'Loan' && m.purchasePrice && m.interestRate && m.loanTenureYears) {
             const emi = calculateEMI(m.purchasePrice, m.interestRate, m.loanTenureYears);
             const totalLoanCost = emi * m.loanTenureYears * 12;
             const dailyCost = totalLoanCost / (m.loanTenureYears * 365);
             if (m.assignmentDate) {
                 const daysOnSite = differenceInDays(new Date(), new Date(m.assignmentDate)) + 1;
                 if (daysOnSite > 0) {
                     accruedCost = dailyCost * daysOnSite;
                     description = `Accrued Loan Cost for ${m.name}`;
                 }
            }
        }

        if (description) {
            log.push({
                id: `accrued-${m.id}`,
                machine: m,
                description: description,
                date: 'Live',
                cost: accruedCost
            });
        } else if (m.acquisition === 'Company-Owned') {
             // Catch-all for Company-Owned without loan or daily price
            log.push({
                id: `owned-${m.id}`,
                machine: m,
                description: 'Not Applicable (Company-Owned)',
                date: '-',
                cost: 0,
            });
        }
        processedMachineIds.add(m.id);
    });

    return log.sort((a,b) => (a.date === 'Live' ? -1 : b.date === 'Live' ? 1 : b.date === '-' ? 1 : a.date === '-' ? -1 : new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, [siteMachines, allMachineAttendances, siteExpenses, allMachines]);


  return (
    <>
    <div className="space-y-6">
       <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><IndianRupee />Machine Cost Summary</CardTitle>
            <CardDescription>Total costs for all machines assigned to this site.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Maintenance Cost</CardTitle>
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalMaintenanceCost.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Fuel Cost</CardTitle>
                    <Fuel className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalFuelCost.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rental & EMI Cost</CardTitle>
                    <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalRentalAndEmiCost.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card className="bg-primary text-primary-foreground">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Machine Cost</CardTitle>
                    <IndianRupee className="h-4 w-4 text-primary-foreground/70" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{totalMachineCost.toLocaleString()}</div>
                </CardContent>
              </Card>
          </CardContent>
        </Card>
        
        {isMachineFormOpen && (
            <Card>
                <CardHeader>
                    <CardTitle>{selectedMachine ? 'Edit' : 'Add New'} Machine</CardTitle>
                    <CardDescription>Fill in the details of the machine. It will be automatically assigned to this site.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...machineForm}>
                        <form onSubmit={machineForm.handleSubmit(onMachineSubmit)} className="space-y-4">
                        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                             <FormField control={machineForm.control} name="dailyRentalPrice" render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Daily Rental Price (₹) (for rented or internal costing)</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 2000" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                                )} />

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
                            <Button type="button" variant="ghost" onClick={() => {setIsMachineFormOpen(false); setSelectedMachine(null)}}>Cancel</Button>
                            <Button type="submit">
                            {selectedMachine ? 'Save Changes' : 'Add Machine'}
                            </Button>
                        </CardFooter>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        )}

      <Card>
          <CardHeader className="flex flex-row items-center justify-between">
              <div>
                  <CardTitle className="flex items-center gap-2"><Truck /> Machines On Site</CardTitle>
                  <CardDescription>All machines currently assigned to this project. Release them to make them available for other sites.</CardDescription>
              </div>
              <Button onClick={() => handleOpenMachineForm()}><Plus className="mr-2 h-4 w-4" /> Add Machine</Button>
          </CardHeader>
          <CardContent>
              {siteMachines.length > 0 ? (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Machine Name</TableHead>
                          <TableHead>Vehicle Number</TableHead>
                          <TableHead>Acquisition</TableHead>
                          <TableHead>Date Assigned</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {siteMachines.map(machine => (
                          <TableRow key={machine.id}>
                            <TableCell className="font-medium">{machine.name}</TableCell>
                            <TableCell>{machine.vehicleNumber}</TableCell>
                            <TableCell>
                                <Badge variant={machine.acquisition === 'Rented' ? 'secondary' : 'outline'}>
                                    {machine.acquisition}
                                </Badge>
                            </TableCell>
                            <TableCell>{machine.assignmentDate ? format(new Date(machine.assignmentDate), 'PPP') : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleOpenReleaseDialog(machine)}>
                                <LogOut className="mr-2 h-4 w-4" /> Release
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
              ) : (
                  <p className="text-sm text-muted-foreground">No machines are currently assigned to this site.</p>
              )}
          </CardContent>
      </Card>
        
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Truck /> Rental & EMI Log</CardTitle>
          <CardDescription>All rental and EMI costs for machines on this site.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentAndEmiLog.length > 0 ? (
                rentAndEmiLog.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.machine?.name || 'Unknown'}</TableCell>
                    <TableCell>{entry.description}</TableCell>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell className="text-right">
                        {entry.cost > 0 ? `₹${entry.cost.toLocaleString()}` : (entry.description.includes('Company-Owned') ? '₹0 (Company-Owned)' : '₹0')}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No rental or EMI costs found for this site's machines.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Fuel /> Fuel Log</CardTitle>
          <CardDescription>All fuel transactions for machines on this site.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Quantity (L)</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fuelLogs.length > 0 ? (
                fuelLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.vehicleName}</TableCell>
                    <TableCell>{log.date}</TableCell>
                    <TableCell>{log.quantity}</TableCell>
                    <TableCell className="text-right">₹{log.cost.toLocaleString()}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No fuel logs found for this site's machines.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wrench /> Maintenance Log</CardTitle>
          <CardDescription>All maintenance tasks for machines on this site.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Machine</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {maintenanceLogs.length > 0 ? (
                maintenanceLogs.map(log => {
                  const machine = siteMachines.find(m => m.id === log.machineId);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{machine?.name || 'Unknown'}</TableCell>
                      <TableCell>{log.task}</TableCell>
                      <TableCell>{log.scheduledDate}</TableCell>
                      <TableCell className="text-right">₹{log.cost?.toLocaleString() || 'N/A'}</TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No maintenance logs found for this site's machines.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
     {machineToRelease && userProfile?.companyId && (
        <FinalizeRentalDialog
            open={isFinalizeRentalOpen}
            onOpenChange={setIsFinalizeRentalOpen}
            material={machineToRelease}
            companyId={userProfile.companyId}
        />
     )}
    </>
  );
}

    

    
