
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Site, InventoryItem, Expense, MaintenanceLog, Labor, Machine, LaborTransaction, FuelLog, RentedMaterial, RentedMaterialAttendance, Theft, MachineAttendance, Sale, Tool } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { IndianRupee, Wrench, HardHat, Construction, Users, Download, Fuel, Siren } from 'lucide-react';
import { Button } from '../ui/button';
import { getSubCollection, onGlobalCollectionSnapshot, onSubCollectionSnapshot } from '@/context/site-context';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Separator } from '../ui/separator';
import { ExpenseBreakdownChart } from '../expense-breakdown-chart';
import { format, isAfter, eachDayOfInterval, differenceInDays } from 'date-fns';
import { useAuth } from '@/context/auth-context';
import { formatCurrency } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SummaryTabProps {
  site: Site;
  totalLaborWages: number;
  wageSummary: any[];
}

declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: any) => jsPDF;
    }
}

export function SummaryTab({ site, totalLaborWages, wageSummary }: SummaryTabProps) {
  const [materials, setMaterials] = useState<InventoryItem[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allMaintenanceLogs, setAllMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [allFuelLogs, setAllFuelLogs] = useState<FuelLog[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [labors, setLabors] = useState<Labor[]>([]);
  const [rentedMaterials, setRentedMaterials] = useState<RentedMaterial[]>([]);
  const [rentedMaterialAttendances, setRentedMaterialAttendances] = useState<RentedMaterialAttendance[]>([]);
  const [machineAttendances, setMachineAttendances] = useState<MachineAttendance[]>([]);
  const [thefts, setThefts] = useState<Theft[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const today = new Date();

  useEffect(() => {
    if (!site?.id || !site?.companyId) return;
    setLoading(true);
    const companyId = site.companyId;
    const collectionsToLoad = [
        'expenses', 'labors', 'inventory', 'machines',
        'maintenance_logs', 'fuel_logs', 'rented_materials', 
        'rented_material_attendances', 'thefts', 'machine_attendances', 'sales', 'tools'
    ];
    let loadedCount = 0;

    const onDataLoaded = () => {
        loadedCount++;
        if (loadedCount === collectionsToLoad.length) {
            setLoading(false);
        }
    };
    
    const unsubs = [
        onSubCollectionSnapshot<Expense>('expenses', companyId, site.id, (data) => { setExpenses(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Labor>('labors', companyId, (data) => { setLabors(data.filter(l => l.siteId === site.id)); onDataLoaded(); }),
        onSubCollectionSnapshot<InventoryItem>('inventory', companyId, site.id, (items) => { setMaterials(items.filter(item => item.type === 'Material')); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Machine>('machines', companyId, (data) => { setAllMachines(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, (data) => { setAllMaintenanceLogs(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<FuelLog>('fuel_logs', companyId, (data) => { setAllFuelLogs(data); onDataLoaded(); }),
        onSubCollectionSnapshot<RentedMaterial>('rented_materials', companyId, site.id, (data) => { setRentedMaterials(data); onDataLoaded(); }),
        onSubCollectionSnapshot<RentedMaterialAttendance>('rented_material_attendances', companyId, site.id, (data) => { setRentedMaterialAttendances(data); onDataLoaded(); }),
        onSubCollectionSnapshot<Theft>('thefts', companyId, site.id, (data) => { setThefts(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<MachineAttendance>('machine_attendances', companyId, (data) => { setMachineAttendances(data); onDataLoaded(); }),
        onSubCollectionSnapshot<Sale>('sales', companyId, site.id, (data) => { setSales(data); onDataLoaded(); }),
        onSubCollectionSnapshot<Tool>('tools', companyId, site.id, (data) => { setTools(data); onDataLoaded(); }),
    ];

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [site.id, site.companyId]);

  const siteMachines = useMemo(() => allMachines.filter(m => m.assignedSiteId === site.id), [allMachines, site.id]);
  const machineIdsOnSite = useMemo(() => siteMachines.map(m => m.id), [siteMachines]);

  const siteExpenseBreakdown = useMemo(() => {
    const dataMap = new Map<string, number>();

    const totalWagesPaid = wageSummary.reduce((acc, s) => acc + s.totalPaid, 0);
    if (totalWagesPaid > 0) dataMap.set('Labor', totalWagesPaid);
    
    const totalMaterialsCost = materials
      .filter(item => item.status === 'Bought' && !item.isDeleted)
      .reduce((acc, item) => acc + (item.quantity * (item.pricePerUnit || 0)), 0);
    if (totalMaterialsCost > 0) dataMap.set('Materials', totalMaterialsCost);
    
    const totalMaintenanceCost = allMaintenanceLogs
        .filter(l => !l.isDeleted && machineIdsOnSite.includes(l.machineId) && l.costAllocation === 'Site Expenses')
        .reduce((acc, m) => acc + (m.cost || 0), 0);
    if (totalMaintenanceCost > 0) dataMap.set('Maintenance', totalMaintenanceCost);

    const siteFuelCost = allFuelLogs
      .filter(log => log.siteId === site.id && !log.isDeleted)
      .reduce((acc, f) => acc + f.cost, 0);
    if (siteFuelCost > 0) dataMap.set('Fuel', siteFuelCost);
    
    let totalRentalCost = 0;
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
        totalRentalCost += item.rentPerDay * item.quantity * daysUsed;
    });
    
    siteMachines
      .filter(m => m.acquisition === 'Rented' && m.dailyRentalPrice && m.assignmentDate)
      .forEach(machine => {
        const startDate = new Date(machine.assignmentDate!);
        if (isAfter(startDate, today)) return;

        const rentalPeriod = eachDayOfInterval({ start: startDate, end: today });
        const machineAttendanceForMachine = machineAttendances.filter(a => a.machineId === machine.id);

        rentalPeriod.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const attendance = machineAttendanceForMachine.find(a => a.date === dateStr);
            const status = attendance?.status || 'Unmarked';
            if (status === 'Present' || status === 'Unmarked') {
              totalRentalCost += machine.dailyRentalPrice!;
            } else if (status === 'Half-day') {
              totalRentalCost += machine.dailyRentalPrice! / 2;
            }
        });
      });

    if (totalRentalCost > 0) dataMap.set('Rental', totalRentalCost);

    const totalEmiCost = expenses.filter(e => e.category === 'EMI' && !e.isDeleted).reduce((acc, e) => acc + e.amount, 0);
    if (totalEmiCost > 0) dataMap.set('EMI', totalEmiCost);

    const totalToolCost = tools
      .filter(tool => !tool.isDeleted && tool.price)
      .reduce((acc, tool) => acc + (tool.price!), 0);
    if (totalToolCost > 0) dataMap.set('Tools', totalToolCost);

    const otherCategories = ['Transport', 'Other'];
    otherCategories.forEach(category => {
        const categoryCost = expenses
            .filter(e => e.category === category && !e.isDeleted)
            .reduce((acc, e) => acc + e.amount, 0);
        if (categoryCost > 0) dataMap.set(category, (dataMap.get(category) || 0) + categoryCost);
    });
    
    return Array.from(dataMap.entries()).map(([name, value]) => ({ name, value }));

  }, [expenses, wageSummary, siteMachines, allMaintenanceLogs, allFuelLogs, materials, rentedMaterials, rentedMaterialAttendances, machineAttendances, machineIdsOnSite, site.id, today, tools]);

  const totalSiteExpenses = useMemo(() => {
    return siteExpenseBreakdown.reduce((acc, item) => acc + item.value, 0);
  }, [siteExpenseBreakdown]);


  const handleExportPDF = async () => {
    if (!site?.companyId) return;
  
    const doc = new jsPDF();
    let yPos = 20;
  
    const addSection = (title: string, headers: any[], data: any[][], footers?: any[][]) => {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.text(title, 14, yPos);
      yPos += 8;
      doc.autoTable({
        head: [headers],
        body: data,
        foot: footers,
        startY: yPos,
        theme: 'grid',
        headStyles: { fillColor: [44, 62, 80] },
        footStyles: { fillColor: [236, 240, 241], textColor: [44, 62, 80], fontStyle: 'bold' }
      });
      yPos = (doc as any).lastAutoTable.finalY + 15;
    };
  
    doc.setFontSize(28);
    doc.text(`Site Report: ${site.name}`, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += 20;
  
    doc.setFontSize(12);
    doc.text(`Generated On: ${format(new Date(), 'PPP')}`, 14, yPos);
    doc.text(`Generated By: ${userProfile?.email || 'Unknown User'}`, doc.internal.pageSize.getWidth() - 14, yPos, { align: 'right' });
    yPos += 15;
  
    doc.autoTable({
      body: [
        ['Site Status', site.status],
        ['Project Budget', formatCurrency(site.budget)],
        ['Total Site Expenses', formatCurrency(totalSiteExpenses)],
      ],
      startY: yPos,
      theme: 'plain'
    });
    yPos = (doc as any).lastAutoTable.finalY + 20;
  
    const machineAndRentalCost = (siteExpenseBreakdown.find(i => i.name === 'Rental')?.value || 0) +
                                 (siteExpenseBreakdown.find(i => i.name === 'EMI')?.value || 0) +
                                 (siteExpenseBreakdown.find(i => i.name === 'Fuel')?.value || 0) +
                                 (siteExpenseBreakdown.find(i => i.name === 'Maintenance')?.value || 0);

    const expenseBreakdownForPDF = siteExpenseBreakdown
      .filter(item => !['Rental', 'EMI', 'Fuel', 'Maintenance'].includes(item.name))
      .concat({ name: 'Machine & Rental Costs', value: machineAndRentalCost })
      .filter(item => item.value > 0)
      .sort((a,b) => b.value - a.value);

    addSection(
      'Expense Breakdown',
      ['Category', 'Total Cost', 'Percentage'],
      expenseBreakdownForPDF.map(item => [
        item.name,
        formatCurrency(item.value),
        `${totalSiteExpenses > 0 ? ((item.value / totalSiteExpenses) * 100).toFixed(2) : '0.00'}%`
      ]),
      [['Total', formatCurrency(totalSiteExpenses), '100.00%']]
    );
  
    if (site.type === 'Manufacturing' && sales.length > 0) {
    }
  
    const materialCostFromBreakdown = siteExpenseBreakdown.find(i=>i.name === 'Materials')?.value || 0;
    addSection(
        'Materials Summary',
        ['Material', 'Quantity', 'Unit', 'Rate', 'Total Cost'],
        materials.filter(m => m.status === 'Bought' && !m.isDeleted).map(m => [
            m.name, m.quantity, m.unit || 'N/A', formatCurrency(m.pricePerUnit), formatCurrency(m.quantity * (m.pricePerUnit || 0))
        ]),
        [['Total', '', '', '', formatCurrency(materialCostFromBreakdown)]]
    );

    const laborCostFromBreakdown = totalLaborWages;
    
    const rentedMaterialsData = rentedMaterials.filter(r => !r.isDeleted).map(item => {
        const endDate = item.status === 'Returned' && item.returnDate ? new Date(item.returnDate) : new Date();
        const rentalPeriod = eachDayOfInterval({ start: new Date(item.startDate), end: endDate });
        let daysUsed = 0;
        rentalPeriod.forEach(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const attendance = rentedMaterialAttendances.find(a => a.rentedMaterialId === item.id && a.date === dateStr);
            if (!attendance || attendance.status === 'Used') {
                daysUsed++;
            }
        });

        const totalCost = daysUsed * item.rentPerDay * item.quantity;
        const totalPaid = (item.paymentHistory || []).reduce((acc, p) => acc + p.amount, 0);
        return {
            name: item.materialName,
            qty: item.quantity,
            rentPerDay: item.rentPerDay,
            totalCost: totalCost,
            paid: totalPaid,
            balance: totalCost - totalPaid,
            vendor: item.rentedFrom,
            status: item.status
        };
    });

    const rentedMachinesData = siteMachines.filter(m => m.acquisition === 'Rented').map(m => {
        let totalCost = 0;
        if (m.dailyRentalPrice && m.assignmentDate) {
            const rentalPeriod = eachDayOfInterval({ start: new Date(m.assignmentDate), end: today });
            rentalPeriod.forEach(day => {
                const attendance = machineAttendances.find(a => a.machineId === m.id && a.date === format(day, 'yyyy-MM-dd'));
                const status = attendance?.status || 'Unmarked';
                if(status === 'Present' || status === 'Unmarked') totalCost += m.dailyRentalPrice!;
                else if(status === 'Half-day') totalCost += m.dailyRentalPrice! / 2;
            });
        }
        const totalPaid = expenses.filter(e => e.machineId === m.id && e.category === 'Rental').reduce((sum, e) => sum + e.amount, 0);
        
        return {
            name: m.name,
            qty: 1,
            rentPerDay: m.dailyRentalPrice || 0,
            totalCost: totalCost,
            paid: totalPaid,
            balance: totalCost - totalPaid,
            vendor: 'N/A',
            status: 'Active'
        };
    });
    
    const allRentalsData = [...rentedMaterialsData, ...rentedMachinesData];

    const totalRentalCost = allRentalsData.reduce((sum, row) => sum + row.totalCost, 0);
    const totalRentalPaid = allRentalsData.reduce((sum, row) => sum + row.paid, 0);
    const totalRentalBalance = allRentalsData.reduce((sum, row) => sum + row.balance, 0);
  
    addSection(
        'Rented Items (Materials & Machines)',
        ['Item', 'Qty', 'Rent/Day', 'Total Cost', 'Paid', 'Balance', 'Vendor', 'Status'],
        allRentalsData.map(item => [
            item.name,
            item.qty,
            formatCurrency(item.rentPerDay),
            formatCurrency(item.totalCost),
            formatCurrency(item.paid),
            formatCurrency(item.balance),
            item.vendor || 'N/A',
            item.status,
        ]),
        [['Total', '', '', formatCurrency(totalRentalCost), formatCurrency(totalRentalPaid), formatCurrency(totalRentalBalance), '', '']]
    );
  
    const machineLogs = [
        ...allMaintenanceLogs.filter(log => machineIdsOnSite.includes(log.machineId) && !log.isDeleted).map(log => [allMachines.find(m=>m.id === log.machineId)?.name || 'Unknown', 'Maintenance: ' + log.task, log.scheduledDate, formatCurrency(log.cost)]),
        ...allFuelLogs.filter(log => log.siteId === site.id && !log.isDeleted).map(log => [log.vehicleName, `Fuel: ${log.quantity}L ${log.fuelType}`, log.date, formatCurrency(log.cost)]),
    ];
    addSection(
        'Machine Costs (Fuel & Maintenance)',
        ['Machine', 'Description', 'Date', 'Cost'],
        machineLogs
    );
  
    const miscExpensesData = expenses.filter(e => !e.isDeleted && e.category !== 'Rental' && e.category !== 'EMI' && e.category !== 'Materials' && e.category !== 'Labor').map(e => [e.category, e.description, formatCurrency(e.amount), e.date]);
    addSection(
        'Miscellaneous Expenses',
        ['Type', 'Description', 'Amount', 'Date'],
        miscExpensesData
    );
  
    if(thefts.length > 0) {
        addSection('Theft / Incident Logs', ['Date', 'Item', 'Estimated Loss', 'Remarks'], thefts.filter(t => !t.isDeleted).map(t => [t.date, t.item, formatCurrency(t.value), t.details || 'N/A']));
    }
    
    doc.addPage();
    yPos = 20;
    doc.setFontSize(18);
    doc.text('Financial Summary', 14, yPos);
    yPos += 15;
    
    const finalMaterialCost = siteExpenseBreakdown.find(i => i.name === 'Materials')?.value || 0;
    const finalMiscExpenses = totalSiteExpenses - (finalMaterialCost + totalLaborWages + machineAndRentalCost);
  
    const finalTableData = [
        ['Total Material Cost', formatCurrency(finalMaterialCost)],
        ['Total Labor Wages (Paid)', formatCurrency(totalLaborWages)],
        ['Total Machine & Rental Costs', formatCurrency(machineAndRentalCost)],
        ['Total Miscellaneous Expenses', formatCurrency(finalMiscExpenses)],
        ['', ''],
        ['TOTAL SITE EXPENSES', formatCurrency(totalSiteExpenses)],
        ['PROJECT BUDGET', formatCurrency(site.budget)],
        ['BALANCE REMAINING', formatCurrency((site.budget || 0) - totalSiteExpenses)],
    ];
    doc.autoTable({
        body: finalTableData,
        startY: yPos,
        theme: 'plain',
        bodyStyles: { fontStyle: 'bold' }
    });
    
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
        doc.text('Generated by MANGEMENT', 14, doc.internal.pageSize.getHeight() - 10);
    }
  
    doc.save(`site-report-${site.name.toLowerCase().replace(/\s/g, '-')}.pdf`);
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Site Summary</CardTitle>
            <CardDescription>An overview of this site's metrics (active items only).</CardDescription>
        </div>
        <Button onClick={handleExportPDF} variant="outline" size="sm" disabled={loading}>
            <Download className="mr-2 h-4 w-4" />
            Export Full PDF Report
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
              <HardHat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{new Set(materials.filter(i => !i.isDeleted).map(i => i.name)).size} types</div>
              <p className="text-xs text-muted-foreground">Different material items logged</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
              <Construction className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{siteMachines.length} units</div>
              <p className="text-xs text-muted-foreground">Total machines on site</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Laborers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{labors.filter(l => !l.isDeleted).length} workers</div>
              <p className="text-xs text-muted-foreground">Currently on the roster</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Site Expenses</CardTitle>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalSiteExpenses)}</div>
              <p className="text-xs text-muted-foreground">Sum of all expenses on this site</p>
            </CardContent>
          </Card>
        </div>
        <Separator />
        <div className="pt-4">
            <Card className="border-0 shadow-none">
                <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
                    <CardDescription>A visual summary of expenses for this site.</CardDescription>
                </CardHeader>
                <CardContent className="h-auto">
                     <ExpenseBreakdownChart 
                        title="Site Expense Breakdown"
                        expenseData={siteExpenseBreakdown}
                        totalExpenses={totalSiteExpenses}
                        isLoading={loading}
                        budget={site.budget}
                     />
                </CardContent>
            </Card>
        </div>
      </CardContent>
    </Card>
  );
}
