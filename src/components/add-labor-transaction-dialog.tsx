
'use client';

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
import { Labor, LaborTransaction, laborTransactionTypes, paymentMethods } from '@/lib/types';
import { addDocToGlobalCollection } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { formatCurrency, todayISO } from '@/lib/utils';

const formSchema = z.object({
  laborId: z.string({ required_error: "Please select a laborer." }).min(1, 'Please select a laborer.'),
  type: z.enum(laborTransactionTypes, { required_error: "Please select a transaction type." }),
  paymentMethod: z.enum(paymentMethods).optional(),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.string().min(1, 'Date is required'),
});

interface AddLaborTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labors: Labor[];
  siteId: string;
}

export function AddLaborTransactionDialog({ open, onOpenChange, labors, siteId }: AddLaborTransactionDialogProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      laborId: '',
      type: undefined,
      paymentMethod: undefined,
      amount: 0,
      date: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        laborId: '',
        type: undefined,
        paymentMethod: undefined,
        amount: 0,
        date: todayISO(),
      });
    }
  }, [open, form]);

  const transactionType = form.watch('type');

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId) {
        toast({ variant: 'destructive', title: "Operation Failed", description: "User is not associated with a company." });
        return;
    }
    setIsSubmitting(true);
    try {
      const labor = labors.find(l => l.id === values.laborId);
      if (!labor) throw new Error("Selected laborer not found.");
      
      const transactionData: Partial<LaborTransaction> = { ...values, siteId };
      if(values.type !== 'Payment') {
        delete transactionData.paymentMethod;
      }

      await addDocToGlobalCollection('labor_transactions', userProfile.companyId, transactionData);

      toast({ title: "Transaction Logged", description: `A ${values.type} of ${formatCurrency(values.amount)} has been logged for ${labor.name}.` });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to log transaction:", error);
      toast({ variant: 'destructive', title: "Operation Failed", description: "Could not log the transaction. Please try again." });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Labor Transaction</DialogTitle>
          <DialogDescription>
            Record a payment for a laborer.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="laborId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Laborer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a laborer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {labors.map(labor => (
                          <SelectItem key={labor.id} value={labor.id}>{labor.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Transaction Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose an option" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {laborTransactionTypes.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {transactionType === 'Payment' && (
                <FormField
                  control={form.control}
                  name="paymentMethod"
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
              )}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (Rs.)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 500" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                Log Transaction
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
