
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Site, Warranty } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { addDocWithSiteId, updateDocWithId } from '@/context/site-context';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { differenceInDays, isPast } from 'date-fns';
import { Badge } from './ui/badge';

const formSchema = z.object({
  productName: z.string().min(2, 'Product name is too short'),
  brand: z.string().optional(),
  serialNumber: z.string().optional(),
  siteId: z.string().min(1, 'Please select a site.'),
  purchaseDate: z.string().min(1, 'Purchase date is required.'),
  endDate: z.string().min(1, 'Warranty end date is required.'),
  vendorInfo: z.string().optional(),
  issueDescription: z.string().optional(),
}).refine(data => new Date(data.endDate) > new Date(data.purchaseDate), {
    message: "End date must be after purchase date.",
    path: ["endDate"],
});


interface AddWarrantyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sites: Site[];
  companyId: string | null | undefined;
  existingWarranty?: Warranty | null;
}

export function AddWarrantyDialog({ isOpen, onOpenChange, sites, companyId, existingWarranty }: AddWarrantyDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const purchaseDate = form.watch('purchaseDate');
  const endDate = form.watch('endDate');

  const { duration, daysLeft, status } = useMemo(() => {
    if (!purchaseDate || !endDate) {
      return { duration: null, daysLeft: null, status: null };
    }
    const start = new Date(purchaseDate);
    const end = new Date(endDate);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        return { duration: null, daysLeft: null, status: null };
    }
    
    const duration = differenceInDays(end, start);
    const daysLeft = differenceInDays(end, now);
    const status = isPast(end) ? 'Expired' : 'Active';

    return { duration, daysLeft, status };
  }, [purchaseDate, endDate]);


  useEffect(() => {
    if (isOpen) {
      if (existingWarranty) {
        form.reset({
          ...existingWarranty,
          brand: existingWarranty.brand || '',
          serialNumber: existingWarranty.serialNumber || '',
          vendorInfo: existingWarranty.vendorInfo || '',
          issueDescription: existingWarranty.issueDescription || '',
        });
      } else {
        form.reset({
          productName: '',
          brand: '',
          serialNumber: '',
          siteId: '',
          purchaseDate: '',
          endDate: '',
          vendorInfo: '',
          issueDescription: '',
        });
      }
    }
  }, [isOpen, existingWarranty, form]);


  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    const warrantyData = {
        ...values,
        type: 'Product' as const,
        responsibleParty: values.vendorInfo || 'N/A',
    };
    try {
        if (existingWarranty) {
            await updateDocWithId('warranties', existingWarranty.id, warrantyData);
            toast({ title: 'Warranty Updated' });
        } else {
            await addDocWithSiteId('warranties', companyId, values.siteId, warrantyData);
            toast({ title: 'Warranty Added' });
        }
        onOpenChange(false);
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to save warranty.' });
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{existingWarranty ? 'Edit' : 'Add'} Product Warranty</DialogTitle>
          <DialogDescription>Track a new product warranty and its details.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="col-span-1 space-y-4">
              <FormField control={form.control} name="productName" render={({ field }) => (
                <FormItem><FormLabel>Product Name</FormLabel><FormControl><Input placeholder="e.g., Water Pump" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="brand" render={({ field }) => (
                <FormItem><FormLabel>Brand (Optional)</FormLabel><FormControl><Input placeholder="e.g., Kirloskar" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="serialNumber" render={({ field }) => (
                <FormItem><FormLabel>Serial Number (Optional)</FormLabel><FormControl><Input placeholder="e.g., WP-12345XYZ" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
               <FormField control={form.control} name="siteId" render={({ field }) => (
                <FormItem><FormLabel>Site/Location</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select a site" /></SelectTrigger></FormControl>
                <SelectContent>{sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="vendorInfo" render={({ field }) => (
                <FormItem><FormLabel>Vendor Information (Optional)</FormLabel><FormControl><Input placeholder="e.g., Acme Hardware, 555-1234" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <div className="col-span-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                  <FormItem><FormLabel>Purchase Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem><FormLabel>Warranty End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-base">Warranty Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {status ? (
                        <>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <Badge variant={status === 'Active' ? 'secondary' : 'destructive'}>{status}</Badge>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Duration</span>
                            <span>{duration} days</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Time Left</span>
                            <span>{daysLeft >= 0 ? `${daysLeft} days` : 'N/A'}</span>
                        </div>
                        </>
                    ) : (
                        <p className="text-sm text-muted-foreground">Enter dates to see status.</p>
                    )}
                </CardContent>
              </Card>
              <FormField control={form.control} name="issueDescription" render={({ field }) => (
                <FormItem><FormLabel>Issue Description (Optional)</FormLabel><FormControl><Textarea placeholder="Describe any known issues or claims..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <DialogFooter className="col-span-full">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                {existingWarranty ? 'Save Changes' : 'Add Warranty'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
