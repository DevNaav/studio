'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Check, CreditCard, PartyPopper, Rocket, Warehouse, Tractor, Users, Bot, BarChart, HardHat } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Separator } from './ui/separator';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { BillingCycle, PlanId } from '@/lib/types';

const paymentSchema = z.object({
  cardName: z.string().min(2, 'Name on card is required.'),
  cardNumber: z.string().regex(/^\d{16}$/, 'Card number must be 16 digits.'),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry date must be in MM/YY format.'),
  cvc: z.string().regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits.'),
});

const plans = [
  {
    id: 'basic' as const,
    name: 'Basic Plan',
    priceMonthly: '₹2,999/month',
    priceAnnually: '₹29,999/year',
    features: ['Up to 5 sites', 'Up to 10 users', 'Core feature access', 'Email support'],
  },
  {
    id: 'premium' as const,
    name: 'Premium Plan',
    priceMonthly: '₹5,999/month',
    priceAnnually: '₹59,999/year',
    features: ['Unlimited sites', 'Unlimited users', 'All features included', 'AI Assistant', 'Priority support'],
  },
];


interface OnboardingFlowProps {
  companyName: string;
  onComplete: () => void;
}

export function OnboardingFlow({ companyName, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(1);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('premium');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annually');

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      cardName: '',
      cardNumber: '',
      expiryDate: '',
      cvc: '',
    },
  });

  const onSubmit = () => {
    // This is a simulation, so we just move to the next step
    setStep(4);
  };
  
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">Welcome to Inventra, {companyName}!</DialogTitle>
              <DialogDescription className="text-center">
                We're excited to have you. Let's get your account set up.
              </DialogDescription>
            </DialogHeader>
            <div className="text-center p-6">
                <PartyPopper className="h-16 w-16 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">You're Starting on a 2-Month Premium Trial!</h3>
                <p className="text-muted-foreground">
                    For the next 2 months, you'll have complete access to all our premium features, completely free.
                    After the trial, you can choose to subscribe to continue using the service. No charges will be made until then.
                </p>
            </div>
            <DialogFooter>
              <Button onClick={() => setStep(2)}>Let's Go!</Button>
            </DialogFooter>
          </>
        );
      case 2:
        return (
          <>
            <DialogHeader>
              <DialogTitle>Our Plans for the Future</DialogTitle>
              <DialogDescription>
                Here's a look at our plans for when your trial ends. You are currently on the Premium Plan.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center items-center gap-4 py-4">
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
            <div className="grid md:grid-cols-2 gap-4 py-4">
              {plans.map((plan) => (
                <Card key={plan.id} className={`flex flex-col cursor-pointer ${plan.id === selectedPlan ? 'border-primary ring-2 ring-primary' : ''}`} onClick={() => setSelectedPlan(plan.id)}>
                  <CardHeader>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription className="flex items-baseline">
                      <span className="text-2xl font-bold">{billingCycle === 'annually' ? plan.priceAnnually : plan.priceMonthly}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-2">
                    <ul className="space-y-2 text-sm">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={() => setStep(3)}>Next</Button>
            </DialogFooter>
          </>
        );
       case 3:
        return (
          <>
            <DialogHeader>
              <DialogTitle>Set Up Future Billing</DialogTitle>
              <DialogDescription>
                Add a payment method now for a seamless transition after your trial. You will not be charged today.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                 <FormField control={form.control} name="cardName" render={({ field }) => (
                    <FormItem><FormLabel>Name on Card</FormLabel><FormControl><Input placeholder="John M. Doe" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <FormField control={form.control} name="cardNumber" render={({ field }) => (
                    <FormItem><FormLabel>Card Number</FormLabel><FormControl><Input placeholder="0000 0000 0000 0000" {...field} /></FormControl><FormMessage /></FormItem>
                  )}/>
                  <div className="flex gap-4">
                    <FormField control={form.control} name="expiryDate" render={({ field }) => (
                      <FormItem className="flex-1"><FormLabel>Expiry Date</FormLabel><FormControl><Input placeholder="MM/YY" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={form.control} name="cvc" render={({ field }) => (
                      <FormItem className="flex-1"><FormLabel>CVC</FormLabel><FormControl><Input placeholder="123" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                  </div>
                 <p className="text-xs text-muted-foreground text-center pt-2">
                    We charge 1 rupee for card verification. This is a demo, your card details will not be saved or charged. This step is for demonstration purposes only.
                </p>
                <DialogFooter className="pt-4">
                    <Button variant="ghost" onClick={() => setStep(2)}>Back</Button>
                    <Button type="submit">Save and Start Tour</Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        );
      case 4:
         return (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-2xl">You're All Set!</DialogTitle>
              <DialogDescription className="text-center">
                Your account is ready to go. We'll start with a quick tour of the application.
              </DialogDescription>
            </DialogHeader>
            <div className="text-center p-6">
                <Rocket className="h-16 w-16 mx-auto text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">Welcome Aboard</h3>
                <p className="text-muted-foreground">
                    Click the button below to begin the interactive tour of Inventra.
                </p>
            </div>
            <DialogFooter>
              <Button onClick={onComplete} className="w-full">Start Tour</Button>
            </DialogFooter>
          </>
        );
      default:
        return null;
    }
  }

  const totalSteps = 4;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-3xl" onInteractOutside={(e) => e.preventDefault()} hideCloseButton={true}>
        <div className="flex justify-center items-center py-4">
            <div className="flex items-center gap-4">
                {[...Array(totalSteps)].map((_, i) => {
                    const s = i + 1;
                    return (
                        <div key={s} className="flex items-center gap-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                {step > s ? <Check /> : s}
                            </div>
                            {s < totalSteps && <Separator className={`w-12 transition-colors ${step > s ? 'bg-primary' : 'bg-border'}`} />}
                        </div>
                    );
                })}
            </div>
        </div>
        <Separator />
        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
