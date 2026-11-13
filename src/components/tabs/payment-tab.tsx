
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { SitePayment, sitePaymentTypes, Expense, DepositStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, IndianRupee, Edit, Trash2, Loader2, Building, PiggyBank, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onSubCollectionSnapshot, addDocWithSiteId, updateDocWithId, softDeleteDocWithId } from '@/context/site-context';
import { useAuth } from '@/context/auth-context';
import { DeleteConfirmationDialog } from '../delete-confirmation-dialog';
import { Badge } from '../ui/badge';
import { serverTimestamp } from 'firebase/firestore';
import { formatCurrency, todayISO } from '@/lib/utils';

const formSchema = z.object({
  paymentType: z.enum(sitePaymentTypes, { required_error: 'Please select a payment type.' }),
  amount: z.coerce.number().positive('Amount must be a positive number'),
  date: z.string().min(1, 'Date is required'),
  description: z.string().optional(),
});

interface PaymentTabProps {
  siteId: string;
  totalSiteExpenses: number;
}

export function PaymentTab({ siteId, totalSiteExpenses }: PaymentTabProps) {
  const [payments, setPayments] = useState<SitePayment[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SitePayment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { userProfile } = useAuth();
  const companyId = userProfile?.companyId;

  useEffect(() => {
    if (!siteId || !companyId) return;

    const unsubPayments = onSubCollectionSnapshot<SitePayment>('site_payments', companyId, siteId, (data) => {
        const sortedData = data.sort((a, b) => {
            const timeA = a.createdAt?.toMillis() || new Date(a.date).getTime();
            const timeB = b.createdAt?.toMillis() || new Date(b.date).getTime();
            return timeB - timeA;
        });
        setPayments(sortedData);
    });
    
    return () => {
      unsubPayments();
    };
  }, [siteId, companyId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (isDialogOpen) {
      if (selectedPayment) {
        form.reset(selectedPayment);
      } else {
        form.reset({
          paymentType: undefined,
          amount: 0,
          date: todayISO(),
          description: '',
        });
      }
    }
  }, [isDialogOpen, selectedPayment, form]);

  const handleOpenDialog = (payment: SitePayment | null = null) => {
    setSelectedPayment(payment);
    setIsDialogOpen(true);
  };

  const handleOpenDeleteDialog = (payment: SitePayment) => {
    setSelectedPayment(payment);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedPayment) {
      await softDeleteDocWithId('site_payments', selectedPayment.id);
      toast({ title: 'Payment Deleted' });
    }
    setIsDeleteDialogOpen(false);
  };

  const handleReleaseDeposit = async (payment: SitePayment) => {
    if (payment.paymentType !== 'Deposit') return;
    try {
        await updateDocWithId('site_payments', payment.id, {
            status: 'Released',
            releaseDate: todayISO(),
        });
        toast({ title: 'Deposit Released', description: 'The deposit has been marked as released.' });
    } catch (e) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to release deposit.' });
    }
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!companyId) return;
    setIsSubmitting(true);
    try {
      const data: Partial<SitePayment> = { 
          ...values,
          createdAt: serverTimestamp() 
      };
      if (values.paymentType === 'Deposit' && !selectedPayment) {
        data.status = 'Held';
      }

      if (selectedPayment) {
        await updateDocWithId('site_payments', selectedPayment.id, data);
        toast({ title: 'Payment Updated' });
      } else {
        await addDocWithSiteId('site_payments', companyId, siteId, data);
        toast({ title: 'Payment Logged' });
      }
      setIsDialogOpen(false);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to save payment.' });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const { departmentalPayments, deposits } = useMemo(() => {
    const departmental = payments.filter(p => p.paymentType === 'Departmental Payment' && !p.isDeleted).reduce((acc, p) => acc + p.amount, 0);
    const deposit = payments.filter(p => p.paymentType === 'Deposit' && !p.isDeleted).reduce((acc, p) => acc + p.amount, 0);
    return { departmentalPayments: departmental, deposits: deposit };
  }, [payments]);


  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><IndianRupee />Site Payments</CardTitle>
            <CardDescription>Track departmental payments and security deposits for this site.</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}><Plus className="mr-2 h-4 w-4" />Log Payment</Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Site Expenses</CardTitle>
                <IndianRupee className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalSiteExpenses)}</div>
                <p className="text-xs text-muted-foreground">Sum of all expenses on this site</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Departmental Payments</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(departmentalPayments)}</div>
                <p className="text-xs text-muted-foreground">Total funds received from departments</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
                <PiggyBank className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(deposits)}</div>
                <p className="text-xs text-muted-foreground">Total security deposits made</p>
              </CardContent>
            </Card>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Payment Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.filter(p => !p.isDeleted).length > 0 ? (
                payments.filter(p => !p.isDeleted).map((payment) => {
                  const status = payment.paymentType === 'Deposit' ? (payment.status || 'Held') : null;
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>{payment.paymentType}</TableCell>
                      <TableCell>{payment.description || 'N/A'}</TableCell>
                      <TableCell>
                        {status && (
                          <Badge variant={status === 'Released' ? 'default' : 'secondary'}>
                            {status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                      <TableCell className="text-right">
                         {payment.paymentType === 'Deposit' && status === 'Held' && (
                            <Button variant="outline" size="sm" onClick={() => handleReleaseDeposit(payment)}>
                                <Undo2 className="mr-2 h-4 w-4" /> Release
                            </Button>
                         )}
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(payment)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDeleteDialog(payment)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24">No payments logged yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedPayment ? 'Edit' : 'Log'} Payment</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <fieldset disabled={isSubmitting}>
                <FormField control={form.control} name="paymentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {sitePaymentTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem><FormLabel>Amount (Rs.)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="date" render={({ field }) => (
                  <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem><FormLabel>Description / Notes</FormLabel><FormControl><Textarea placeholder="e.g., From Civil Dept / Bank Guarantee" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {selectedPayment ? 'Save Changes' : 'Log Payment'}
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
        title="Delete Payment"
        description={`Are you sure you want to delete this payment record? This action cannot be undone.`}
      />
    </>
  );
}
