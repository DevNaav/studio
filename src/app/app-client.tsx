
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Building, Building2, Plus, LayoutGrid, FileText, AlertCircle, Loader2, LogOut, Users, Construction, Bot, User, IndianRupee, ChevronsUpDown, Crown, CheckCircle2, ChevronDown, LifeBuoy, Ticket, BookText, Settings as SettingsIcon, ShieldAlert, BarChart, HardHat, Tractor, Wrench, KanbanSquare, Warehouse, ShoppingCart, Factory, ChevronRight, ListTodo, ShieldCheck, Coins, Receipt, Briefcase, Dot, Lock, Edit, Mail, BookUser } from 'lucide-react';
import { SiteProvider, useSite } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';
import { Sidebar, SidebarHeader, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, useSidebar, SidebarGroup, SidebarGroupLabel } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { AddSiteDialog } from '@/components/add-site-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { InventoryItem, Labor, Site, Company, SubscriptionStatus, PlanId, BillingCycle, Warranty, Task } from '@/lib/types';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { onCompanyCollectionSnapshot, onGlobalCollectionSnapshot } from '@/context/site-context';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { db } from '@/lib/firebase';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';
import { isPast } from 'date-fns';
import { cn, todayISO } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal } from '@/components/ui/dropdown-menu';
import { SettingsDialog } from '@/components/settings-page';
import { CompleteProfile } from '@/components/complete-profile';
import { CompanyLogoTile } from '@/components/company-logo-tile';
import { ThemeMenu } from '@/components/theme-menu';
import { DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { Logo } from '@/components/ui/logo';
import { OnboardingFlow } from '@/components/onboarding-flow';
import { GuidedTour } from '@/components/guided-tour';
import { useToast } from '@/hooks/use-toast';
import { FloatingAssistant } from '@/components/floating-assistant';
import { AlertsBell } from '@/components/alerts-bell';


const LoadingComponent = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

const DashboardPage = dynamic(() => import('@/components/dashboard-page').then(mod => mod.DashboardPage), { loading: LoadingComponent });
const SiteDetails = dynamic(() => import('@/components/site-details').then(mod => mod.SiteDetails), { loading: LoadingComponent });
const MachinesPage = dynamic(() => import('@/components/machines-page').then(mod => mod.MachinesPage), { loading: LoadingComponent });
const LaborPage = dynamic(() => import('@/components/labor-page').then(mod => mod.LaborPage), { loading: LoadingComponent });
const AssistantPage = dynamic(() => import('@/components/assistant-page').then(mod => mod.AssistantPage), { loading: LoadingComponent });
const MainDocuments = dynamic(() => import('@/components/main-documents').then(mod => mod.MainDocuments), { loading: LoadingComponent });
const TheftTab = dynamic(() => import('@/components/tabs/theft-tab').then(mod => mod.TheftTab), { loading: LoadingComponent });
const AnalysisPage = dynamic(() => import('@/components/analysis-page').then(mod => mod.AnalysisPage), { loading: LoadingComponent });
const ThreatModelerPage = dynamic(() => import('@/components/threat-modeler-page').then(mod => mod.ThreatModelerPage), { loading: LoadingComponent });
const WarehousePage = dynamic(() => import('@/components/warehouse-page').then(mod => mod.WarehousePage), { loading: LoadingComponent });
const ManufacturingPage = dynamic(() => import('@/components/manufacturing-page').then(mod => mod.ManufacturingPage), { loading: LoadingComponent });
const SubscriptionStatusPage = dynamic(() => import('@/components/subscription-status-page').then(mod => mod.SubscriptionStatusPage), { loading: LoadingComponent });
const SubscriptionsPage = dynamic(() => import('@/components/subscriptions-page').then(mod => mod.SubscriptionsPage), { loading: LoadingComponent });
const PaymentPage = dynamic(() => import('@/components/payment-page').then(mod => mod.PaymentPage), { loading: LoadingComponent });
const UserRightsTab = dynamic(() => import('@/components/tabs/user-rights-tab').then(mod => mod.UserRightsTab), { loading: LoadingComponent });
const SupportPage = dynamic(() => import('@/components/support-page').then(mod => mod.SupportPage), { loading: LoadingComponent });
const DocumentationPage = dynamic(() => import('@/components/documentation-page').then(mod => mod.DocumentationPage), { loading: LoadingComponent });
const DefectLiabilityPage = dynamic(() => import('@/components/defect-liability-page').then(mod => mod.DefectLiabilityPage), { loading: LoadingComponent });
const CustomersPage = dynamic(() => import('@/components/customers-page').then(mod => mod.CustomersPage), { loading: LoadingComponent });
const WarrantyTrackerPage = dynamic(() => import('@/components/warranty-tracker-page').then(mod => mod.WarrantyTrackerPage), { loading: LoadingComponent });
const LandingPageEditor = dynamic(() => import('@/components/landing-page-editor'), { loading: LoadingComponent });
const ContactPageEditor = dynamic(() => import('@/components/contact-page-editor'), { loading: LoadingComponent });


export type ActiveView = 'dashboard' | 'sites' | 'machines' | 'labor' | 'documents' | 'users' | 'assistant' | 'companies' | 'subscription' | 'payment' | 'completed-sites' | 'support' | 'documentation' | 'theft' | 'analysis' | 'warehouse' | 'sales' | 'manufacturing' | 'threat-modeler' | 'defect-liability' | 'warranty-tracker' | 'customers' | 'landing-page-editor' | 'contact-page-editor';

function ProjectsMenu({ 
  projects, 
  title, 
  icon: Icon, 
  activeView, 
  setActiveView 
}: { 
  projects: Site[], 
  title: string, 
  icon: React.ElementType,
  activeView: ActiveView, 
  setActiveView: (view: ActiveView) => void 
}) {
  const { selectedSiteId, setSelectedSiteId } = useSite();
  const { isMobile, setOpenMobile } = useSidebar();
  const [isOpen, setIsOpen] = useState(true);

  const handleClick = (project: Site) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setSelectedSiteId(project.id);
    setActiveView('sites');
  };

  if (projects.length === 0) {
    return null;
  }
  
  return (
    <Collapsible asChild open={isOpen} onOpenChange={setIsOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={activeView === 'sites' && projects.some(p => p.id === selectedSiteId)}
            tooltip={title}
            className="justify-between"
          >
            <div className="flex items-center gap-2">
              <Icon />
              <span className="group-data-[collapsible=icon]:hidden">{title}</span>
            </div>
            <ChevronDown className={cn("h-4 w-4 transition-transform group-data-[collapsible=icon]:hidden", isOpen && "rotate-180")} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenu className="pl-4 pt-1 group-data-[collapsible=icon]:hidden">
            {projects.map((project) => (
              <SidebarMenuItem key={project.id}>
                <SidebarMenuButton
                  onClick={() => handleClick(project)}
                  isActive={project.id === selectedSiteId && activeView === 'sites'}
                  tooltip={project.name}
                  variant="ghost"
                  className="h-8 justify-start w-full"
                >
                  <span className="flex-1 truncate">{project.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}

interface AppClientProps {
  initialAllCompanies: Company[];
  initialSites: Site[];
}

function LockedScreen({ title, description, onLogout }: { title: string, description: string, onLogout: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
        <div className="flex h-full items-center justify-center">
            <Card className="w-full max-w-md text-center">
                <CardHeader>
                    <CardTitle className="flex items-center justify-center gap-2"><Lock /> {title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={onLogout}>
                        Logout
                    </Button>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}

export function AppClient({ initialAllCompanies, initialSites }: AppClientProps) {
  const { user, userProfile, loading: authLoading, sendVerificationEmail, isSuperAdmin, profileMissing } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  if (!authLoading && user && profileMissing) {
    return <CompleteProfile />;
  }

  if (authLoading || !user || !userProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (user && !user.emailVerified && !isSuperAdmin) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Card className="max-w-md text-center">
          <CardHeader>
            <CardTitle>Please Verify Your Email</CardTitle>
            <CardDescription>
              A verification link has been sent to your email address ({user.email}). 
              Please click the link to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="link"
              onClick={async () => {
                if (!user) return;
                try {
                  await sendVerificationEmail(user);
                  toast({
                    title: 'Verification Email Sent',
                    description: 'A new verification link has been sent to your email address.',
                  });
                } catch (error: any) {
                  toast({
                    variant: 'destructive',
                    title: 'Error Sending Email',
                    description: error.message || 'Could not send verification email. Please try again later.',
                  });
                }
              }}
            >
              Resend verification email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SiteProvider setActiveView={() => {}}>
      <AppClientContent />
    </SiteProvider>
  );
}




function AppClientContent() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const { sites: allSites, setSites, allCompanies, setCompanies } = useSite();
  const { user, userProfile, loading: authLoading, logout, isSuperAdmin, isAdmin, updateUser } = useAuth();
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const { toast } = useToast();
  
  const [superAdminSelectedCompanyId, setSuperAdminSelectedCompanyId] = useState<string | null>(null);

  const [isAddSiteOpen, setAddSiteOpen] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<{ planId: PlanId, billingCycle: BillingCycle } | null>(null);
  const [companySelectorOpen, setCompanySelectorOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [runTour, setRunTour] = useState(false);
  
  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  useEffect(() => {
      if (authLoading || !user) return;
  
      let sitesUnsub = () => {};
      let companiesUnsub = () => {};
  
      if (isSuperAdmin) {
          const companiesQuery = query(collection(db, 'companies'));
          companiesUnsub = onCompanyCollectionSnapshot<Company>(companiesQuery, setCompanies);
          const sitesQuery = query(collection(db, 'sites'));
          sitesUnsub = onGlobalCollectionSnapshot(sitesQuery, setSites);
      } else if (userProfile?.companyId) {
          const companyId = userProfile.companyId;
          const companyDocRef = doc(db, 'companies', companyId);
          companiesUnsub = onSnapshot(companyDocRef, (doc) => {
              if (doc.exists()) {
                  setCompanies([{ id: doc.id, ...doc.data() } as Company]);
              } else {
                  setCompanies([]);
              }
          });
  
          const sitesQuery = query(collection(db, 'sites'), where('companyId', '==', companyId));
          sitesUnsub = onGlobalCollectionSnapshot(sitesQuery, setSites);
      }
      
      return () => {
          sitesUnsub();
          companiesUnsub();
      };
  }, [authLoading, user, userProfile, isSuperAdmin, setSites, setCompanies]);

  const companyIdForViews = isSuperAdmin ? superAdminSelectedCompanyId : userProfile?.companyId;

  // Live data for the header stats (workforce size and today's tasks).
  const [headerLabors, setHeaderLabors] = useState<Labor[]>([]);
  const [headerTasks, setHeaderTasks] = useState<Task[]>([]);
  useEffect(() => {
    if (!companyIdForViews) {
      setHeaderLabors([]);
      setHeaderTasks([]);
      return;
    }
    const unsubLabors = onGlobalCollectionSnapshot<Labor>('labors', companyIdForViews, setHeaderLabors);
    const unsubTasks = onGlobalCollectionSnapshot<Task>('tasks', companyIdForViews, setHeaderTasks);
    return () => { unsubLabors(); unsubTasks(); };
  }, [companyIdForViews]);

  const headerStats = useMemo(() => {
    const today = todayISO();
    const open = headerTasks.filter(t => t.status !== 'Done');
    return {
      dueToday: open.filter(t => t.dueDate === today).length,
      overdue: open.filter(t => t.dueDate && t.dueDate < today && t.status !== 'Blocked').length,
    };
  }, [headerTasks]);
  const currentCompany = allCompanies.find(c => c.id === companyIdForViews);
  
  useEffect(() => {
    if (isAdmin && userProfile?.hasCompletedOnboarding === false && currentCompany) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [isAdmin, userProfile, currentCompany]);

  const handleOnboardingComplete = async () => {
      if (user) {
          await updateUser(user.uid, { hasCompletedOnboarding: true });
      }
      setShowOnboarding(false);
      setRunTour(true);
  };

  const handleTourComplete = () => {
    setRunTour(false);
    setAddSiteOpen(true);
  };

  const sites = useMemo(() => {
    if (!userProfile) return [];
    
    if (isSuperAdmin) {
      if (superAdminSelectedCompanyId) {
        return allSites.filter(site => site.companyId === superAdminSelectedCompanyId);
      }
      return []; // For super admin, don't show any sites if no company is selected
    }
    
    if (!userProfile.companyId) return [];

    const companySites = allSites.filter(site => site.companyId === userProfile.companyId);
    
    if (userProfile.role === 'Admin' || userProfile.role === 'Project Manager') {
      return companySites;
    }
    
    if (userProfile.assignedSites && userProfile.assignedSites.length > 0) {
      return companySites.filter(site => userProfile.assignedSites?.includes(site.id));
    }
    
    return [];

  }, [allSites, isSuperAdmin, superAdminSelectedCompanyId, userProfile]);

  const { selectedSiteId, setSelectedSiteId, loading: sitesLoading } = useSite();

  useEffect(() => {
    if (activeView === 'sites' && (!selectedSiteId || !sites.find(s => s.id === selectedSiteId))) {
      setActiveView('dashboard');
      setSelectedSiteId(null);
    }
    if (!isAdmin && (activeView === 'users' || activeView === 'documents' || activeView === 'subscription' || activeView === 'payment' || activeView === 'documentation' || activeView === 'analysis' || activeView === 'sales' || activeView === 'threat-modeler' || activeView === 'defect-liability' || activeView === 'warranty-tracker' || activeView === 'customers' || activeView === 'landing-page-editor')) {
        setActiveView('dashboard');
    }
  }, [selectedSiteId, sites, activeView, setSelectedSiteId, isAdmin]);


  const selectedSite = sites.find(site => site.id === selectedSiteId);

  const getSubscriptionStatus = (company: Company | undefined): SubscriptionStatus | 'Active' => {
    if (!company) return 'Active'; 
    if (company.subscriptionStatus === 'Canceled') return 'Canceled';
    if (company.subscriptionEndDate && isPast(new Date(company.subscriptionEndDate))) return 'Past Due';
    return company.subscriptionStatus;
  };

  const subscriptionStatus = getSubscriptionStatus(currentCompany);
  const isSubscriptionActive = isSuperAdmin || subscriptionStatus === 'Active' || subscriptionStatus === 'Trial';
  const isCompanyLocked = !isSuperAdmin && currentCompany?.isLocked === true;


  const hasPremiumFeatures = isSuperAdmin || 
      (currentCompany?.planId?.startsWith('premium')) ||
      (currentCompany?.subscriptionStatus === 'Trial');

  const onBasicPlan = currentCompany?.planId?.startsWith('basic') && currentCompany.subscriptionStatus === 'Active';
  
  const constructionSites = useMemo(() => sites.filter(s => (s.type === 'Construction' || !s.type) && s.status !== 'Completed'), [sites]);
  const manufacturingUnits = useMemo(() => sites.filter(s => s.type === 'Manufacturing' && s.status !== 'Completed'), [sites]);
  const completedSites = useMemo(() => sites.filter(site => site.status === 'Completed'), [sites]);
  const siteLimitReached = onBasicPlan && constructionSites.length >= 5;

  const getPageTitle = () => {
    switch (activeView) {
        case 'dashboard': return 'Dashboard';
        case 'sites': return selectedSite?.name || 'Dashboard';
        case 'machines': return 'Global Machine Log';
        case 'labor': return 'Global Labor Management';
        case 'documents': return 'Company Documents';
        case 'users': return 'User & Company Management';
        case 'assistant': return 'AI Assistant';
        case 'subscription': return 'Subscription Management';
        case 'payment': return 'Complete Purchase';
        case 'completed-sites': return 'Completed Sites';
        case 'support': return 'Support Center';
        case 'documentation': return 'Documentation';
        case 'theft': return 'Theft Log';
        case 'analysis': return 'Analysis';
        case 'warehouse': return 'Warehouse';
        case 'sales': return 'Sales & Transfers';
        case 'manufacturing': return 'Manufacturing & Sales';
        case 'threat-modeler': return 'AI Threat Modeler';
        case 'defect-liability': return 'Defect Liability';
        case 'warranty-tracker': return 'Warranty Tracker';
        case 'customers': return 'Customers';
        case 'landing-page-editor': return 'Landing Page Editor';
        case 'contact-page-editor': return 'Contact Page Editor';
        default: return 'Dashboard';
    }
  }

  const showWelcomeCard = !sitesLoading && sites.length === 0 && companyIdForViews;

  
  const handlePaymentSuccess = () => {
    setActiveView('dashboard');
    setPaymentPlan(null);
  }

  const handleMenuClick = (view: ActiveView) => {
    if (isMobile) {
      setOpenMobile(false);
    }
    setSelectedSiteId(null);
    setActiveView(view);
  };
  
  if (authLoading || !user || !userProfile) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (showOnboarding && currentCompany) {
    return <OnboardingFlow companyName={currentCompany.name} onComplete={handleOnboardingComplete} />;
  }
  
  if (isCompanyLocked) {
    return (
      <LockedScreen 
        title="Company Portal Locked" 
        description="This company's portal has been locked by the administrator. Please contact support for assistance."
        onLogout={handleLogout}
      />
    );
  }

  if (!isSubscriptionActive) {
    // Admins must still be able to renew; before, an expired company was a dead end.
    if (isAdmin && currentCompany) {
      return (
        <div className="min-h-screen w-full bg-background text-foreground">
          <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div>
                <p className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> Subscription {subscriptionStatus === 'Canceled' ? 'canceled' : 'expired'}</p>
                <p className="text-sm text-muted-foreground">Choose a plan to unlock {currentCompany.name} again. Your data is safe.</p>
              </div>
              <Button variant="outline" onClick={handleLogout}>Logout</Button>
            </div>
            {activeView === 'payment' && paymentPlan ? (
              <PaymentPage
                company={currentCompany}
                planId={paymentPlan.planId}
                billingCycle={paymentPlan.billingCycle}
                onPaymentSuccess={handlePaymentSuccess}
              />
            ) : (
              <SubscriptionStatusPage
                company={currentCompany}
                onSelectPlan={(planId, billingCycle) => {
                  setPaymentPlan({ planId, billingCycle });
                  setActiveView('payment');
                }}
              />
            )}
          </div>
        </div>
      );
    }
    return (
      <LockedScreen 
        title="Subscription Expired" 
        description={`Your company's subscription is ${subscriptionStatus}. Please ask your company admin to renew it.`}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen w-full relative">
      <div className="app-grid" />
      <div className="flex min-h-screen w-full">
        <GuidedTour run={runTour} onTourComplete={handleTourComplete} />
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
                    <Logo className="h-9 w-9" />
                    <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                        <span className="text-xl font-semibold text-sidebar-primary truncate">Inventra</span>
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup id="tour-step-1-dashboard">
                    <SidebarGroupLabel>Main</SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => handleMenuClick('dashboard')}
                                isActive={activeView === 'dashboard'}
                                tooltip="Dashboard"
                                className="sidebar-menu-button"
                            >
                                <KanbanSquare />
                                <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        
                        <ProjectsMenu
                          projects={constructionSites}
                          title="Sites"
                          icon={HardHat}
                          activeView={activeView}
                          setActiveView={setActiveView}
                        />

                        <ProjectsMenu
                          projects={manufacturingUnits}
                          title="Manufacturing"
                          icon={Factory}
                          activeView={activeView}
                          setActiveView={setActiveView}
                        />
                    </SidebarMenu>
                </SidebarGroup>

                <SidebarGroup id="tour-step-2-sidebar-global">
                    <SidebarGroupLabel>Global</SidebarGroupLabel>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('warehouse')} isActive={activeView === 'warehouse'} tooltip="Warehouse" className="sidebar-menu-button">
                                <Warehouse />
                                <span className="group-data-[collapsible=icon]:hidden">Warehouse</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => handleMenuClick('machines')}
                            isActive={activeView === 'machines'}
                            tooltip="Machines"
                            className="sidebar-menu-button"
                        >
                            <Tractor />
                            <span className="group-data-[collapsible=icon]:hidden">Machines</span>
                        </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => handleMenuClick('labor')}
                            isActive={activeView === 'labor'}
                            tooltip="Labor"
                            className="sidebar-menu-button"
                        >
                            <Users />
                            <span className="group-data-[collapsible=icon]:hidden">Labor</span>
                        </SidebarMenuButton>
                        </SidebarMenuItem>
                        {isAdmin && (
                            <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('defect-liability')} isActive={activeView === 'defect-liability'} tooltip="Defect Liability" className="sidebar-menu-button">
                                <ShieldCheck />
                                <span className="group-data-[collapsible=icon]:hidden">Defect Liability</span>
                            </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                        {isAdmin && (
                            <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('warranty-tracker')} isActive={activeView === 'warranty-tracker'} tooltip="Warranty Tracker" className="sidebar-menu-button">
                                <Receipt />
                                <span className="group-data-[collapsible=icon]:hidden">Warranty Tracker</span>
                            </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                        {isAdmin && (
                            <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('customers')} isActive={activeView === 'customers'} tooltip="Customers" className="sidebar-menu-button">
                                <BookUser />
                                <span className="group-data-[collapsible=icon]:hidden">Customers</span>
                            </SidebarMenuButton>
                            </SidebarMenuItem>
                        )}
                        {isAdmin && (
                        <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => handleMenuClick('documents')}
                            isActive={activeView === 'documents'}
                            tooltip="Documents"
                            className="sidebar-menu-button"
                        >
                            <FileText />
                            <span className="group-data-[collapsible=icon]:hidden">Documents</span>
                        </SidebarMenuButton>
                        </SidebarMenuItem>
                        )}
                        {isAdmin && (
                        <SidebarMenuItem>
                            <SidebarMenuButton onClick={() => handleMenuClick('analysis')} isActive={activeView === 'analysis'} tooltip="Analysis" className="sidebar-menu-button">
                                <BarChart />
                                <span className="group-data-[collapsible=icon]:hidden">Analysis</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        )}
                        {isAdmin && (
                        <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => handleMenuClick('threat-modeler')}
                            isActive={activeView === 'threat-modeler'}
                            tooltip="Threat Modeler"
                            className="sidebar-menu-button"
                        >
                            <ShieldAlert />
                            <span className="group-data-[collapsible=icon]:hidden">Threat Modeler</span>
                        </SidebarMenuButton>
                        </SidebarMenuItem>
                        )}
                        {completedSites.length > 0 && (
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                onClick={() => handleMenuClick('completed-sites')}
                                isActive={activeView === 'completed-sites'}
                                tooltip="Completed Sites"
                                className="sidebar-menu-button"
                            >
                                <CheckCircle2 />
                                <span className="group-data-[collapsible=icon]:hidden">Completed Sites</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        )}
                    </SidebarMenu>
                </SidebarGroup>

                {isSuperAdmin && (
                    <SidebarGroup>
                        <SidebarGroupLabel>Admin</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    onClick={() => handleMenuClick('landing-page-editor')}
                                    isActive={activeView === 'landing-page-editor'}
                                    tooltip="Landing Page"
                                    className="sidebar-menu-button"
                                >
                                    <Edit />
                                    <span className="group-data-[collapsible=icon]:hidden">Landing Page</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                             <SidebarMenuItem>
                                <SidebarMenuButton
                                    onClick={() => handleMenuClick('contact-page-editor')}
                                    isActive={activeView === 'contact-page-editor'}
                                    tooltip="Contact Page"
                                    className="sidebar-menu-button"
                                >
                                    <Mail />
                                    <span className="group-data-[collapsible=icon]:hidden">Contact Page</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroup>
                )}
            </SidebarContent>
          <SidebarFooter>
                {isAdmin && !isSuperAdmin && (
                    <div id="tour-step-3-add-project" className="px-4 pb-2 group-data-[collapsible=icon]:p-2">
                        <Card className="bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground shadow-inner">
                            <CardHeader className="p-3 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:hidden">
                                <CardTitle className="text-sm">Let's start!</CardTitle>
                                <CardDescription className="text-xs text-sidebar-accent-foreground/80">Creating or adding new projects couldn't be easier.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-3 pt-0 group-data-[collapsible=icon]:p-2">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="w-full">
                                                <Button 
                                                    onClick={() => setAddSiteOpen(true)}
                                                    size="sm" 
                                                    className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:p-0"
                                                    disabled={siteLimitReached}
                                                >
                                                    <Plus />
                                                    <span className="group-data-[collapsible=icon]:hidden">New Project</span>
                                                </Button>
                                            </div>
                                        </TooltipTrigger>
                                        {siteLimitReached && (
                                            <TooltipContent side="right" align="center">
                                                <p>You have reached the 5-site limit for the Basic plan.</p>
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
                                </TooltipProvider>
                            </CardContent>
                        </Card>
                    </div>
                )}
                
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start h-auto p-2">
                            <div className="flex items-center gap-3 w-full">
                                <Avatar className="h-9 w-9">
                                <AvatarImage src={userProfile?.photoURL || ''} alt={userProfile?.name || ''} />
                                <AvatarFallback
                                    className="bg-sidebar-primary text-sidebar-primary-foreground"
                                >
                                    <User className="h-5 w-5" />
                                </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 overflow-hidden group-data-[collapsible=icon]:hidden text-left">
                                    <p className="truncate text-sm font-semibold text-sidebar-primary">{userProfile?.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">{userProfile?.email}</p>
                                </div>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 mb-2 ml-2 bg-sidebar border-sidebar-border text-sidebar-foreground" side="top" align="start">
                        <DropdownMenuLabel className="font-normal">
                            <div className="flex flex-col space-y-1">
                                <p className="text-sm font-medium leading-none">{userProfile?.name}</p>
                                <p className="text-xs leading-none text-sidebar-foreground/80">{userProfile?.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setIsSettingsOpen(true)}>
                            <SettingsIcon className="mr-2 h-4 w-4" />
                            <span>Settings</span>
                        </DropdownMenuItem>
                        {isAdmin && (
                        <>
                            <DropdownMenuItem onSelect={() => handleMenuClick('users')}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>User Management</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => handleMenuClick('subscription')}>
                            <Crown className="mr-2 h-4 w-4" />
                            <span>Subscription</span>
                            </DropdownMenuItem>
                        </>
                        )}
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <LifeBuoy className="mr-2 h-4 w-4" />
                                <span>Help &amp; Support</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    <DropdownMenuItem onClick={() => handleMenuClick('support')}>
                                        <Ticket className="mr-2 h-4 w-4" />
                                        <span>Support Center</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleMenuClick('documentation')}>
                                        <BookText className="mr-2 h-4 w-4" />
                                        <span>Documentation</span>
                                    </DropdownMenuItem>
                                    {hasPremiumFeatures && (
                                        <DropdownMenuItem onClick={() => handleMenuClick('assistant')}>
                                            <Bot className="mr-2 h-4 w-4" />
                                            <span>Chat Bot</span>
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={handleLogout} className="cursor-pointer">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log out</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-4 bg-background/80 backdrop-blur-sm px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
              <SidebarTrigger />
              <div className="flex-1 flex items-center gap-4">
                  {isSuperAdmin && currentCompany ? (
                    <>
                        <h1 className="text-lg font-semibold md:text-2xl">{currentCompany.name}</h1>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-lg text-muted-foreground font-medium">{getPageTitle()}</h2>
                    </>
                  ) : (
                    <h1 className="text-lg font-semibold md:text-2xl">{getPageTitle()}</h1>
                  )}
              </div>

              <div className="flex items-center gap-2 sm:gap-4">
                <AlertsBell
                  companyId={companyIdForViews}
                  userId={user.uid}
                  isAdmin={isAdmin}
                  sites={sites}
                  tasks={headerTasks}
                  onNavigate={(target) => {
                    if (isMobile) setOpenMobile(false);
                    if (target.view === 'site') {
                      setSelectedSiteId(target.siteId);
                      setActiveView('sites');
                    } else {
                      setSelectedSiteId(null);
                      setActiveView(target.view);
                    }
                  }}
                />
                <ThemeMenu />
                {isSuperAdmin ? (
                    <Popover open={companySelectorOpen} onOpenChange={setCompanySelectorOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-[250px] justify-between">
                                {currentCompany ? currentCompany.name : "View Own/Global"}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[250px] p-0">
                            <Command>
                                <CommandInput placeholder="Search companies..." />
                                <CommandList>
                                    <CommandEmpty>No companies found.</CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem onSelect={() => {
                                            setSuperAdminSelectedCompanyId(null);
                                            setActiveView('dashboard');
                                            setCompanySelectorOpen(false);
                                            }}>
                                            View Own/Global
                                        </CommandItem>
                                        {allCompanies.map(company => (
                                            <CommandItem
                                                key={company.id}
                                                onSelect={() => {
                                                    setSuperAdminSelectedCompanyId(company.id);
                                                    setActiveView('dashboard');
                                                    setCompanySelectorOpen(false);
                                                }}
                                            >
                                                {company.name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                ) : (
                    currentCompany && (
                      <Badge variant="outline" className="capitalize">
                        {currentCompany.planId?.startsWith('premium') ? 'Premium' : 'Basic'} Plan
                        {subscriptionStatus === 'Trial' && ' · Trial'}
                      </Badge>
                    )
                )}
              </div>
              <div className="hidden items-center gap-2 md:hidden group-data-[sidebar-open=true]:hidden">
                <Building2 className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold">Inventra</h1>
              </div>
            </header>
            <div className="px-6 py-3 bg-card/50 backdrop-blur-sm">
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <CompanyLogoTile name={currentCompany?.name || userProfile?.name || ''} logoUrl={currentCompany?.logoUrl} />
                      <div className="min-w-0">
                          <h2 className="truncate text-xl font-bold tracking-tight capitalize">{currentCompany?.name || userProfile?.name}</h2>
                          <p className="text-sm text-muted-foreground">{isSuperAdmin ? 'Super Administrator' : 'Company Dashboard'}</p>
                      </div>
                    </div>
                    <div className="hidden lg:flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="glowing-pulse h-2 w-2 rounded-full bg-green-400" />
                        <span>Active Projects: <span className="font-semibold">{sites.filter(s => s.status !== 'Completed').length}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="glowing-pulse h-2 w-2 rounded-full bg-blue-400" />
                        <span>Workforce: <span className="font-semibold">{headerLabors.length}</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="glowing-pulse h-2 w-2 rounded-full bg-yellow-400" />
                        <span>
                          Tasks Due Today: <span className="font-semibold">{headerStats.dueToday}</span>
                          {headerStats.overdue > 0 && <span className="ml-1 text-red-400">({headerStats.overdue} overdue)</span>}
                        </span>
                      </div>
                    </div>
                </div>
            </div>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden relative">
            {activeView === 'dashboard' && <DashboardPage sites={constructionSites} manufacturingUnits={manufacturingUnits} companyId={companyIdForViews} setActiveView={setActiveView} />}

            {activeView === 'sites' && (
            <>
                {selectedSiteId && selectedSite ? (
                <SiteDetails site={selectedSite} companyId={companyIdForViews} company={currentCompany}/>
                ) : (
                <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
                    <Card className="w-full max-w-md text-center shadow-none border-0 bg-transparent">
                    <CardHeader>
                        <Building2 className="h-12 w-12 mx-auto text-muted-foreground" />
                        <CardTitle className="mt-4 text-2xl">Welcome to Inventra!</CardTitle>
                        <CardDescription className="mt-2">
                        {sitesLoading ? 'Checking for existing projects...' : (sites.length > 0 ? 'Select a project from the sidebar to view its details.' : 'Create your first project to begin managing your operations.')}
                        </CardDescription>
                    </CardHeader>
                    {showWelcomeCard && isAdmin && !isSuperAdmin && (
                        <CardContent>
                            <Button onClick={() => setAddSiteOpen(true)} disabled={siteLimitReached}>
                            <Plus className="mr-2 h-4 w-4" />
                            Create New Project
                            </Button>
                            {siteLimitReached && <p className="text-sm text-destructive mt-2">5-site limit reached for Basic plan.</p>}
                        </CardContent>
                    )}
                    </Card>
                </div>
                )}
            </>
            )}
            {activeView === 'machines' && <MachinesPage companyId={companyIdForViews} />}
            {activeView === 'labor' && <LaborPage companyId={companyIdForViews} />}
            {activeView === 'assistant' && hasPremiumFeatures && <AssistantPage />}
            {activeView === 'documents' && isAdmin && <MainDocuments />}
            {activeView === 'theft' && <TheftTab siteId={selectedSiteId || ''} />}
            {activeView === 'analysis' && <AnalysisPage companyId={companyIdForViews} />}
            {activeView === 'threat-modeler' && isAdmin && <ThreatModelerPage />}
            {activeView === 'defect-liability' && isAdmin && <DefectLiabilityPage companyId={companyIdForViews} />}
            {activeView === 'warranty-tracker' && isAdmin && <WarrantyTrackerPage companyId={companyIdForViews} />}
            {activeView === 'customers' && isAdmin && <CustomersPage companyId={companyIdForViews} company={currentCompany} sites={sites} />}
            {activeView === 'warehouse' && <WarehousePage companyId={companyIdForViews} />}
            {activeView === 'manufacturing' && isAdmin && <ManufacturingPage companyId={companyIdForViews} />}
            {activeView === 'landing-page-editor' && isSuperAdmin && <LandingPageEditor />}
            {activeView === 'contact-page-editor' && isSuperAdmin && <ContactPageEditor />}
            {activeView === 'completed-sites' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Completed Projects</CardTitle>
                        <CardDescription>These are projects that have been marked as completed.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {completedSites.map(site => (
                            <div key={site.id} className="flex items-center justify-between p-4 border rounded-lg">
                                <div>
                                    <h3 className="font-semibold">{site.name}</h3>
                                    <p className="text-sm text-muted-foreground">{site.location}</p>
                                </div>
                                <Button variant="outline" size="sm" onClick={() => { setSelectedSiteId(site.id); setActiveView('sites'); }}>View Details</Button>
                            </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
            {activeView === 'subscription' && isSuperAdmin && <SubscriptionsPage allCompanies={allCompanies} />}
            {activeView === 'subscription' && isAdmin && !isSuperAdmin && (
                <SubscriptionStatusPage
                    company={currentCompany}
                    onSelectPlan={(planId, billingCycle) => {
                        setPaymentPlan({ planId, billingCycle });
                        setActiveView('payment');
                    }}
                />
            )}
            {activeView === 'payment' && isAdmin && !isSuperAdmin && currentCompany && paymentPlan &&
                <PaymentPage
                    company={currentCompany}
                    planId={paymentPlan.planId}
                    billingCycle={paymentPlan.billingCycle}
                    onPaymentSuccess={handlePaymentSuccess}
                />
            }
            {activeView === 'users' && isAdmin && <UserRightsTab company={currentCompany} companyId={companyIdForViews}/>}
            {activeView === 'support' && userProfile && <SupportPage userProfile={userProfile} />}
            {activeView === 'documentation' && isAdmin && <DocumentationPage />}
          </main>
        </div>
        <AddSiteDialog open={isAddSiteOpen} onOpenChange={setAddSiteOpen} />
        <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
        {hasPremiumFeatures && <FloatingAssistant />}
      </div>

    </div>
  );
}
