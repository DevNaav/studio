
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard /> Payment History</CardTitle>
        <CardDescription>View and download invoices for all your past payments.</CardDescription>
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
