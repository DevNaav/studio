
'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Sale, paymentMethods, SalePayment, SalePaymentStatus } from '@/lib/types';
import { updateDocWithId } from '@/context/site-context';
import { Loader2 } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { formatCurrency } from '@/lib/utils';

const formSchema = z.object({
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.string().min(1, 'Date is required'),
  method: z.enum(paymentMethods, { required_error: 'Payment method is required.' }),
  notes: z.string().optional(),
});

interface LogSalePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale;
}

export function LogSalePaymentDialog({ open, onOpenChange, sale }: LogSalePaymentDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const balanceDue = useMemo(() => {
    return sale.salePrice - sale.amountPaid;
  }, [sale.salePrice, sale.amountPaid]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        amount: balanceDue > 0 ? balanceDue : 0,
        date: new Date().toISOString().split('T')[0],
        method: undefined,
        notes: '',
      });
    }
  }, [open, balanceDue, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    
    const newPayment: SalePayment = {
      amount: values.amount,
      date: values.date,
      method: values.method,
      notes: values.notes,
    };
    
    const newAmountPaid = sale.amountPaid + newPayment.amount;
    const newBalance = sale.salePrice - newAmountPaid;

    let newPaymentStatus: SalePaymentStatus = 'Partially Paid';
    if (newBalance <= 0) {
      newPaymentStatus = 'Paid';
    } else if (newAmountPaid === 0) {
      newPaymentStatus = 'Unpaid';
    }

    try {
      await updateDocWithId('sales', sale.id, {
        amountPaid: newAmountPaid,
        paymentStatus: newPaymentStatus,
        paymentHistory: [...(sale.paymentHistory ?? []), newPayment],
      });

      toast({ title: "Payment Logged", description: `A payment of ${formatCurrency(values.amount)} has been logged.` });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to log payment:", error);
      toast({ variant: 'destructive', title: "Operation Failed", description: "Could not log the payment." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Payment for Sale</DialogTitle>
          <DialogDescription>
            Record a payment for "{sale.gradeName}". Balance due is {formatCurrency(balanceDue)}.
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
                Log Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
