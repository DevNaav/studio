
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
import { useToast } from '@/hooks/use-toast';
import { RentedMaterial } from '@/lib/types';
import { updateDocWithId, addDocWithSiteId } from '@/context/site-context';
import { Loader2 } from 'lucide-react';
import { Textarea } from './ui/textarea';
import { format, isBefore } from 'date-fns';
import { formatCurrency, todayISO } from '@/lib/utils';

interface FinalizeRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: RentedMaterial & { totalCost: number; balance: number; };
  companyId: string;
}

export function FinalizeRentalDialog({ open, onOpenChange, material, companyId }: FinalizeRentalDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formSchema = z.object({
    returnDate: z.string().min(1, 'Return date is required'),
    remarks: z.string().optional(),
  }).refine((data) => new Date(data.returnDate) >= new Date(material.startDate), {
    message: "Return date cannot be before the start date.",
    path: ["returnDate"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        returnDate: todayISO(),
        remarks: 'Material returned in good condition.',
      });
    }
  }, [open, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    
    try {
      await updateDocWithId('rented_materials', material.id, {
        status: 'Returned',
        returnDate: values.returnDate,
        remarks: `${material.remarks || ''}\nReturn: ${values.remarks}`,
      });

      if (material.totalCost > 0) {
        await addDocWithSiteId('expenses', companyId, material.siteId, {
            description: `Final rental cost for ${material.materialName}`,
            category: 'Rental' as const,
            amount: material.totalCost,
            date: values.returnDate,
            rentedMaterialId: material.id, // Add this link
        });
      }

      toast({ title: "Material Released", description: `${material.materialName} has been marked as returned.` });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to finalize rental:", error);
      toast({ variant: 'destructive', title: "Operation Failed", description: "Could not release the material." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Release {material.materialName}</DialogTitle>
          <DialogDescription>
            The total cost for this rental is {formatCurrency(material.totalCost)}. 
            The outstanding balance is {formatCurrency(material.balance)}. 
            Confirming will mark the item as returned and log the total cost as a site expense.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <fieldset disabled={isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="returnDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} min={material.startDate} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Return Remarks (Optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g., Any damages or notes" {...field} />
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
                Confirm Release
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
