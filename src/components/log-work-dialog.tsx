'use client';

import { useState, useEffect } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { Labor } from '@/lib/types';
import { useAuth } from '@/context/auth-context';
import { Loader2 } from 'lucide-react';
import { writeBatch, collection, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { formatCurrency, todayISO } from '@/lib/utils';
import { logActivity } from '@/lib/activity-log';

const workLogSchema = z.object({
  laborerId: z.string().min(1, 'Please select a laborer.'),
  quantity: z.coerce.number().min(0.01, 'Quantity must be greater than 0.'),
  date: z.string().min(1, 'Date is required'),
});

interface LogWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  siteId: string;
  contractLabors: Labor[];
}

export function LogWorkDialog({ open, onOpenChange, siteId, contractLabors }: LogWorkDialogProps) {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof workLogSchema>>({
    resolver: zodResolver(workLogSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        laborerId: undefined,
        quantity: 0,
        date: todayISO(),
      });
    }
  }, [open, form]);

  const onWorkLogSubmit = async (values: z.infer<typeof workLogSchema>) => {
    if (!userProfile?.companyId) return;

    const laborer = contractLabors.find(l => l.id === values.laborerId);
    if (!laborer || !laborer.pricePerUnit) {
      toast({ variant: 'destructive', title: 'Error', description: 'Selected laborer does not have a contract price per unit.' });
      return;
    }

    setIsSubmitting(true);
    const wageEarned = values.quantity * laborer.pricePerUnit;
    const companyId = userProfile.companyId;

    const batch = writeBatch(db);

    const workLogRef = doc(collection(db, 'work_logs'));
    const workLogData = {
      ...values,
      companyId,
      siteId,
      unit: laborer.unit,
      pricePerUnit: laborer.pricePerUnit,
      wageEarned,
      isDeleted: false,
    };
    batch.set(workLogRef, workLogData);

    const transactionRef = doc(collection(db, 'labor_transactions'));
    const transactionData = {
      laborId: values.laborerId,
      companyId,
      siteId,
      type: 'Work',
      amount: wageEarned,
      date: values.date,
      description: `${values.quantity} ${laborer.unit || ''} of ${laborer.contractType || 'work'}.`,
      isDeleted: false,
    };
    batch.set(transactionRef, transactionData);

    try {
      await batch.commit();
      logActivity({
        companyId, siteId, action: 'create', entity: 'work_logs', entityId: workLogRef.id, label: laborer.name,
        summary: `Logged work for ${laborer.name}: ${values.quantity} ${laborer.unit || ''} · Rs. ${wageEarned.toLocaleString('en-IN')} (${values.date})`,
      });
      toast({ title: 'Work Logged', description: `Logged ${values.quantity} ${laborer.unit} for ${laborer.name}, earning ${formatCurrency(wageEarned)}.` });
      onOpenChange(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to log work.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Contract Work</DialogTitle>
          <DialogDescription>
            Record the work completed by a contract-based laborer to calculate their wage.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onWorkLogSubmit)} className="space-y-4 py-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="laborerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Laborer</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a contract laborer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contractLabors.map(laborer => (
                          <SelectItem key={laborer.id} value={laborer.id}>{laborer.name} ({laborer.contractType})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity of Work Done</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g., 150" {...field} />
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
                Log Work
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
