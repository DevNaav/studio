
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Theft } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Siren, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, addDocWithSiteId, softDeleteDocWithId } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { formatCurrency } from '@/lib/utils';

const formSchema = z.object({
  item: z.string().min(3, 'Item description is too short'),
  value: z.coerce.number().min(0, 'Value must be a positive number'),
  date: z.string().min(1, 'Date is required'),
  details: z.string().optional(),
});

interface TheftTabProps {
  siteId: string;
}

export function TheftTab({ siteId }: TheftTabProps) {
  const [thefts, setThefts] = useState<Theft[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTheft, setSelectedTheft] = useState<Theft | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { userProfile } = useAuth();

  useEffect(() => {
    if (!siteId || !userProfile?.companyId) return;
    const unsubscribe = onSubCollectionSnapshot<Theft>('thefts', userProfile.companyId, siteId, setThefts);
    return () => unsubscribe();
  }, [siteId, userProfile?.companyId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      item: '',
      value: 0,
      date: new Date().toISOString().split('T')[0],
      details: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!userProfile?.companyId) return;
    setIsSubmitting(true);
    try {
      await addDocWithSiteId('thefts', userProfile.companyId, siteId, values);
      toast({ title: "Theft Logged", description: `Theft of "${values.item}" has been recorded.` });
      form.reset({ date: new Date().toISOString().split('T')[0] });
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Failed to log theft." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openDeleteDialog = (theft: Theft) => {
    setSelectedTheft(theft);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedTheft) {
      await softDeleteDocWithId('thefts', selectedTheft.id);
      toast({ title: "Theft Log Deleted" });
      setIsDeleteDialogOpen(false);
      setSelectedTheft(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Siren /> Theft Log</CardTitle>
            <CardDescription>Record and manage theft incidents on this site.</CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Log Incident</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Stolen</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {thefts.length > 0 ? (
                thefts.map((theft) => (
                  <TableRow key={theft.id}>
                    <TableCell className="font-medium">{theft.item}</TableCell>
                    <TableCell>{theft.date}</TableCell>
                    <TableCell className="max-w-xs truncate">{theft.details || 'N/A'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(theft.value)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(theft)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-24">No theft incidents logged yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Theft Incident</DialogTitle>
            <DialogDescription>Fill in the details of the stolen item(s).</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="item"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item(s) Stolen</FormLabel>
                    <FormControl><Input placeholder="e.g., 50 bags of cement" {...field} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Value (Rs.)</FormLabel>
                    <FormControl><Input type="number" placeholder="25000" {...field} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Discovery</FormLabel>
                    <FormControl><Input type="date" {...field} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="details"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Details (Optional)</FormLabel>
                    <FormControl><Textarea placeholder="Any additional information, like where it was stored..." {...field} disabled={isSubmitting} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Log Incident
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog 
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="Delete Theft Log"
        description={`Are you sure you want to delete this log for "${selectedTheft?.item}"? This action cannot be undone.`}
      />
    </>
  );
}
