
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

interface PaymentHistoryProps {
  companyId: string;
}

const plans: { [key in FullPlanId]: { name: string } } = {
  'basic-monthly': { name: 'Basic Plan (Monthly)' },
  'basic-annually': { name: 'Basic Plan (Annually)' },
  'premium-monthly': { name: 'Premium Plan (Monthly)' },
  'premium-annually': { name: 'Premium Plan (Annually)' },
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
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    const planDetails = plans[payment.planId];

    doc.setFontSize(22);
    doc.text('Invoice', 105, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text(`Invoice for: ${company?.name || 'Your Company'}`, 14, 40);
    doc.text(`Payment Date: ${format(new Date(payment.paymentDate), 'PPP')}`, 14, 46);
    doc.text(`Invoice ID: ${payment.id}`, 14, 52);

    autoTable(doc, {
      startY: 65,
      head: [['Description', 'Amount']],
      body: [
        [`Subscription - ${planDetails.name}`, formatCurrency(payment.amount)],
      ],
      foot: [['Total Paid', formatCurrency(payment.amount)]],
      theme: 'striped',
      footStyles: { fontStyle: 'bold' },
    });

    doc.setFontSize(10);
    doc.text('Thank you for your business!', 14, (doc as any).lastAutoTable.finalY + 20);

    doc.save(`invoice-${payment.id}.pdf`);
    toast({ title: 'Invoice Downloaded' });
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
                    <TableCell className="capitalize">{payment.planId.replace('-', ' ')}</TableCell>
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
