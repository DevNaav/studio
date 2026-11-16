
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Loader2, CreditCard } from 'lucide-react';
import { Company, PlanId, BillingCycle, FullPlanId } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { recordPaymentAndUpdateSubscription } from '@/context/site-context';
import { addYears, addMonths, format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { planById, priceFor } from '@/lib/plans';
import { useAuth } from '@/context/auth-context';
import { getIdTokenOrThrow } from '@/lib/id-token';

const paymentSchema = z.object({
  cardName: z.string().min(2, 'Name on card is required.'),
  cardNumber: z.string().regex(/^\d{16}$/, 'Card number must be 16 digits.'),
  expiryDate: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Expiry date must be in MM/YY format.'),
  cvc: z.string().regex(/^\d{3,4}$/, 'CVC must be 3 or 4 digits.'),
});


interface PaymentPageProps {
  company: Company;
  planId: PlanId;
  billingCycle: BillingCycle;
  onPaymentSuccess: () => void;
}

export function PaymentPage({ company, planId, billingCycle, onPaymentSuccess }: PaymentPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const plan = planById(planId)!;
  const selectedPlan = { name: `${plan.name} Plan` };
  // The price comes from the shared list (src/lib/plans.ts); that is exactly what's charged.
  const price = priceFor(plan, billingCycle);
  const fullPlanId: FullPlanId = `${planId}-${billingCycle}`;

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      cardName: '',
      cardNumber: '',
      expiryDate: '',
      cvc: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof paymentSchema>) => {
    setIsLoading(true);

    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      const now = new Date();
      // Renewing early adds to the time already paid for instead of throwing it away.
      // (A trial's remaining days are not carried over.)
      const currentEnd = company.subscriptionEndDate ? new Date(company.subscriptionEndDate) : null;
      const base = company.subscriptionStatus === 'Active' && currentEnd && currentEnd > now ? currentEnd : now;
      const newEndDate = billingCycle === 'annually' ? addYears(base, 1) : addMonths(base, 1);
      
      const { paymentId, invoiceNumber } = await recordPaymentAndUpdateSubscription(
        company.id,
        {
            planId: fullPlanId,
            billingCycle: billingCycle,
            subscriptionStatus: 'Active',
            subscriptionEndDate: newEndDate.toISOString(),
        },
        {
            planId: fullPlanId,
            amount: price,
            paymentDate: now.toISOString(),
        }
      );

      // The bill: download the invoice PDF right away (also in Payment History later).
      try {
        const { buildInvoicePdf } = await import('@/lib/invoice-pdf');
        buildInvoicePdf({
          invoiceNumber, paymentDate: now.toISOString(), planId: fullPlanId, amount: price,
          companyName: company.name, buyerName: user?.displayName, buyerEmail: user?.email,
          periodEnd: newEndDate.toISOString(),
        }).save(`${invoiceNumber}.pdf`);
      } catch (e) {
        console.error('Invoice download failed', e);
      }

      // Confirmation email with the invoice attached (sent to the buyer's own address).
      let emailNote = 'Your invoice has been downloaded.';
      try {
        const res = await fetch('/api/billing/confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdTokenOrThrow()}` },
          body: JSON.stringify({ paymentId }),
        });
        const result = await res.json().catch(() => ({}));
        if (result.sent) emailNote = `A confirmation email with your invoice was sent to ${result.to}.`;
      } catch (e) {
        console.error('Confirmation email failed', e);
      }

      toast({
        title: 'Payment Successful!',
        description: `Your ${selectedPlan.name} is now active. ${emailNote}`,
        duration: 8000,
      });
      onPaymentSuccess();
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Payment Failed',
        description: 'Could not update your subscription. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-start pt-10">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 shrink-0 text-primary" /> Complete Your Purchase</CardTitle>
          <CardDescription>You are purchasing the {selectedPlan.name} ({billingCycle}) for <strong>{formatCurrency(price)}</strong>/{billingCycle === 'annually' ? 'year' : 'month'}.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                 <FormField
                  control={form.control}
                  name="cardName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name on Card</FormLabel>
                      <FormControl>
                        <Input placeholder="John M. Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cardNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Card Number</FormLabel>
                      <FormControl>
                        <Input placeholder="0000 0000 0000 0000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl>
                          <Input placeholder="MM/YY" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cvc"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>CVC</FormLabel>
                        <FormControl>
                          <Input placeholder="123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <CardFooter className="p-0 pt-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Pay Now ({ formatCurrency(price) })
                </Button>
              </CardFooter>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
