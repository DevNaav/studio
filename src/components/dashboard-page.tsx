
'use client';

import { Site, Company, Labor, LaborTransaction, Attendance, WorkLog, InventoryItem, Machine, MaintenanceLog, FuelLog, RentedMaterial, RentedMaterialAttendance, Expense, Theft, Sale, Tool, MachineAttendance } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Plus, HardHat, Factory, IndianRupee, Users, Construction, Wrench, Warehouse, TrendingUp, Briefcase, Bot, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useState, useEffect, useMemo } from 'react';
import { Button } from './ui/button';
import { AddSiteDialog } from './add-site-dialog';
import { GeneralExpenseChart } from './general-expense-chart';
import { useSite, onGlobalCollectionSnapshot } from '@/context/site-context';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { WarehouseSummaryCard } from './warehouse-summary-card';
import { OnboardingFlow } from './onboarding-flow';
import { formatCurrency } from '@/lib/utils';
import { format, isAfter, eachDayOfInterval, isBefore, isValid, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { computeSiteSpend, saleProfit, sumDirectExpenses } from '@/lib/costs';
import { siteLaborTotals, workerMoney } from '@/lib/wages';

const HumanCharacter = dynamic(() => import('@/components/HumanCharacter'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});

const InteractiveBlueprint = dynamic(() => import('@/components/InteractiveBlueprint'), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>,
});


interface DashboardPageProps {
  sites: Site[];
  manufacturingUnits: Site[];
  companyId?: string | null;
  setActiveView: (view: any) => void;
  /** AI features are part of the Business plan. */
  showAi?: boolean;
}

function KpiCard({ title, value, icon: Icon, description }: { title: string; value: string; icon: React.ElementType, description: string }) {
    return (
        <Card className="scroll-anim tw-neon">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary shadow-lg shadow-primary/50">
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-bold">{value}</div>
                <p className="text-xs text-muted-foreground">{description}</p>
                <div className="absolute bottom-2 right-2 h-1 w-4 bg-primary/50 rounded-full animate-pulse" />
            </CardContent>
        </Card>
    );
}

export function DashboardPage({ sites, manufacturingUnits, companyId, setActiveView, showAi = false }: DashboardPageProps) {
    const { isAdmin, isSuperAdmin, userProfile, updateUser, user } = useAuth();
    const { setSelectedSiteId, allCompanies, selectedSiteId } = useSite();
    const activeSite = sites.find(s => s.id === selectedSiteId) || sites[0];
    const [isAddSiteOpen, setAddSiteOpen] = useState(false);
    const [mascotBubble, setMascotBubble] = useState("Hi! I'm Inventra, your virtual supervisor. Let's make today safe and productive!");

    const mascotTips = [
        "Safety first! Don't forget to track your Machine Maintenance logs today.",
        "Your active projects are looking solid. Let's keep making progress!",
        "Try using the Voice Mic on the bottom-right Co-Pilot to talk to me hands-free!",
        "I'm keeping an eye on your inventory items. Remember to log warehouse usage!",
        "Need help? Just click 'Ask AI' or speak a command to get instant answers!"
    ];

    const rotateTip = () => {
        const randomIndex = Math.floor(Math.random() * mascotTips.length);
        setMascotBubble(mascotTips[randomIndex]);
    };

    
    const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
    const [allLabor, setAllLabor] = useState<Labor[]>([]);
    const [allMachines, setAllMachines] = useState<Machine[]>([]);
    const [allInventory, setAllInventory] = useState<InventoryItem[]>([]);
    const [allLaborTransactions, setAllLaborTransactions] = useState<LaborTransaction[]>([]);
    const [allSales, setAllSales] = useState<Sale[]>([]);
    const [allMaintenanceLogs, setAllMaintenanceLogs] = useState<MaintenanceLog[]>([]);
    const [allFuelLogs, setAllFuelLogs] = useState<FuelLog[]>([]);
    const [allRentedMaterials, setAllRentedMaterials] = useState<RentedMaterial[]>([]);
    const [allRentedMaterialAttendances, setAllRentedMaterialAttendances] = useState<RentedMaterialAttendance[]>([]);
    const [allMachineAttendances, setAllMachineAttendances] = useState<MachineAttendance[]>([]);
    const [allTools, setAllTools] = useState<Tool[]>([]);
    const [allAttendances, setAllAttendances] = useState<Attendance[]>([]);
    const [allWorkLogs, setAllWorkLogs] = useState<WorkLog[]>([]);
    const [showMascot, setShowMascot] = useState(true);
    const today = new Date();


    const currentCompany = useMemo(() => allCompanies.find(c => c.id === companyId), [allCompanies, companyId]);

    useEffect(() => {
        if (!companyId) return;

        const unsubs = [
            onGlobalCollectionSnapshot<Expense>('expenses', companyId, setAllExpenses),
            onGlobalCollectionSnapshot<Labor>('labors', companyId, setAllLabor),
            onGlobalCollectionSnapshot<Machine>('machines', companyId, setAllMachines),
            onGlobalCollectionSnapshot<InventoryItem>('inventory', companyId, setAllInventory),
            onGlobalCollectionSnapshot<LaborTransaction>('labor_transactions', companyId, setAllLaborTransactions),
            onGlobalCollectionSnapshot<Sale>('sales', companyId, setAllSales),
            onGlobalCollectionSnapshot<MaintenanceLog>('maintenance_logs', companyId, setAllMaintenanceLogs),
            onGlobalCollectionSnapshot<FuelLog>('fuel_logs', companyId, setAllFuelLogs),
            onGlobalCollectionSnapshot<RentedMaterial>('rented_materials', companyId, setAllRentedMaterials),
            onGlobalCollectionSnapshot<RentedMaterialAttendance>('rented_material_attendances', companyId, setAllRentedMaterialAttendances),
            onGlobalCollectionSnapshot<MachineAttendance>('machine_attendances', companyId, setAllMachineAttendances),
            onGlobalCollectionSnapshot<Tool>('tools', companyId, setAllTools),
            onGlobalCollectionSnapshot<Attendance>('attendances', companyId, setAllAttendances),
            onGlobalCollectionSnapshot<WorkLog>('work_logs', companyId, setAllWorkLogs),
        ];

        return () => unsubs.forEach(unsub => unsub());
    }, [companyId]);

    
    const kpiData = useMemo(() => {
        const machinesInUse = allMachines.filter(m => m.assignedSiteId).length;

        const inventoryValue = (() => {
            const stock: { [key: string]: { quantity: number; totalValue: number } } = {};
            allInventory.forEach(item => {
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
            return Math.max(0, Object.values(stock).reduce((acc, item) => acc + item.totalValue, 0));
        })();
        
        const manufacturingSiteIds = manufacturingUnits.map(unit => unit.id);
        const manufacturingSales = allSales.filter(sale => manufacturingSiteIds.includes(sale.siteId));
        const overallProfit = manufacturingSales.reduce((acc, sale) => acc + saleProfit(sale), 0);

        return {
            machinesInUse,
            inventoryValue,
            overallProfit
        };
    }, [allMachines, allInventory, allSales, manufacturingUnits]);

    // Same total as each site's Summary tab (src/lib/costs.ts), using the company's
    // accounting settings, so the Dashboard's budget bars match budget alerts.
    const dashCompany = allCompanies.find(c => c.id === companyId);
    const siteExpenses = useMemo(() => {
        const expenseMap = new Map<string, number>();
        const todayStr = format(today, 'yyyy-MM-dd');
        sites.forEach(site => {
            const labor = siteLaborTotals(workerMoney({
                labors: allLabor.filter(l => l.siteId === site.id && !l.isDeleted),
                attendances: allAttendances.filter(a => a.siteId === site.id),
                workLogs: allWorkLogs.filter(w => w.siteId === site.id),
                transactions: allLaborTransactions.filter(t => t.siteId === site.id),
                today: todayStr,
                foodMode: dashCompany?.foodCostMode,
            }));
            expenseMap.set(site.id, computeSiteSpend({
                siteId: site.id,
                laborPaid: labor.paid,
                laborEarned: labor.earned,
                foodGiven: labor.food,
                laborBasis: dashCompany?.laborCostBasis ?? 'earned',
                foodMode: dashCompany?.foodCostMode,
                expenses: allExpenses.filter(e => e.siteId === site.id),
                materials: allInventory.filter(i => i.siteId === site.id && i.type === 'Material'),
                machines: allMachines.filter(m => !m.isDeleted),
                maintenanceLogs: allMaintenanceLogs,
                fuelLogs: allFuelLogs,
                rentedMaterials: allRentedMaterials.filter(r => r.siteId === site.id),
                rentedMaterialAttendances: allRentedMaterialAttendances.filter(a => a.siteId === site.id),
                machineAttendances: allMachineAttendances,
                tools: allTools.filter(t => t.siteId === site.id),
                today,
            }).total);
        });
        return expenseMap;
    }, [sites, dashCompany?.laborCostBasis, dashCompany?.foodCostMode, allInventory, allLabor, allWorkLogs, allAttendances, allLaborTransactions, allMachines, allMaintenanceLogs, allFuelLogs, allRentedMaterials, allRentedMaterialAttendances, allMachineAttendances, allTools, allExpenses, today]);
    
    if (sites.length === 0 && manufacturingUnits.length === 0 && !isSuperAdmin) {
        return (
             <div className="flex h-[calc(100vh-10rem)] items-center justify-center">
                <Card className="w-full max-w-md text-center shadow-none border-0 bg-transparent">
                    <CardHeader>
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
                    <CardTitle className="mt-4 text-2xl">Welcome to Inventra!</CardTitle>
                    <CardDescription className="mt-2">
                        Create your first project to begin managing your operations.
                    </CardDescription>
                    </CardHeader>
                    {isAdmin && (
                    <CardContent>
                        <Button onClick={() => setAddSiteOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Project
                        </Button>
                    </CardContent>
                    )}
                </Card>
                 <AddSiteDialog open={isAddSiteOpen} onOpenChange={setAddSiteOpen} />
            </div>
        );
    }

  return (
    <div className="space-y-8">
        {showMascot && (
            <div id="mascot">
                <Card className="relative overflow-hidden tw-neon animated:anim-entrance">
                    <CardContent className="p-6 flex items-center justify-between">
                         <div className="relative z-10">
                            <CardTitle className="text-2xl font-bold">Hello, {userProfile?.name?.split(' ')[0] || 'there'}!</CardTitle>
                            <CardDescription>Here's a quick look at your operations today.</CardDescription>
                        </div>
                        <div className="flex items-center gap-4 cursor-pointer" onMouseEnter={rotateTip}>
                            {mascotBubble && (
                                <div className="relative p-3 bg-primary/20 border border-primary/40 rounded-xl rounded-br-none text-xs text-foreground max-w-[200px] shadow-lg shadow-primary/20 animate-in fade-in-50 slide-in-from-right-5 hidden md:block select-none">
                                    <p className="leading-relaxed">{mascotBubble}</p>
                                    <div className="absolute right-[-6px] bottom-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-primary/40" />
                                </div>
                            )}
                            <div className="h-48 w-64 relative">
                               <HumanCharacter />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 scroll-anim">
            <Button size="lg" onClick={() => setAddSiteOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Site</Button>
            <Button size="lg" variant="outline" onClick={() => setActiveView('labor')}><Users className="mr-2 h-4 w-4" /> New Worker</Button>
            <Button size="lg" variant="outline" onClick={() => setActiveView('machines')}><Construction className="mr-2 h-4 w-4" /> New Machine</Button>
            {showAi && <Button size="lg" variant="outline" onClick={() => setActiveView('assistant')}><Bot className="mr-2 h-4 w-4" />Ask AI</Button>}
        </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard title="Active Sites" value={sites.length.toString()} icon={Construction} description="Construction projects in progress" />
        <KpiCard title="Manufacturing Units" value={manufacturingUnits.length.toString()} icon={Factory} description="Production facilities" />
        <KpiCard title="Total Labor Force" value={allLabor.length.toString()} icon={Users} description="Workers across all sites" />
        <KpiCard title="Inventory Value" value={formatCurrency(kpiData.inventoryValue)} icon={Warehouse} description="Estimated value of current stock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <div className="scroll-anim">
                <h2 className="text-2xl font-semibold mb-4">Sites Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                    {sites.map(site => {
                        const totalSiteExpense = siteExpenses.get(site.id) || 0;
                        const budgetUsedPercent = site.budget && site.budget > 0 ? (totalSiteExpense / site.budget) * 100 : 0;
                        return (
                            <Card key={site.id} className="tw-neon hover:shadow-lg transition-shadow cursor-pointer flex flex-col" onClick={() => { setSelectedSiteId(site.id); setActiveView('sites');}}>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <span className="flex items-center gap-2"><HardHat />{site.name}</span>
                                        <Badge variant="outline">{site.status}</Badge>
                                    </CardTitle>
                                    <CardDescription>{site.location}</CardDescription>
                                </CardHeader>
                                <CardContent className="flex-grow space-y-4">
                                  <div className="space-y-2">
                                      <div>
                                        <p className="text-sm text-muted-foreground">Total Expenses</p>
                                        <p className="text-2xl font-bold">{formatCurrency(totalSiteExpense)}</p>
                                      </div>
                                      {site.budget && site.budget > 0 && (
                                          <div className="space-y-1">
                                              <div className="flex justify-between text-sm text-muted-foreground">
                                                  <span>Budget</span>
                                                  <span>{formatCurrency(site.budget)}</span>
                                              </div>
                                              <Progress value={Math.min(100, budgetUsedPercent)} className="w-full h-2" />
                                              <p className="text-xs text-right text-muted-foreground">{budgetUsedPercent.toFixed(1)}% used</p>
                                          </div>
                                      )}
                                  </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            </div>
             <div className="scroll-anim">
                <h2 className="text-2xl font-semibold mb-4">Manufacturing Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
                    {manufacturingUnits.map(unit => (
                        <Card key={unit.id} className="tw-neon hover:shadow-lg transition-shadow cursor-pointer" onClick={() => { setSelectedSiteId(unit.id); setActiveView('sites');}}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Factory />{unit.name}</span>
                                    <Badge variant="outline">{unit.status}</Badge>
                                </CardTitle>
                                <CardDescription>{unit.location}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
        <div className="lg:col-span-1 space-y-6">
            <WarehouseSummaryCard companyId={companyId} />
            <Card className="tw-neon overflow-hidden">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
                        Holographic Site Blueprint
                    </CardTitle>
                    <CardDescription className="text-xs">Drag mouse to inspect structural scaffolding</CardDescription>
                </CardHeader>
                <CardContent className="h-48 p-0 flex items-center justify-center bg-black/20">
                    <InteractiveBlueprint siteId={activeSite?.id || 'default'} siteName={activeSite?.name || 'Default Site'} />
                </CardContent>
            </Card>
            <GeneralExpenseChart />
        </div>
      </div>
       <AddSiteDialog open={isAddSiteOpen} onOpenChange={setAddSiteOpen} />
    </div>
  );
}
