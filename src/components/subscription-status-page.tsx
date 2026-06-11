

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Company, SubscriptionStatus, PlanId, BillingCycle, Plan } from '@/lib/types';
import { Check, Crown, Loader2 } from 'lucide-react';
import { format, isPast, isValid } from 'date-fns';
import { useState, useEffect } from 'react';
import { PaymentHistory } from './payment-history';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/utils';
import { onGlobalCollectionSnapshot } from '@/context/site-context';

interface SubscriptionStatusPageProps {
  company: Company | undefined;
  onSelectPlan: (planId: PlanId, billingCycle: BillingCycle) => void;
}

const defaultPlans: Plan[] = [
  {
    id: 'basic_default',
    name: 'basic',
    priceMonthly: 2999,
    priceAnnually: 29999,
    features: ['Up to 5 sites', 'Up to 10 users', 'Core feature access', 'Email support'],
  },
  {
    id: 'premium_default',
    name: 'premium',
    priceMonthly: 5999,
    priceAnnually: 59999,
    features: ['Unlimited sites', 'Unlimited users', 'All features included', 'AI Assistant', 'Priority support'],
  },
];


export function SubscriptionStatusPage({ company, onSelectPlan }: SubscriptionStatusPageProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('annually');
    const [plans, setPlans] = useState<Plan[]>(defaultPlans);
    const { toast } = useToast();

    useEffect(() => {
        setIsLoading(!company);
        // Fetch dynamic plans and merge with defaults
        const unsub = onGlobalCollectionSnapshot<Plan>('plans', null, (fetchedPlans) => {
            const combinedPlans = [...defaultPlans];
            fetchedPlans.forEach(fetchedPlan => {
                const existingIndex = combinedPlans.findIndex(p => p.name === fetchedPlan.name);
                if (existingIndex > -1) {
                    // Replace default with fetched if name matches
                    combinedPlans[existingIndex] = fetchedPlan;
                } else {
                    combinedPlans.push(fetchedPlan);
                }
            });
            setPlans(combinedPlans);
            setIsLoading(false);
        });
        return () => unsub();
    }, [company]);

    if (isLoading) {
      return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }
    
    if (!company) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Error</CardTitle>
                    <CardDescription>Could not load company subscription data.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    const getStatus = (company: Company): SubscriptionStatus => {
        if (company.subscriptionStatus === 'Canceled') {
        return 'Canceled';
        }
        if (company.subscriptionEndDate && isPast(new Date(company.subscriptionEndDate))) {
        return 'Past Due';
        }
        return company.subscriptionStatus;
    };

    const status = getStatus(company);
    
    const currentPlanId = status === 'Trial' ? 'premium' : company.planId.split('-')[0];
    const currentPlanDetails = plans.find(p => p.name === currentPlanId);


    const getStatusVariant = (status: SubscriptionStatus) => {
        switch (status) {
        case 'Active':
        case 'Trial':
            return 'secondary';
        case 'Past Due':
            return 'destructive';
        case 'Canceled':
            return 'outline';
        default:
            return 'default';
        }
    };
    
    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (!isValid(date)) return 'Invalid Date';
        return format(date, 'PPP');
    };


  return (
    <div className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                <Crown /> Your Subscription
                </CardTitle>
                <CardDescription>View your current plan details and status.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold">Current Plan</h3>
                        <p className="text-3xl font-bold capitalize">{currentPlanId} Plan</p>

                        <h3 className="text-lg font-semibold pt-4">Status</h3>
                        <Badge variant={getStatusVariant(status)} className="text-base px-4 py-1">{status}</Badge>

                        <h3 className="text-lg font-semibold pt-4">
                            {status === 'Past Due' || status === 'Canceled' ? 'Plan Ended On' : 'Valid Until'}
                        </h3>
                        <p>{formatDate(company.subscriptionEndDate)}</p>
                    </div>
                     <div className="space-y-4">
                        {(status === 'Past Due' || status === 'Canceled') && (
                            <Card className="bg-destructive/10 border-destructive">
                                <CardHeader>
                                    <CardTitle>Action Required</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="mb-4">Your subscription has expired. Please choose a plan to renew your subscription and restore full access.</p>
                                </CardContent>
                            </Card>
                        )}
                        {status === 'Trial' && (
                             <Card className="bg-secondary/50 border-secondary">
                                <CardHeader>
                                    <CardTitle>Welcome to Your Trial!</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="mb-4">You are currently on a free trial of the Premium Plan. Enjoy all features until your trial expires. Choose a plan below to start your subscription.</p>
                                </CardContent>
                            </Card>
                        )}
                     </div>
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-center items-center gap-4">
            <Label htmlFor="billing-cycle" className={billingCycle === 'monthly' ? 'font-bold' : 'text-muted-foreground'}>
                Monthly
            </Label>
            <Switch
                id="billing-cycle"
                checked={billingCycle === 'annually'}
                onCheckedChange={(checked) => setBillingCycle(checked ? 'annually' : 'monthly')}
            />
            <Label htmlFor="billing-cycle" className={billingCycle === 'annually' ? 'font-bold' : 'text-muted-foreground'}>
                Annually (Save over 15%)
            </Label>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 pt-8">
            {plans.map((plan) => (
              <Card key={plan.id} className={`flex flex-col ${plan.name === currentPlanId && status !== 'Canceled' && status !== 'Past Due' ? 'border-primary' : ''}`}>
                <CardHeader>
                  <CardTitle className="capitalize">{plan.name}</CardTitle>
                  <CardDescription className="flex items-baseline">
                    <span className="text-3xl font-bold">{formatCurrency(billingCycle === 'annually' ? plan.priceAnnually : plan.priceMonthly)}</span>
                    <span className="text-muted-foreground">/{billingCycle === 'annually' ? 'year' : 'month'}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                 <CardContent>
                    {status === 'Active' && plan.name === currentPlanId && company.billingCycle === billingCycle ? (
                         <Button className="w-full" disabled>Your Current Plan</Button>
                    ) : (
                         <Button 
                            variant={plan.name === currentPlanId ? 'default' : 'outline'}
                            className="w-full"
                            onClick={() => onSelectPlan(plan.name, billingCycle)}
                        >
                           {plan.name === currentPlanId ? 'Renew Plan' : (plan.name === 'premium' ? 'Upgrade to Premium' : 'Select Basic Plan')}
                        </Button>
                    )}
                 </CardContent>
              </Card>
            ))}
        </div>
        <PaymentHistory companyId={company.id} />
    </div>
  );
}
