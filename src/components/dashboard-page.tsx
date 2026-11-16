
'use client';

import { Site, Company, Labor, LaborTransaction, Attendance, WorkLog, InventoryItem, Machine, MaintenanceLog, FuelLog, RentedMaterial, RentedMaterialAttendance, Expense, Theft, Sale, Tool, MachineAttendance } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Plus, HardHat, Factory, IndianRupee, Users, Construction, Wrench, Warehouse, TrendingUp, Briefcase, Bot, Loader2, Sparkles, ListChecks, Wallet, MapPin, ChevronRight } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { StatCard } from '@/components/stat-card';

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
  companyName?: string;
  companyLogoUrl?: string;
  tasksDueToday?: number;
  tasksOverdue?: number;
}

/** "Rs. 6.77 L" / "Rs. 1.2 Cr": short Indian money for stat cards. */
function shortRs(n: number) {
    const abs = Math.abs(n);
    if (abs >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
    if (abs >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
    return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function DashboardPage({ sites, manufacturingUnits, companyId, setActiveView, showAi = false, companyName, companyLogoUrl, tasksDueToday = 0, tasksOverdue = 0 }: DashboardPageProps) {
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
    const workersOwedRef = useRef(0);
    const siteExpenses = useMemo(() => {
        const expenseMap = new Map<string, number>();
        let owed = 0;
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
            owed += labor.owed;
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
        workersOwedRef.current = owed;
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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = userProfile?.name?.split(' ')[0] || 'there';
  const totalSpent = Array.from(siteExpenses.values()).reduce((a, b) => a + b, 0);
  const workersOwed = workersOwedRef.current;
  const chip = 'inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium backdrop-blur';

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Welcome */}
      <section id="mascot" className="animated:anim-entrance relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.07),transparent_50%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <div className="relative grid items-center gap-2 p-5 sm:p-7 md:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{format(new Date(), 'EEEE, d MMMM yyyy')}</span>
              {companyName && <><span aria-hidden>·</span><span className="font-medium capitalize text-foreground/80">{companyName}</span></>}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{greeting}, <span className="capitalize">{firstName}</span></h2>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">Here&apos;s how your sites are doing today.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={chip}><span className="glowing-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" />{sites.length + manufacturingUnits.length} active {sites.length + manufacturingUnits.length === 1 ? 'site' : 'sites'}</span>
              <span className={chip}><Users className="h-3.5 w-3.5 text-blue-500" />{allLabor.length} workers</span>
              <span className={cn(chip, tasksOverdue > 0 && 'border-red-500/30 text-red-600 dark:text-red-400')}>
                <ListChecks className="h-3.5 w-3.5" />{tasksDueToday} due today{tasksOverdue > 0 ? ` · ${tasksOverdue} overdue` : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={() => setAddSiteOpen(true)} className="shadow-sm"><Plus className="mr-1.5 h-4 w-4" /> New site</Button>
              <Button variant="outline" className="bg-background/70" onClick={() => setActiveView('labor')}><Users className="mr-1.5 h-4 w-4" /> New worker</Button>
              <Button variant="outline" className="bg-background/70" onClick={() => setActiveView('machines')}><Construction className="mr-1.5 h-4 w-4" /> New machine</Button>
              {showAi && <Button variant="outline" className="bg-background/70" onClick={() => setActiveView('assistant')}><Bot className="mr-1.5 h-4 w-4" /> Ask AI</Button>}
            </div>
          </div>
          {showMascot && (
            <div className="relative mx-auto hidden h-56 w-60 sm:block md:mr-2 lg:w-72" onMouseEnter={rotateTip}>
              <div aria-hidden className="absolute bottom-6 left-1/2 h-40 w-40 -translate-x-1/2 rounded-full bg-primary/15 blur-2xl" />
              {mascotBubble && (
                <div className="absolute -left-24 top-3 z-10 hidden max-w-[190px] select-none rounded-2xl rounded-br-sm border bg-card/95 p-3 text-xs leading-relaxed text-foreground shadow-lg backdrop-blur animate-in fade-in-50 slide-in-from-right-2 lg:block">
                  {mascotBubble}
                </div>
              )}
              <div className="relative h-full w-full cursor-grab active:cursor-grabbing">
                <HumanCharacter />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Key numbers */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard tone="blue" title="Spent on sites" value={shortRs(totalSpent)} icon={IndianRupee} description="All active sites, to date" />
        <StatCard tone="amber" title="Owed to workers" value={shortRs(workersOwed)} icon={Wallet} description="Wages earned, not yet paid" onClick={() => setActiveView('labor')} />
        <StatCard tone="violet" title="Workforce" value={String(allLabor.length)} icon={Users} description={`${sites.length} ${sites.length === 1 ? 'site' : 'sites'} · ${manufacturingUnits.length} ${manufacturingUnits.length === 1 ? 'unit' : 'units'}`} onClick={() => setActiveView('labor')} />
        <StatCard tone="emerald" title="Stock value" value={shortRs(kpiData.inventoryValue)} icon={Warehouse} description="Current materials in stock" onClick={() => setActiveView('warehouse')} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="scroll-anim space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Sites</h2>
                <p className="text-sm text-muted-foreground">Spending against budget for each active site.</p>
              </div>
            </div>
            {sites.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-6 text-center text-sm text-muted-foreground">No active construction sites yet.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {sites.map(site => {
                  const spent = siteExpenses.get(site.id) || 0;
                  const budget = site.budget && site.budget > 0 ? site.budget : 0;
                  const pct = budget ? (spent / budget) * 100 : 0;
                  const barColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
                  return (
                    <Card key={site.id} className="tw-neon group cursor-pointer rounded-xl" onClick={() => { setSelectedSiteId(site.id); setActiveView('sites'); }}>
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><HardHat className="h-5 w-5" /></div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold capitalize">{site.name}</p>
                              {site.location && <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{site.location}</p>}
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{site.status}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Spent so far</p>
                          <p className="text-xl font-bold tracking-tight tabular-nums">{formatCurrency(spent)}</p>
                        </div>
                        {budget > 0 ? (
                          <div className="space-y-1.5">
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                              <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${Math.min(100, Math.max(pct, 1.5))}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span className={cn(pct >= 100 && 'font-medium text-red-600 dark:text-red-400', pct >= 80 && pct < 100 && 'font-medium text-amber-600 dark:text-amber-400')}>{pct.toFixed(1)}% of budget</span>
                              <span>Budget {shortRs(budget)}</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No budget set</p>
                        )}
                        <p className="flex items-center text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">Open site <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {manufacturingUnits.length > 0 && (
            <section className="scroll-anim space-y-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Manufacturing</h2>
                <p className="text-sm text-muted-foreground">Production units and their sales.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {manufacturingUnits.map(unit => (
                  <Card key={unit.id} className="tw-neon group cursor-pointer rounded-xl" onClick={() => { setSelectedSiteId(unit.id); setActiveView('sites'); }}>
                    <CardContent className="flex items-center justify-between gap-3 p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400"><Factory className="h-5 w-5" /></div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{unit.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{unit.location || 'Manufacturing unit'}</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
        <div className="space-y-6 lg:col-span-1">
            <WarehouseSummaryCard companyId={companyId} />
            <Card className="tw-neon overflow-hidden rounded-xl">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <Sparkles className="h-4 w-4 text-primary" />
                        3D site view
                    </CardTitle>
                    <CardDescription className="text-xs">Drag to look around the structure.</CardDescription>
                </CardHeader>
                <CardContent className="flex h-48 items-center justify-center bg-muted/40 p-0">
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
