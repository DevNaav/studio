/**
 * Subscription invoice PDF. Runs in the browser ("Download invoice") and on the server
 * (attached to the confirmation email), so both are always the same document.
 * Uses "Rs." because the built-in PDF fonts can't draw the rupee sign.
 */
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format } from 'date-fns';
import { planById } from '@/lib/plans';
import { SITE_HOST } from '@/lib/site';

/** Who is selling. Shown at the top of every invoice. */
export const SELLER = {
  name: 'Inventra',
  website: SITE_HOST,
};

export interface InvoiceData {
  invoiceNumber: string;
  paymentDate: string;          // ISO date
  planId: string;               // e.g. "basic-annually"
  amount: number;               // Rs. charged
  companyName: string;
  buyerName?: string | null;
  buyerEmail?: string | null;
  periodEnd?: string | null;    // ISO date the subscription now runs until
}

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => format(new Date(iso), 'dd MMM yyyy');

/** INV-20261116-AB12CD: date of payment plus the start of the payment's id. */
export function makeInvoiceNumber(paymentId: string, paymentDate: Date): string {
  return `INV-${format(paymentDate, 'yyyyMMdd')}-${paymentId.slice(0, 6).toUpperCase()}`;
}

export function planDescription(planId: string): string {
  const [id, cycle] = planId.split('-');
  const name = planById(id)?.name ?? id;
  return `Inventra ${name} plan, ${cycle === 'annually' ? 'yearly' : 'monthly'} subscription`;
}

export function buildInvoicePdf(data: InvoiceData): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const dark: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];
  let y = 20;

  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(SELLER.name, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(SELLER.website, margin, y + 6);

  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INVOICE', pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(data.invoiceNumber, pageW - margin, y + 6, { align: 'right' });

  // PAID stamp
  doc.setDrawColor(22, 163, 74);
  doc.setTextColor(22, 163, 74);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.roundedRect(pageW - margin - 22, y + 10, 22, 8, 1.5, 1.5);
  doc.text('PAID', pageW - margin - 11, y + 15.6, { align: 'center' });

  y += 28;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Bill to / details
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text('BILLED TO', margin, y);
  doc.text('INVOICE DETAILS', pageW / 2 + 6, y);
  doc.setTextColor(...dark);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(data.companyName || 'Customer', margin, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const billTo = [data.buyerName, data.buyerEmail].filter(Boolean) as string[];
  billTo.forEach((line, i) => doc.text(line, margin, y + 12 + i * 5));

  const details: [string, string][] = [
    ['Invoice date', day(data.paymentDate)],
    ['Invoice no.', data.invoiceNumber],
    ...(data.periodEnd ? [['Valid until', day(data.periodEnd)] as [string, string]] : []),
    ['Status', 'Paid'],
  ];
  details.forEach(([k, v], i) => {
    doc.setTextColor(...muted);
    doc.text(k, pageW / 2 + 6, y + 6 + i * 5.5);
    doc.setTextColor(...dark);
    doc.text(v, pageW - margin, y + 6 + i * 5.5, { align: 'right' });
  });
  y += 12 + Math.max(billTo.length * 5, details.length * 5.5) + 6;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 3, textColor: dark },
    headStyles: { fillColor: [44, 62, 80], textColor: 255 },
    head: [['Description', { content: 'Amount', styles: { halign: 'right' } }]],
    body: [[
      `${planDescription(data.planId)}${data.periodEnd ? `\n${day(data.paymentDate)} to ${day(data.periodEnd)}` : ''}`,
      { content: rs(data.amount), styles: { halign: 'right' } },
    ]],
    foot: [[
      { content: 'Total paid', styles: { fontStyle: 'bold' } },
      { content: rs(data.amount), styles: { halign: 'right', fontStyle: 'bold' } },
    ]],
    footStyles: { fillColor: [241, 245, 249], textColor: dark },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.text('Thank you for choosing Inventra!', margin, y);
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text('This is a computer-generated invoice and does not need a signature.', margin, y + 6);
  return doc;
}
