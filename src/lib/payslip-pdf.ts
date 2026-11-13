/**
 * Turns a Payslip into an A4 PDF (runs in the browser, no server or paid service).
 * Uses "Rs." instead of the rupee sign: the built-in PDF fonts can't draw "₹".
 */
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import type { Labor } from '@/lib/types';
import type { Payslip } from '@/lib/payslip';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => format(parseISO(d), 'dd MMM yyyy');

export interface PayslipPdfInput {
  payslip: Payslip;
  labor: Labor;
  companyName: string;
  siteName: string;
  /** data: URL of the company logo, if it could be loaded. */
  logoDataUrl?: string | null;
}

export function payslipFileName(labor: Labor, payslip: Payslip): string {
  const safe = labor.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'worker';
  return `Payslip-${safe}-${payslip.periodFrom.slice(0, 7)}.pdf`;
}

export function buildPayslipPdf({ payslip, labor, companyName, siteName, logoDataUrl }: PayslipPdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const dark: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];
  let y = 16;

  // --- Header: company and title ---
  let textX = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, margin, y - 4, 16, 16);
      textX = margin + 20;
    } catch {
      /* unsupported image: skip the logo */
    }
  }
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(companyName || 'Company', textX, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(`Site: ${siteName}`, textX, y + 8);

  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('PAYSLIP', pageW - margin, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(payslip.monthLabel, pageW - margin, y + 8, { align: 'right' });
  y += 16;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // --- Worker details ---
  const rateText = payslip.rate
    ? labor.wageType === 'Daily' ? `${rs(payslip.rate)} per day`
      : labor.wageType === 'Monthly' ? `${rs(payslip.rate)} per month`
      : `${rs(payslip.rate)} per ${labor.unit || 'unit'}`
    : '-';
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5, textColor: dark },
    columnStyles: { 0: { textColor: muted, cellWidth: 32 }, 2: { textColor: muted, cellWidth: 32 } },
    body: [
      ['Worker', labor.name, 'Wage type', labor.wageType],
      ['Role', labor.role || '-', 'Rate', rateText],
      ['ID number', labor.idNumber || '-', 'Joined', labor.dateOfJoining ? day(labor.dateOfJoining) : '-'],
      ['Period', `${day(payslip.periodFrom)} to ${day(payslip.periodTo)}`, 'Status', labor.employmentStatus || 'On Roll'],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const tableStyle = {
    theme: 'grid' as const,
    styles: { fontSize: 10, cellPadding: 2.2, textColor: dark },
    headStyles: { fillColor: [44, 62, 80] as [number, number, number], textColor: 255 },
    columnStyles: { 1: { halign: 'right' as const } },
  };

  // --- Attendance (daily wage) ---
  if (payslip.attendance) {
    const a = payslip.attendance;
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [['Attendance', 'Days']],
      body: [
        ['Present', String(a.present)],
        ['Half days', String(a.halfDays)],
        ['Absent', String(a.absent)],
        ...(a.unmarked ? [['Marked "Unmarked" (not paid)', String(a.unmarked)]] : []),
        [{ content: 'Payable days', styles: { fontStyle: 'bold' } }, { content: String(a.payableDays), styles: { fontStyle: 'bold' } }],
      ],
    });
    y = (doc as any).lastAutoTable.finalY + 2;
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text('Days without an attendance entry count as present.', margin, y + 3);
    y += 8;
  }

  // --- Work done (contract) ---
  if (payslip.wageType === 'Contract') {
    autoTable(doc, {
      ...tableStyle,
      startY: y,
      head: [['Date', 'Work done', 'Rate', 'Amount']],
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
      body: payslip.workLines.length
        ? payslip.workLines.map(w => [day(w.date), w.label, w.detail || '', rs(w.amount)])
        : [[{ content: 'No work logged this month', colSpan: 4, styles: { textColor: muted } }]],
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // --- Payments made ---
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [['Payments this month', 'Method', 'Amount']],
    columnStyles: { 2: { halign: 'right' } },
    body: payslip.paymentLines.length
      ? payslip.paymentLines.map(p => [day(p.date), p.detail || '-', rs(p.amount)])
      : [[{ content: 'No payments this month', colSpan: 3, styles: { textColor: muted } }]],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // --- Summary ---
  const owed = payslip.closingBalance;
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [['Summary', 'Amount']],
    body: [
      [payslip.broughtForward >= 0 ? 'Balance from earlier months' : 'Advance from earlier months', rs(payslip.broughtForward)],
      [`Earned in ${payslip.monthLabel}${payslip.isRunningMonth ? ' (so far)' : ''}`, rs(payslip.earned)],
      ['Paid in this month', `- ${rs(payslip.paid)}`],
      [
        { content: owed >= 0 ? 'Balance due to worker' : 'Advance paid (worker owes)', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: rs(Math.abs(owed)), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
      ],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 22;

  // --- Signatures and footer ---
  if (y > 260) {
    doc.addPage();
    y = 30;
  }
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y, margin + 60, y);
  doc.line(pageW - margin - 60, y, pageW - margin, y);
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text('Worker signature / thumb', margin, y + 5);
  doc.text('Authorised signatory', pageW - margin, y + 5, { align: 'right' });
  doc.setFontSize(8);
  doc.text(
    `Generated on ${format(new Date(), 'dd MMM yyyy, hh:mm a')} with Inventra`,
    pageW / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: 'center' },
  );
  return doc;
}
