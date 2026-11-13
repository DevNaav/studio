
'use client';

import { Site, Company, Labor, LaborTransaction, Attendance, WorkLog, InventoryItem, Machine, MaintenanceLog, FuelLog, RentedMaterial, RentedMaterialAttendance, Expense, Theft, Sale, Tool, MachineAttendance } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { SummaryTab } from './tabs/summary-tab';
import { ExpensesTab } from './tabs/expenses-tab';
import { Edit, Trash2, ShieldCheck, HardHat } from 'lucide-react';
import { Button } from './ui/button';
import { useSite, onSubCollectionSnapshot, onGlobalCollectionSnapshot } from '@/context/site-context';
import { useState, lazy, useEffect, useMemo } from 'react';
import { AddSiteDialog } from './add-site-dialog';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { MaterialsTab } from './tabs/materials-tab';
import { LaborTab } from './tabs/labor-tab';
import { DocumentsTab } from './tabs/documents-tab';
import { useAuth } from '@/context/auth-context';
import { MachineCostsTab } from './tabs/machine-costs-tab';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { TheftTab } from './tabs/theft-tab';
import { OrderMaterialsTab } from './tabs/order-materials-tab';
import { SalesPage } from './sales-page';
import { TasksTab } from './tabs/tasks-tab';
import { CompleteSiteDialog } from './complete-site-dialog';
import { RentedMaterialsTab } from './tabs/rented-materials-tab';
import { PaymentTab } from './tabs/payment-tab';
import { ToolsTab } from './tabs/tools-tab';
import { format, isBefore, eachDayOfInterval, isValid, isAfter, differenceInDays, differenceInMonths } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { Separator } from './ui/separator';
import { sumDirectExpenses } from '@/lib/costs';

interface SiteDetailsProps {
  site: Site;
  companyId?: string | null;
  company?: Company;
}

export function SiteDetails({ site, companyId, company }: SiteDetailsProps) {
  const { deleteSite } = useSite();
  const { isAdmin } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  // State for data needed by both Summary and Labor tabs
  const [labors, setLabors] = useState<Labor[]>([]);
  const [allAttendances, setAllAttendances] = useState<Attendance[]>([]);
  const [transactions, setTransactions] = useState<LaborTransaction[]>([]);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  
  // State for data needed by Summary and Payment tabs
  const [materials, setMaterials] = useState<InventoryItem[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allMaintenanceLogs, setAllMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [allFuelLogs, setAllFuelLogs] = useState<FuelLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [rentedMaterials, setRentedMaterials] = useState<RentedMaterial[]>([]);
  const [rentedMaterialAttendances, setRentedMaterialAttendances] = useState<RentedMaterialAttendance[]>([]);
  const [machineAttendances, setMachineAttendances] = useState<MachineAttendance[]>([]);
  const [thefts, setThefts] = useState<Theft[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);

  const today = new Date();

  useEffect(() => {
    if (!site?.id || !site?.companyId) return;
    const companyId = site.companyId;

    const unsubs = [
      onGlobalCollectionSnapshot<Labor>('labors', companyId, (data) => setLabors(data.filter(l => l.siteId === site.id && !l.isDeleted))),
      onSubCollectionSnapshot<Attendance>('attendances', companyId, site.id, setAllAttendances),
      onSubCollectionSnapshot<LaborTransaction>('labor_transactions', companyId, site.id, setTransactions),
      onSubCollectionSnapshot<WorkLog>('work_logs', companyId, site.id, setWorkLogs),
      onSubCollectionSnapshot<InventoryItem>('inventory', companyId, site.id, (items) => setMaterials(items.filter(item => item.type === 'Material'))),
      onGlobalCollectionSnapshot<Machine>('machines', companyId, setAllMachines),
      onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, setAllMaintenanceLogs),
      onGlobalCollectionSnapshot<FuelLog>('fuel_logs', companyId, setAllFuelLogs),
      onSubCollectionSnapshot<Expense>('expenses', companyId, site.id, setExpenses),
      onSubCollectionSnapshot<RentedMaterial>('rented_materials', companyId, site.id, setRentedMaterials),
      onSubCollectionSnapshot<RentedMaterialAttendance>('rented_material_attendances', companyId, site.id, setRentedMaterialAttendances),
      onSubCollectionSnapshot<Theft>('thefts', companyId, site.id, setThefts),
      onGlobalCollectionSnapshot<MachineAttendance>('machine_attendances', companyId, setMachineAttendances),
      onSubCollectionSnapshot<Sale>('sales', companyId, site.id, setSales),
      onSubCollectionSnapshot<Tool>('tools', companyId, site.id, setTools),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [site.id, site.companyId]);

    const wageSummary = useMemo(() => {
    return labors.map(labor => {
        const laborTransactions = transactions.filter(t => t.laborId === labor.id && !t.isDeleted);
        const totalPaid = laborTransactions.filter(t => t.type === 'Payment').reduce((sum, t) => sum + t.amount, 0);

        let totalWages = 0;
        let daysWorked = 0;
        const joiningDate = labor.dateOfJoining ? new Date(labor.dateOfJoining) : null;
        
        if (labor.wageType === 'Contract') {
            totalWages = workLogs.filter(log => log.laborerId === labor.id && !log.isDeleted).reduce((sum, log) => sum + log.wageEarned, 0);
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
  
  const totalLaborWages = useMemo(() => {
    return wageSummary.reduce((acc, s) => acc + s.totalWages, 0);
  }, [wageSummary]);
  
  const totalSiteExpenses = useMemo(() => {
    const siteMachines = allMachines.filter(m => m.assignedSiteId === site.id && !m.isDeleted);
    const machineIdsOnSite = siteMachines.map(m => m.id);

    const laborCost = wageSummary.reduce((acc, s) => acc + s.totalWages, 0);
    
    const materialsCost = materials.filter(i => i.status === 'Bought' && !i.isDeleted).reduce((sum, i) => sum + (i.quantity * (i.pricePerUnit || 0)), 0);
    const maintenanceCost = allMaintenanceLogs.filter(l => !l.isDeleted && machineIdsOnSite.includes(l.machineId) && l.costAllocation === 'Site Expenses').reduce((sum, l) => sum + (l.cost || 0), 0);
    const fuelCost = allFuelLogs.filter(f => f.siteId === site.id && !f.isDeleted).reduce((sum, f) => sum + f.cost, 0);
    // Only direct expenses: material-transfer and rental-settlement expenses are already
    // counted in materials and rent above, so adding every expense counted them twice.
    const otherExpensesCost = sumDirectExpenses(expenses);
    const toolCost = tools.filter(t => !t.isDeleted).reduce((sum, t) => sum + (t.price || 0), 0);

    let rentalCost = 0;
    rentedMaterials.filter(item => !item.isDeleted).forEach(item => {
        const endDate = item.status === 'Returned' && item.returnDate ? new Date(item.returnDate) : today;
        let daysUsed = 0;
        if (isAfter(endDate, new Date(item.startDate))) {
            const rentalPeriod = eachDayOfInterval({ start: new Date(item.startDate), end: endDate });
            rentalPeriod.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const attendance = rentedMaterialAttendances.find(a => a.rentedMaterialId === item.id && a.date === dateStr);
                if (!attendance || attendance.status === 'Used') {
                    daysUsed++;
                }
            });
        }
        rentalCost += item.rentPerDay * item.quantity * daysUsed;
    });

    siteMachines.filter(m => m.acquisition === 'Rented' && m.dailyRentalPrice && m.assignmentDate).forEach(machine => {
        const startDate = new Date(machine.assignmentDate!);
        // A machine booked for a future date costs nothing yet. (date-fns 3 returns the days
        // *between* the dates when start is after end, which used to bill those days.)
        if (!isValid(startDate) || isAfter(startDate, today)) return;
        const rentalPeriod = eachDayOfInterval({ start: startDate, end: today });
        rentalPeriod.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const attendance = machineAttendances.find(a => a.machineId === machine.id && a.date === dateStr);
            const status = attendance?.status || 'Unmarked';
            if (status === 'Present' || status === 'Unmarked') rentalCost += machine.dailyRentalPrice!;
            else if (status === 'Half-day') rentalCost += machine.dailyRentalPrice! / 2;
        });
    });

    return laborCost +
           materialsCost +
           maintenanceCost +
           fuelCost +
           otherExpensesCost +
           toolCost +
           rentalCost;
  }, [
    wageSummary, materials, allMachines, site.id, allMaintenanceLogs, 
    allFuelLogs, expenses, tools, rentedMaterials, rentedMaterialAttendances, machineAttendances, today
  ]);

  const getStatusVariant = (status: Site['status']) => {
    switch (status) {
      case 'Active': return 'default';
      case 'Planning': return 'secondary';
      case 'Completed': case 'Warranty Pending': return 'outline';
      case 'On Hold': return 'destructive';
      default: return 'default';
    }
  };

  const isManufacturing = site.type === 'Manufacturing';
  const isCompletable = site.status === 'Active' || site.status === 'Planning';

  const navItems = [
    { value: 'summary', label: 'Summary' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'materials', label: 'Materials' },
    { value: 'tools', label: 'Tools' },
    { value: 'rented-materials', label: 'Rented Materials' },
    { value: 'labor', label: 'Labor' },
    { value: 'machine-costs', label: 'Machine Costs' },
    { value: 'expenses', label: 'Expenses' },
    { value: 'documents', label: 'Documents' },
    { value: 'theft', label: 'Theft' },
    { value: 'payments', label: 'Payments' },
    ...(isManufacturing ? [{ value: 'sales', label: 'Sales & Transfers' }] : []),
    ...(company?.enableOrderMaterials ? [{ value: 'order-materials', label: 'Order Materials' }] : []),
  ];

  return (
    <div className="space-y-6">
      <Card className="border-transparent">
        <CardHeader className="flex flex-row items-start justify-between">
            <div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <HardHat className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-bold">{site.name}</CardTitle>
                    <CardDescription className="mt-1">{site.location}</CardDescription>
                  </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(site.status)} className="text-base px-3 py-1">{site.status}</Badge>
                {isAdmin && (
                  <>
                    {isCompletable && (
                        <Button variant="outline" size="icon" onClick={() => setIsCompleteDialogOpen(true)}>
                            <ShieldCheck className="h-4 w-4" />
                            <span className="sr-only">Mark as Completed</span>
                        </Button>
                    )}
                    <Button variant="outline" size="icon" onClick={() => setIsEditDialogOpen(true)}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit Site</span>
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => setIsDeleteDialogOpen(true)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Site</span>
                    </Button>
                  </>
                )}
            </div>
        </CardHeader>
      </Card>
      
      <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full whitespace-nowrap">
            <TabsList>
            {navItems.map(item => (
                <TabsTrigger key={item.value} value={item.value}>
                {item.label}
                </TabsTrigger>
            ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="mt-6">
          <TabsContent value="summary">
            <SummaryTab site={site} totalLaborWages={totalLaborWages} wageSummary={wageSummary} />
          </TabsContent>
          <TabsContent value="tasks">
            <TasksTab site={site} />
          </TabsContent>
          <TabsContent value="materials">
            <MaterialsTab siteId={site.id} companyId={companyId} />
          </TabsContent>
          <TabsContent value="tools">
            <ToolsTab siteId={site.id} companyId={companyId} />
          </TabsContent>
          <TabsContent value="rented-materials">
            <RentedMaterialsTab siteId={site.id} />
          </TabsContent>
          <TabsContent value="labor">
            <LaborTab site={site} wageSummary={wageSummary} company={company} />
          </TabsContent>
          <TabsContent value="machine-costs">
            <MachineCostsTab site={site} />
          </TabsContent>
          <TabsContent value="expenses">
            <ExpensesTab siteId={site.id} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab siteId={site.id} />
          </TabsContent>
          <TabsContent value="theft">
            <TheftTab siteId={site.id} />
          </TabsContent>
          <TabsContent value="payments">
            <PaymentTab siteId={site.id} totalSiteExpenses={totalSiteExpenses} />
          </TabsContent>
          {isManufacturing && (
            <TabsContent value="sales">
              <SalesPage companyId={companyId} siteId={site.id} />
            </TabsContent>
          )}
          {company?.enableOrderMaterials && (
            <TabsContent value="order-materials">
              <OrderMaterialsTab siteId={site.id} />
            </TabsContent>
          )}
        </div>
      </Tabs>


      <AddSiteDialog 
        open={isEditDialogOpen} 
        onOpenChange={setIsEditDialogOpen} 
        site={site} 
      />
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen} 
        onOpenChange={setIsDeleteDialogOpen} 
        onConfirm={async () => await deleteSite(site.id)}
        title="Delete Site"
        description={`Are you sure you want to delete the site "${site.name}"? This will permanently remove all associated data. This action cannot be undone.`}
      />
      {isCompleteDialogOpen && (
        <CompleteSiteDialog
          open={isCompleteDialogOpen}
          onOpenChange={setIsCompleteDialogOpen}
          site={site}
          company={company}
        />
      )}
    </div>
  );
}

    
