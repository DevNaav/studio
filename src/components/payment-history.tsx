
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, CreditCard, Loader2 } from 'lucide-react';
import { Company, Payment, FullPlanId } from '@/lib/types';
import { collection, query, where, onSnapshot, orderBy, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatCurrency } from '@/lib/utils';
import { planById } from '@/lib/plans';
import { getIdTokenOrThrow } from '@/lib/id-token';

interface PaymentHistoryProps {
  companyId: string;
}

/** "basic-annually" -> "Growth Plan (Annually)". Names come from the shared price list. */
const planLabel = (fullPlanId: FullPlanId | string) => {
  const [id, cycle] = String(fullPlanId).split('-');
  const name = planById(id)?.name ?? id;
  return `${name} Plan (${cycle === 'annually' ? 'Annually' : 'Monthly'})`;
};

export function PaymentHistory({ companyId }: PaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'payments'), where('companyId', '==', companyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      // Sort on the client side to avoid needing a composite index
      const sortedPayments = paymentsData.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
      setPayments(sortedPayments);
      setLoading(false);
    });

    const companyUnsub = onSnapshot(doc(db, 'companies', companyId), (doc) => {
        if(doc.exists()) {
            setCompany({ id: doc.id, ...doc.data() } as Company);
        }
    });

    return () => {
      unsubscribe();
      companyUnsub();
    };
  }, [companyId]);

  const [emailing, setEmailing] = useState<string | null>(null);

  /** Emails an invoice (or, with null, a test message) to the signed-in user's own address. */
  const emailInvoice = async (payment: Payment | null) => {
    setEmailing(payment?.id ?? 'test');
    try {
      const res = await fetch('/api/billing/confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await getIdTokenOrThrow()}` },
        body: JSON.stringify(payment ? { paymentId: payment.id } : { test: true }),
      });
      const result = await res.json().catch(() => ({}));
      if (result.sent) toast({ title: 'Email sent', description: `Sent to ${result.to}. Check the inbox (and spam folder).` });
      else if (result.reason === 'not-configured') toast({ variant: 'destructive', title: 'Email is not set up', description: 'Add the SMTP settings in Vercel and redeploy.' });
      else toast({ variant: 'destructive', title: 'Email not sent', description: result.error || 'Please try again.' });
    } catch {
      toast({ variant: 'destructive', title: 'Email not sent', description: 'Please check your connection and try again.' });
    } finally {
      setEmailing(null);
    }
  };

  const handleDownloadInvoice = async (payment: Payment) => {
    const { buildInvoicePdf, makeInvoiceNumber } = await import('@/lib/invoice-pdf');
    const invoiceNumber = payment.invoiceNumber || makeInvoiceNumber(payment.id, new Date(payment.paymentDate));
    const doc = buildInvoicePdf({
      invoiceNumber,
      paymentDate: payment.paymentDate,
      planId: payment.planId,
      amount: payment.amount,
      companyName: company?.name || 'Your company',
    });
    doc.save(`${invoiceNumber}.pdf`);
    toast({ title: 'Invoice downloaded' });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 shrink-0 text-primary" /> Payment History</CardTitle>
          <CardDescription>View, download or email invoices for all your past payments.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => emailInvoice(null)} disabled={!!emailing}>
          {emailing === 'test' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Email me a test
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="flex justify-center items-center h-24">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        ) : (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Amount Paid</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length > 0 ? (
                payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{format(new Date(payment.paymentDate), 'PPP')}</TableCell>
                    <TableCell>{planLabel(payment.planId)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleDownloadInvoice(payment)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Invoice
                      </Button>
                      <Button variant="ghost" size="sm" className="ml-2" onClick={() => emailInvoice(payment)} disabled={!!emailing}>
                        {emailing === payment.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Email
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center h-24">No payment history found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </CardContent>
    </Card>
  );
}
