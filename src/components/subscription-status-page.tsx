

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
import { PLANS, planById, priceFor } from '@/lib/plans';

interface SubscriptionStatusPageProps {
  company: Company | undefined;
  onSelectPlan: (planId: PlanId, billingCycle: BillingCycle) => void;
}

export function SubscriptionStatusPage({ company, onSelectPlan }: SubscriptionStatusPageProps) {
    const [billingCycle, setBillingCycle] = useState<BillingCycle>('annually');
    const isLoading = false;

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
    
    const currentPlanId = status === 'Trial' ? 'premium' : company.planId?.split('-')[0];
    const currentPlan = planById(currentPlanId);


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
                        <p className="text-3xl font-bold">{currentPlan?.name ?? currentPlanId} Plan{status === 'Trial' ? ' (trial)' : ''}</p>

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
                                    <p className="mb-4">You are on a free trial with everything in the Business plan. Enjoy all features until your trial expires. Choose a plan below to start your subscription.</p>
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
                Annually (2 months free)
            </Label>
        </div>
        
        <div className="grid gap-6 pt-8 md:grid-cols-3">
            {PLANS.map((plan) => (
              <Card key={plan.id} className={`flex flex-col ${plan.id === currentPlanId && status !== 'Canceled' && status !== 'Past Due' ? 'border-primary' : ''}`}>
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription className="flex flex-wrap items-baseline gap-x-1">
                    <span className="text-3xl font-bold text-foreground">{formatCurrency(priceFor(plan, billingCycle))}</span>
                    <span className="text-muted-foreground">/{billingCycle === 'annually' ? 'year' : 'month'}</span>
                  </CardDescription>
                  <p className="text-sm text-muted-foreground">{plan.blurb}</p>
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
                    {status === 'Active' && plan.id === currentPlanId && company.billingCycle === billingCycle ? (
                         <Button className="w-full" disabled>Your Current Plan</Button>
                    ) : (
                         <Button 
                            variant={plan.id === currentPlanId ? 'default' : 'outline'}
                            className="w-full"
                            onClick={() => onSelectPlan(plan.id, billingCycle)}
                        >
                           {plan.id === currentPlanId && status !== 'Trial' ? 'Renew Plan' : `Choose ${plan.name}`}
                        </Button>
                    )}
                 </CardContent>
              </Card>
            ))}
        </div>
        <p className="text-center text-sm text-muted-foreground">
            Need more than 50 users? <a href="/contact" className="font-medium underline underline-offset-4">Contact us about Enterprise</a>.
        </p>
        <PaymentHistory companyId={company.id} />
    </div>
  );
}
