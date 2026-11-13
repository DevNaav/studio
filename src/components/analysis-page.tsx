

'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/context/auth-context';
import { onGlobalCollectionSnapshot } from '@/context/site-context';
import { Expense, InventoryItem, LaborTransaction, Site, Sale, Machine, RentedMaterial, RentedMaterialAttendance, MachineAttendance, MaintenanceLog, FuelLog, Tool } from '@/lib/types';
import { Loader2, Briefcase, IndianRupee, HardHat, TrendingUp, Factory, Warehouse, Wrench, Tractor, Printer, Download } from 'lucide-react';
import { format, isAfter, isBefore, isEqual, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from './ui/select';
import { ExpenseBreakdownChart } from './expense-breakdown-chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Progress } from './ui/progress';
import { formatCurrency } from '@/lib/utils';
import { Button } from './ui/button';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { saleProfit, sumDirectExpenses } from '@/lib/costs';

interface AnalysisPageProps {
  companyId: string | null | undefined;
}

export function AnalysisPage({ companyId }: AnalysisPageProps) {
  const [dateRange, setDateRange] = useState({
    from: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    to: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [view, setView] = useState('all-sites');
  const [sites, setSites] = useState<Site[]>([]);
  const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allLaborTransactions, setAllLaborTransactions] = useState<LaborTransaction[]>([]);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const [allRentedMaterials, setAllRentedMaterials] = useState<RentedMaterial[]>([]);
  const [allRentedMaterialAttendances, setAllRentedMaterialAttendances] = useState<RentedMaterialAttendance[]>([]);
  const [allMachineAttendances, setAllMachineAttendances] = useState<MachineAttendance[]>([]);
  const [allMaintenanceLogs, setAllMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [allFuelLogs, setAllFuelLogs] = useState<FuelLog[]>([]);
  const [allTools, setAllTools] = useState<Tool[]>([]);

  const pageRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const collectionsToLoad = 12; // Increased to 12
    let collectionsLoaded = 0;
    const onDataLoaded = () => {
      collectionsLoaded++;
      if (collectionsLoaded >= collectionsToLoad) {
        setLoading(false);
      }
    };
    
    const unsubs = [
        onGlobalCollectionSnapshot<Site>('sites', companyId, (data) => { setSites(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<InventoryItem>('inventory', companyId, (data) => { setAllInventory(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Expense>('expenses', companyId, (data) => { setAllExpenses(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<LaborTransaction>('labor_transactions', companyId, (data) => { setAllLaborTransactions(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Sale>('sales', companyId, (data) => { setAllSales(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Machine>('machines', companyId, (data) => { setAllMachines(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<RentedMaterial>('rented_materials', companyId, (data) => { setAllRentedMaterials(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<RentedMaterialAttendance>('rented_material_attendances', companyId, (data) => { setAllRentedMaterialAttendances(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<MachineAttendance>('machine_attendances', companyId, (data) => { setAllMachineAttendances(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, (data) => { setAllMaintenanceLogs(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<FuelLog>('fuel_logs', companyId, (data) => { setAllFuelLogs(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Tool>('tools', companyId, (data) => { setAllTools(data); onDataLoaded(); }),
    ];

    return () => unsubs.forEach(unsub => unsub());

  }, [companyId]);

  const { constructionSites, manufacturingUnits } = useMemo(() => {
    const constructionSites = sites.filter(s => (s.type === 'Construction' || !s.type) && s.status !== 'Completed');
    const manufacturingUnits = sites.filter(s => s.type === 'Manufacturing' && s.status !== 'Completed');
    return { constructionSites, manufacturingUnits };
  }, [sites]);


  const isWithinDateRange = useCallback((itemDate: string) => {
    if (!dateRange.from || !dateRange.to) return true;
    try {
        const d = new Date(itemDate);
        if (isNaN(d.getTime())) return false; // Invalid date
        const fromDate = new Date(dateRange.from);
        const toDate = new Date(dateRange.to);
        // Set time to 00:00:00 for fromDate and 23:59:59 for toDate to include the whole days
        fromDate.setHours(0, 0, 0, 0);
        toDate.setHours(23, 59, 59, 999);
        return d >= fromDate && d <= toDate;
    } catch(e) {
        return false;
    }
  }, [dateRange]);

  const filterBySite = useCallback((item: { siteId?: string | null }) => {
    if (view === 'all-sites') return true;
    if (view === 'all-manufacturing') return !!manufacturingUnits.find(unit => unit.id === item.siteId);
    return item.siteId === view;
  }, [view, manufacturingUnits]);

  const filteredData = useMemo(() => {
    const expenses = allExpenses.filter(e => isWithinDateRange(e.date) && filterBySite(e));
    const labor = allLaborTransactions.filter(l => isWithinDateRange(l.date) && filterBySite(l));
    const sales = allSales.filter(s => isWithinDateRange(s.date) && filterBySite(s));
    const materials = allInventory.filter(i => i.type === 'Material' && i.status === 'Bought' && isWithinDateRange(i.date) && filterBySite(i));
    const inventoryItems = allInventory.filter(i => filterBySite(i));
    const machineLogs = allMaintenanceLogs.filter(l => isWithinDateRange(l.scheduledDate) && filterBySite({siteId: allMachines.find(m => m.id === l.machineId)?.assignedSiteId}));
    const fuelLogs = allFuelLogs.filter(f => isWithinDateRange(f.date) && filterBySite(f));
    const tools = allTools.filter(t => filterBySite(t));

    return { expenses, labor, sales, materials, inventoryItems, maintenanceLogs: machineLogs, fuelLogs, tools };

  }, [allExpenses, allLaborTransactions, allSales, allInventory, allMaintenanceLogs, allFuelLogs, allTools, allMachines, isWithinDateRange, filterBySite]);

  const siteSummaries = useMemo(() => {
    return constructionSites.map(site => {
      const siteExpenses = allExpenses.filter(e => e.siteId === site.id && isWithinDateRange(e.date));
      const siteLabor = allLaborTransactions.filter(l => l.siteId === site.id && isWithinDateRange(l.date));
      const siteMaterials = allInventory.filter(i => i.siteId === site.id && i.status === 'Bought' && isWithinDateRange(i.date));
      const siteTools = allTools.filter(t => t.siteId === site.id);
      
      const machineIdsOnSite = allMachines.filter(m => m.assignedSiteId === site.id).map(m => m.id);
      const siteMaintenanceCost = allMaintenanceLogs
          .filter(log => machineIdsOnSite.includes(log.machineId) && log.costAllocation === 'Site Expenses' && isWithinDateRange(log.scheduledDate))
          .reduce((sum, log) => sum + (log.cost || 0), 0);
      const siteFuelCost = allFuelLogs
          .filter(log => log.siteId === site.id && isWithinDateRange(log.date))
          .reduce((sum, log) => sum + log.cost, 0);

      // Material-transfer expenses are skipped: the same transfer is already a priced "Bought"
      // stock entry below. (Rent here comes from the settlement expenses, so those stay in.)
      const totalCost = siteExpenses.filter(e => e.category !== 'Materials').reduce((sum, e) => sum + e.amount, 0) +
                        siteLabor.filter(l => l.type === 'Payment').reduce((sum, l) => sum + l.amount, 0) +
                        siteMaterials.reduce((sum, m) => sum + (m.quantity * (m.pricePerUnit || 0)), 0) +
                        siteTools.reduce((sum, t) => sum + (t.price || 0), 0) +
                        siteMaintenanceCost + siteFuelCost;

      const budgetUsed = (site.budget && site.budget > 0) ? (totalCost / site.budget) * 100 : 0;

      return {
        ...site,
        totalCost,
        budgetUsed
      };
    });
  }, [constructionSites, allExpenses, allLaborTransactions, allInventory, allMachines, allMaintenanceLogs, allFuelLogs, allTools, isWithinDateRange]);

  const unitSummaries = useMemo(() => {
    return manufacturingUnits.map(unit => {
        const unitSales = allSales.filter(s => s.siteId === unit.id && isWithinDateRange(s.date));
        const productionCost = unitSales.reduce((sum, s) => sum + s.productionCost, 0);
        const totalSales = unitSales.reduce((sum, s) => sum + s.salePrice, 0);
        const transportCost = unitSales.reduce((sum, s) => sum + (s.transportCost || 0), 0);
        const profit = totalSales - productionCost - transportCost;

        return {
            ...unit,
            productionCost,
            totalSales,
            profit,
        }
    })
  }, [manufacturingUnits, allSales, isWithinDateRange])

  const kpiData = useMemo(() => {
    const dataMap = new Map<string, number>();
    
    let relevantSites = sites;
    if (view !== 'all-sites' && view !== 'all-manufacturing') {
      relevantSites = sites.filter(s => s.id === view);
    } else if (view === 'all-manufacturing') {
      relevantSites = manufacturingUnits;
    }

    const relevantSiteIds = new Set(relevantSites.map(s => s.id));

    const labor = allLaborTransactions.filter(l => isWithinDateRange(l.date) && relevantSiteIds.has(l.siteId || ''));
    const sales = allSales.filter(s => isWithinDateRange(s.date) && relevantSiteIds.has(s.siteId || ''));
    const materials = allInventory.filter(i => i.type === 'Material' && i.status === 'Bought' && isWithinDateRange(i.date) && relevantSiteIds.has(i.siteId || ''));
    const inventoryItems = allInventory.filter(i => relevantSiteIds.has(i.siteId || ''));
    const maintenanceLogs = allMaintenanceLogs.filter(l => isWithinDateRange(l.scheduledDate) && relevantSiteIds.has(allMachines.find(m => m.id === l.machineId)?.assignedSiteId || ''));
    const fuelLogs = allFuelLogs.filter(f => isWithinDateRange(f.date) && relevantSiteIds.has(f.siteId || ''));
    const tools = allTools.filter(t => filterBySite(t));
    const expenses = allExpenses.filter(e => isWithinDateRange(e.date) && relevantSiteIds.has(e.siteId || ''));

    const laborCost = labor.filter(l => l.type === 'Payment').reduce((sum, l) => sum + l.amount, 0);
    if(laborCost > 0) dataMap.set('Labor', laborCost);

    const materialsCost = materials.reduce((sum, m) => sum + (m.pricePerUnit || 0) * m.quantity, 0);
    if(materialsCost > 0) dataMap.set('Materials', materialsCost);

    const maintenanceCost = maintenanceLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
    if(maintenanceCost > 0) dataMap.set('Maintenance', maintenanceCost);

    const fuelCost = fuelLogs.reduce((sum, f) => sum + f.cost, 0);
    if(fuelCost > 0) dataMap.set('Fuel', fuelCost);
    
    let rentalCost = 0;
    allRentedMaterials.forEach(item => {
        if (item.status === 'Active' && relevantSiteIds.has(item.siteId)) {
            const rentalPeriod = eachDayOfInterval({ start: new Date(item.startDate), end: new Date(dateRange.to) });
            rentalPeriod.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                if (isWithinDateRange(dateStr)) {
                      const attendance = allRentedMaterialAttendances.find(a => a.rentedMaterialId === item.id && a.date === dateStr);
                      if (!attendance || attendance.status === 'Used') {
                          rentalCost += item.rentPerDay * item.quantity;
                      }
                }
            });
        }
    });

    allMachines.forEach(machine => {
        if (machine.acquisition === 'Rented' && machine.dailyRentalPrice && machine.assignedSiteId && relevantSiteIds.has(machine.assignedSiteId)) {
              const rentalPeriod = eachDayOfInterval({ start: new Date(machine.assignmentDate!), end: new Date(dateRange.to) });
              rentalPeriod.forEach(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                if (isWithinDateRange(dateStr)) {
                      const attendance = allMachineAttendances.find(a => a.machineId === machine.id && a.date === dateStr);
                      const status = attendance?.status || 'Unmarked';
                      if (status === 'Present' || status === 'Unmarked') rentalCost += machine.dailyRentalPrice!;
                      else if (status === 'Half-day') rentalCost += machine.dailyRentalPrice! / 2;
                }
              });
        }
    });
    if(rentalCost > 0) dataMap.set('Rental', rentalCost);

    const emiCost = expenses.filter(e => e.category === 'EMI').reduce((sum, e) => sum + e.amount, 0);
    if(emiCost > 0) dataMap.set('EMI', emiCost);

    const toolCost = tools.reduce((sum, t) => sum + (t.price || 0), 0);
    if(toolCost > 0) dataMap.set('Tools', toolCost);
    
    const transportCost = expenses.filter(e => e.category === 'Transport').reduce((acc, e) => acc + e.amount, 0);
    if(transportCost > 0) dataMap.set('Transport', transportCost);

    const otherCost = sumDirectExpenses(expenses, 'Other');
    if(otherCost > 0) dataMap.set('Other', otherCost);

    // Manual Tools / Food expenses and defect-liability repairs were missing from the totals.
    (['Tools', 'Food', 'Maintenance'] as const).forEach(category => {
      const cost = sumDirectExpenses(expenses, category);
      if (cost > 0) dataMap.set(category, (dataMap.get(category) || 0) + cost);
    });
    
    const expenseBreakdown = Array.from(dataMap.entries()).map(([name, value]) => ({ name, value }));
    const totalExpenses = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);
    
    const totalSales = sales.reduce((acc, s) => acc + s.salePrice, 0);
    const totalProfit = sales.reduce((acc, s) => acc + saleProfit(s), 0);
    
    const inventoryValue = (() => {
        const stock: { [key: string]: { quantity: number; totalValue: number } } = {};
        inventoryItems.forEach(item => { 
            if (!stock[item.name]) {
                stock[item.name] = { quantity: 0, totalValue: 0 };
            }
            if (item.status === 'Bought') {
                stock[item.name].quantity += item.quantity;
                stock[item.name].totalValue += item.quantity * (item.pricePerUnit || 0);
            } else if (item.status === 'Used') {
                const avgPrice = stock[item.name].quantity > 0 ? stock[item.name].totalValue / stock[item.name].quantity : 0;
                stock[item.name].quantity -= item.quantity;
                stock[item.name].totalValue -= item.quantity * (isFinite(avgPrice) ? avgPrice : 0);
            }
        });
        return Object.values(stock).reduce((acc, item) => acc + item.totalValue, 0);
    })();

    return {
        totalExpenses,
        totalSales,
        totalProfit,
        inventoryValue,
        expenseBreakdown,
    };
  }, [view, sites, manufacturingUnits, allExpenses, allLaborTransactions, allSales, allInventory, allMachines, allRentedMaterials, allRentedMaterialAttendances, allMachineAttendances, allMaintenanceLogs, allFuelLogs, allTools, isWithinDateRange, dateRange, filterBySite]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF();
    const addPageContent = (pageNumber: number) => {
        doc.setFontSize(10);
        doc.text(`Page ${pageNumber}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
    };

    doc.setFontSize(18);
    doc.text("Analysis Dashboard Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Report for: ${sites.find(s => s.id === view)?.name || 'All Sites'}`, 14, 30);
    doc.text(`Date Range: ${format(new Date(dateRange.from), 'PPP')} to ${format(new Date(dateRange.to), 'PPP')}`, 14, 36);

    let y = 50;

    doc.setFontSize(14);
    doc.text("Key Metrics", 14, y);
    y += 10;
    
    autoTable(doc, {
        body: [
            ['Total Expenses', formatCurrency(kpiData.totalExpenses)],
            ['Total Sales', formatCurrency(kpiData.totalSales)],
            ['Overall Profit', formatCurrency(kpiData.totalProfit)],
            ['Inventory Value', formatCurrency(kpiData.inventoryValue)],
            ['Active Sites', constructionSites.length.toString()],
            ['Manufacturing Units', manufacturingUnits.length.toString()],
        ],
        startY: y,
        theme: 'grid',
        styles: { fontSize: 10 },
        headStyles: { fillColor: [22, 163, 74] },
    });
    
    y = (doc as any).lastAutoTable.finalY + 15;
    
    if (y > 250) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(14);
    doc.text("Sites & Units Overview", 14, y);
    y += 10;

    if (siteSummaries.length > 0) {
        doc.setFontSize(12);
        doc.text("Construction Sites", 14, y);
        y += 7;
        autoTable(doc, {
            head: [['Site', 'Total Cost', 'Budget Used']],
            body: siteSummaries.map(site => [
                site.name,
                formatCurrency(site.totalCost),
                site.budget ? `${site.budgetUsed.toFixed(1)}%` : 'N/A'
            ]),
            startY: y,
            theme: 'striped',
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }
    
    if (unitSummaries.length > 0) {
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(12);
        doc.text("Manufacturing Units", 14, y);
        y += 7;
        autoTable(doc, {
            head: [['Unit', 'Production Cost', 'Sales', 'Profit']],
            body: unitSummaries.map(unit => [
                unit.name,
                formatCurrency(unit.productionCost),
                formatCurrency(unit.totalSales),
                formatCurrency(unit.profit)
            ]),
            startY: y,
            theme: 'striped',
        });
        y = (doc as any).lastAutoTable.finalY + 10;
    }
    
    const totalPages = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageContent(i);
    }
    
    doc.save(`analysis-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const KpiCard = ({ title, value, icon: Icon }: { title: string, value: string, icon: React.ElementType }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );

  if (loading) {
      return (
        <div className="flex h-[calc(100vh-10rem)] w-full items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      );
  }

  if (!companyId) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Analysis Dashboard</CardTitle>
                <CardDescription>Select a company to view the analysis.</CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="space-y-6" ref={pageRef}>
      <Card>
        <CardHeader>
          <CardTitle>Analysis Dashboard</CardTitle>
          <CardDescription>An interactive overview of all your operations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
            <div className="grid gap-2">
              <label htmlFor="view-filter">View</label>
              <Select value={view} onValueChange={setView}>
                <SelectTrigger className="w-[200px]" id="view-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-sites">All Sites</SelectItem>
                  <SelectItem value="all-manufacturing">All Manufacturing</SelectItem>
                  <SelectGroup>
                      <SelectLabel>Construction Sites</SelectLabel>
                      {constructionSites.map(site => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
                  </SelectGroup>
                  <SelectGroup>
                      <SelectLabel>Manufacturing Units</SelectLabel>
                      {manufacturingUnits.map(site => <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
                <label htmlFor="report-date-from">From</label>
                <Input
                id="report-date-from"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({...prev, from: e.target.value}))}
                className="w-auto"
                />
            </div>
            <div className="grid gap-2">
                <label htmlFor="report-date-to">To</label>
                <Input
                id="report-date-to"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({...prev, to: e.target.value}))}
                className="w-auto"
                />
            </div>
            <div className="flex-grow"></div>
            <div className="flex items-center gap-2 no-print">
                <Button variant="outline" onClick={handlePrint}>
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button onClick={handleDownloadPdf}>
                    <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
            </div>
        </CardContent>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Total Expenses" value={formatCurrency(kpiData.totalExpenses)} icon={IndianRupee} />
        <KpiCard title="Total Sales" value={formatCurrency(kpiData.totalSales)} icon={Briefcase} />
        <KpiCard title="Overall Profit" value={formatCurrency(kpiData.totalProfit)} icon={TrendingUp} />
        <KpiCard title="Inventory Value" value={formatCurrency(kpiData.inventoryValue)} icon={Warehouse} />
        <KpiCard title="Active Sites" value={constructionSites.length.toString()} icon={HardHat} />
        <KpiCard title="Manufacturing Units" value={manufacturingUnits.length.toString()} icon={Factory} />
        <KpiCard title="Total Machines" value={allMachines.length.toString()} icon={Tractor} />
        <KpiCard title="Total Tools" value={allTools.reduce((acc, t) => acc + t.quantity, 0).toString()} icon={Wrench} />

      </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
                <CardHeader>
                    <CardTitle>Expense Breakdown</CardTitle>
                    <CardDescription>Distribution of costs in the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ExpenseBreakdownChart title="Expense Breakdown" expenseData={kpiData.expenseBreakdown} totalExpenses={kpiData.totalExpenses} isLoading={loading} />
                </CardContent>
            </Card>
             <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>Sites & Units Overview</CardTitle>
                    <CardDescription>Summary of all active projects.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                      <h4 className="text-md font-semibold mb-2">Construction Sites</h4>
                      <div className="border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Site</TableHead>
                              <TableHead>Total Cost</TableHead>
                              <TableHead>Budget Used</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {siteSummaries.map(site => (
                              <TableRow key={site.id}>
                                <TableCell>{site.name}</TableCell>
                                <TableCell>{formatCurrency(site.totalCost)}</TableCell>
                                <TableCell>
                                  {site.budget && site.budget > 0 ? (
                                    <div className="flex items-center gap-2">
                                      <Progress value={Math.min(100, site.budgetUsed)} className="w-24" />
                                      <span>{site.budgetUsed.toFixed(1)}%</span>
                                    </div>
                                  ) : "N/A"}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                     <div>
                      <h4 className="text-md font-semibold mb-2">Manufacturing Units</h4>
                        <div className="border rounded-lg">
                          <Table>
                              <TableHeader>
                                  <TableRow>
                                      <TableHead>Unit</TableHead>
                                      <TableHead>Production Cost</TableHead>
                                      <TableHead>Sales</TableHead>
                                      <TableHead>Profit</TableHead>
                                  </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {unitSummaries.map(unit => (
                                      <TableRow key={unit.id}>
                                          <TableCell>{unit.name}</TableCell>
                                          <TableCell>{formatCurrency(unit.productionCost)}</TableCell>
                                          <TableCell>{formatCurrency(unit.totalSales)}</TableCell>
                                          <TableCell>{formatCurrency(unit.profit)}</TableCell>
                                      </TableRow>
                                  ))}
                              </TableBody>
                          </Table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
