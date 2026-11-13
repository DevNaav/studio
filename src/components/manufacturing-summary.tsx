'use client';

import { useEffect, useState, useMemo } from 'react';
import { Expense, MaintenanceLog, InventoryItem, LaborTransaction, Sale, Machine, Labor } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ManufacturingExpenseChart } from './manufacturing-expense-chart';
import { onGlobalCollectionSnapshot } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { Button } from './ui/button';
import { Download, HardHat, Users, TrendingUp, IndianRupee } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';

interface ManufacturingSummaryProps {
    companyId: string | null | undefined;
}

export function ManufacturingSummary({ companyId }: ManufacturingSummaryProps) {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [manufacturingInventory, setManufacturingInventory] = useState<InventoryItem[]>([]);
  const [labor, setLabor] = useState<LaborTransaction[]>([]);
  const [allLabors, setAllLabors] = useState<Labor[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [allMaintenanceLogs, setAllMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [allMachines, setAllMachines] = useState<Machine[]>([]);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const collectionsToLoad = 7;
    let collectionsLoaded = 0;
    const onDataLoaded = () => {
      collectionsLoaded++;
      if (collectionsLoaded >= collectionsToLoad) {
        setLoading(false);
      }
    };

    const unsubs = [
        onGlobalCollectionSnapshot<Expense>('manufacturing_expenses', companyId, (data) => { setExpenses(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<InventoryItem>('manufacturing_inventory', companyId, (data) => { setManufacturingInventory(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<LaborTransaction>('manufacturing_labor_transactions', companyId, (data) => { setLabor(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Labor>('labors', companyId, (data) => { setAllLabors(data.filter(l => l.siteId === 'manufacturing')); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Sale>('sales', companyId, (data) => { setSales(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, (data) => { setAllMaintenanceLogs(data); onDataLoaded(); }),
        onGlobalCollectionSnapshot<Machine>('machines', companyId, (data) => { setAllMachines(data); onDataLoaded(); }),
    ];

    return () => {
        unsubs.forEach(unsub => unsub());
    };
  }, [companyId]);

  const manufacturingData = useMemo(() => {
    const totalMaterialTypes = new Set(manufacturingInventory.map(i => i.name)).size;
    const totalLaborers = allLabors.length;

    const materialCosts = manufacturingInventory
        .filter(item => item.status === 'Used' && !item.isDeleted)
        .reduce((acc, item) => acc + (item.quantity * (item.pricePerUnit || 0)), 0);

    const laborCosts = labor.filter(t => !t.isDeleted).reduce((acc, t) => acc + t.amount, 0);
    
    const otherCosts = expenses.filter(e => !e.isDeleted).reduce((acc, e) => acc + e.amount, 0);
    
    const generalMachineIds = allMachines
      .filter(m => !m.assignedSiteId)
      .map(m => m.id);

    let machineCosts = 0;
    if (generalMachineIds.length > 0) {
      machineCosts = allMaintenanceLogs
        .filter(log => 
            !log.isDeleted && 
            log.costAllocation === 'General Expenses' &&
            generalMachineIds.includes(log.machineId)
        )
        .reduce((acc, log) => acc + (log.cost || 0), 0);
    }

    const totalManufacturingExpenses = materialCosts + laborCosts + otherCosts + machineCosts;

    const expenseComponents = [];
    if (materialCosts > 0) expenseComponents.push({ name: 'Materials', value: materialCosts });
    if (laborCosts > 0) expenseComponents.push({ name: 'Labor', value: laborCosts });
    if (machineCosts > 0) expenseComponents.push({ name: 'Machine Costs', value: machineCosts });
    if (otherCosts > 0) expenseComponents.push({ name: 'Other Expenses', value: otherCosts });
    
    const salesProfitability = sales.filter(s => !s.isDeleted).reduce((acc, sale) => {
      const profit = sale.salePrice - sale.productionCost;
      if (profit > 0) {
        acc.set(sale.gradeName, (acc.get(sale.gradeName) || 0) + profit);
      }
      return acc;
    }, new Map<string, number>());
    
    const salesProfitabilityComponents = Array.from(salesProfitability.entries()).map(([name, value]) => ({ name, value }));
    const totalSalesProfit = salesProfitabilityComponents.reduce((sum, item) => sum + item.value, 0);

    return {
      totalMaterialTypes,
      totalLaborers,
      totalManufacturingExpenses,
      expenseComponents,
      salesProfitabilityComponents,
      totalSalesProfit,
    };
  }, [manufacturingInventory, labor, allLabors, expenses, sales, allMaintenanceLogs, allMachines]);


   const handleExportPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;

    const formatCurrency = (amount: number | undefined) => `Rs. ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const addSection = (title: string, headers: any[], data: any[][], footers?: any[][]) => {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFontSize(14);
      doc.text(title, 14, yPos);
      yPos += 8;
      autoTable(doc, {
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
    doc.text(`Manufacturing Report`, doc.internal.pageSize.getWidth() / 2, yPos, { align: 'center' });
    yPos += 20;

    doc.setFontSize(12);
    doc.text(`Generated On: ${format(new Date(), 'PPP')}`, 14, yPos);
    doc.text(`Generated By: ${userProfile?.email || 'Unknown User'}`, doc.internal.pageSize.getWidth() - 14, yPos, { align: 'right' });
    yPos += 15;

    autoTable(doc, {
      body: [
        ['Total Manufacturing Expenses', formatCurrency(manufacturingData.totalManufacturingExpenses)],
        ['Total Sales Profit', formatCurrency(manufacturingData.totalSalesProfit)],
        ['Net Result', formatCurrency(manufacturingData.totalSalesProfit - manufacturingData.totalManufacturingExpenses)],
      ],
      startY: yPos,
      theme: 'plain'
    });
    yPos = (doc as any).lastAutoTable.finalY + 20;

    doc.addPage();
    yPos = 20;
    doc.setFontSize(18);
    doc.text('Manufacturing Summary', 14, yPos);
    yPos += 10;

    addSection('Expense Breakdown',
      ['Category', 'Total Cost', 'Percentage'],
      manufacturingData.expenseComponents.map(item => [
        item.name,
        formatCurrency(item.value),
        `${manufacturingData.totalManufacturingExpenses > 0 ? ((item.value / manufacturingData.totalManufacturingExpenses) * 100).toFixed(2) : 0}%`
      ]),
      [['Total', formatCurrency(manufacturingData.totalManufacturingExpenses), '100.00%']]
    );
    
    addSection('Sales Profitability',
      ['Product Grade', 'Total Profit', 'Percentage'],
      manufacturingData.salesProfitabilityComponents.map(item => [
        item.name,
        formatCurrency(item.value),
        `${manufacturingData.totalSalesProfit > 0 ? ((item.value / manufacturingData.totalSalesProfit) * 100).toFixed(2) : 0}%`
      ]),
      [['Total', formatCurrency(manufacturingData.totalSalesProfit), '100.00%']]
    );

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      doc.text(`Generated by MANGEMENT`, 14, doc.internal.pageSize.getHeight() - 10);
    }

    doc.save(`manufacturing-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'Report Generated', description: 'Your PDF summary has been downloaded.' });
  };


  return (
    <div className="space-y-6">
       <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Manufacturing Summary</CardTitle>
                <CardDescription>An overview of your manufacturing metrics.</CardDescription>
            </div>
            <Button onClick={handleExportPDF} variant="outline" size="sm" disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                Export PDF Report
            </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Materials</CardTitle>
                    <HardHat className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{manufacturingData.totalMaterialTypes} types</div>
                    <p className="text-xs text-muted-foreground">Unique materials in use</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Laborers</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{manufacturingData.totalLaborers} workers</div>
                    <p className="text-xs text-muted-foreground">Assigned to manufacturing</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sales Profit</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-green-600">₹{manufacturingData.totalSalesProfit.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">Across all sales</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Manufacturing Expenses</CardTitle>
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">₹{manufacturingData.totalManufacturingExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <p className="text-xs text-muted-foreground">Sum of all production costs</p>
                </CardContent>
            </Card>
        </CardContent>
      </Card>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sales Profitability</CardTitle>
            <CardDescription>Profit generated by each product grade.</CardDescription>
          </CardHeader>
          <CardContent>
            <ManufacturingExpenseChart 
              title="Sales Profit"
              expenseData={manufacturingData.salesProfitabilityComponents}
              totalExpenses={manufacturingData.totalSalesProfit}
              isLoading={loading}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Expenses</CardTitle>
            <CardDescription>Breakdown of costs related to manufacturing.</CardDescription>
          </CardHeader>
          <CardContent>
            <ManufacturingExpenseChart 
              title="Manufacturing Expenses"
              expenseData={manufacturingData.expenseComponents}
              totalExpenses={manufacturingData.totalManufacturingExpenses}
              isLoading={loading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
