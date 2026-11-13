'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Machine } from '@/lib/types';
import { addDocWithSiteId, updateDocWithId } from '@/context/site-context';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface ReleaseMachineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine: Machine & { totalCost: number; balance: number };
  siteId: string;
  companyId: string;
}

/**
 * Releases a rented machine from a site: unassigns it and, if rent is still
 * owed, logs the outstanding balance as a final Rental expense for the site.
 */
export function ReleaseMachineDialog({ open, onOpenChange, machine, siteId, companyId }: ReleaseMachineDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    returnDate: z.string().min(1, 'Return date is required'),
    remarks: z.string().optional(),
  }).refine(
    (data) => !machine.assignmentDate || new Date(data.returnDate) >= new Date(machine.assignmentDate),
    { message: 'Return date cannot be before the machine was assigned.', path: ['returnDate'] },
  );

  const form = useForm<z.infer<typeof formSchema>>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (open) {
      form.reset({ returnDate: new Date().toISOString().split('T')[0], remarks: '' });
    }
  }, [open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      if (machine.balance > 0) {
        await addDocWithSiteId('expenses', companyId, siteId, {
          description: `Final rental settlement for ${machine.name}${values.remarks ? ` — ${values.remarks}` : ''}`,
          category: 'Rental' as const,
          amount: machine.balance,
          date: values.returnDate,
          machineId: machine.id,
        });
      }
      await updateDocWithId('machines', machine.id, { assignedSiteId: null, assignmentDate: null });

      toast({ title: 'Machine Released', description: `${machine.name} has been released from this site.` });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to release machine:', error);
      toast({ variant: 'destructive', title: 'Operation Failed', description: 'Could not release the machine.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Release {machine.name}</DialogTitle>
          <DialogDescription>
            Rent accrued so far is {formatCurrency(machine.totalCost)}; the outstanding balance is {formatCurrency(Math.max(machine.balance, 0))}.
            {machine.balance > 0
              ? ' Confirming will unassign the machine and log the outstanding balance as a site expense.'
              : ' Confirming will unassign the machine from this site.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            <FormField control={form.control} name="returnDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Return Date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="remarks" render={({ field }) => (
              <FormItem>
                <FormLabel>Remarks (optional)</FormLabel>
                <FormControl><Textarea placeholder="Condition on return, notes…" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Release Machine
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
