
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Purchase } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, addDocWithSiteId } from '@/context/site-context';

const formSchema = z.object({
  item: z.string().min(2, 'Item description is too short'),
  supplier: z.string().min(2, 'Supplier name is too short'),
  cost: z.coerce.number().positive('Cost must be positive'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  date: z.string().min(1, 'Date is required'),
});

interface PurchasesTabProps {
  siteId: string;
}

export function PurchasesTab({ siteId }: PurchasesTabProps) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onSubCollectionSnapshot<Purchase>('purchases', siteId, setPurchases);
    return () => unsubscribe();
  }, [siteId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item: '',
      supplier: '',
      cost: 0,
      quantity: 1,
      date: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
        await addDocWithSiteId('purchases', siteId, values);
        toast({ title: "Purchase Logged", description: `Purchase of "${values.item}" from ${values.supplier} has been logged.` });
        form.reset();
        setIsDialogOpen(false);
    } catch(e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to log purchase.'})
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Purchase Tracking</CardTitle>
          <CardDescription>Track suppliers, costs, and quantities of purchases.</CardDescription>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Log Purchase</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.length > 0 ? (
              purchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell className="font-medium">{purchase.item}</TableCell>
                  <TableCell>{purchase.supplier}</TableCell>
                  <TableCell>{purchase.quantity}</TableCell>
                  <TableCell className="text-right">₹{purchase.cost.toLocaleString()}</TableCell>
                  <TableCell>{purchase.date}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No purchases logged yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Purchase</DialogTitle>
            <DialogDescription>Fill in the details of the purchase.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="item" render={({ field }) => (
                <FormItem><FormLabel>Item(s) Purchased</FormLabel>
                <FormControl><Input placeholder="e.g., 100x Steel Rods" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="supplier" render={({ field }) => (
                <FormItem><FormLabel>Supplier</FormLabel>
                <FormControl><Input placeholder="e.g., Acme Steel" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="quantity" render={({ field }) => (
                <FormItem><FormLabel>Quantity</FormLabel>
                <FormControl><Input type="number" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="cost" render={({ field }) => (
                <FormItem><FormLabel>Total Cost (₹)</FormLabel>
                <FormControl><Input type="number" step="0.01" placeholder="5000.00" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Add Purchase</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
