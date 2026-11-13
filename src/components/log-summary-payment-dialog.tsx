
'use client';

import { useEffect, useState } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { paymentMethods } from '@/lib/types';
import { distributePaymentToSales } from '@/context/site-context';
import { Loader2 } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { useAuth } from '@/context/auth-context';
import { formatCurrency, todayISO } from '@/lib/utils';

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.string().min(1, 'Date is required'),
  method: z.enum(paymentMethods, { required_error: 'Payment method is required.' }),
  notes: z.string().optional(),
});

interface LogSummaryPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinationId: string;
  destinationName: string;
  outstandingBalance: number;
  siteId: string;
}

export function LogSummaryPaymentDialog({
  open,
  onOpenChange,
  destinationId,
  destinationName,
  outstandingBalance,
  siteId,
}: LogSummaryPaymentDialogProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: outstandingBalance > 0 ? outstandingBalance : 0,
        date: todayISO(),
        method: undefined,
        notes: '',
      });
    }
  }, [open, outstandingBalance, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId) return;
    setIsSubmitting(true);
    
    try {
      await distributePaymentToSales(userProfile.companyId, siteId, destinationId, {
          amount: values.amount,
          date: values.date,
          method: values.method,
          notes: values.notes,
      });

      toast({
        title: "Payment Logged",
        description: `A payment of ${formatCurrency(values.amount)} for ${destinationName} has been distributed.`,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to distribute payment:", error);
      toast({ variant: 'destructive', title: "Operation Failed", description: error instanceof Error ? error.message : "Could not log and distribute the payment." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Payment for {destinationName}</DialogTitle>
          <DialogDescription>
            Outstanding balance is {formatCurrency(outstandingBalance)}. The payment will be applied to the oldest unpaid sales first.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Amount (Rs.)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 5000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethods.map(method => (
                          <SelectItem key={method} value={method}>{method}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Advance payment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Log & Distribute Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
