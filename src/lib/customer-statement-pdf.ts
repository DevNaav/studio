/**
 * Customer statement PDF (account statement / khata) built in the browser with jsPDF.
 * Uses "Rs." because the built-in PDF fonts can't draw the rupee sign.
 */
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import type { CustomerStatement, CustomerSummary } from '@/lib/customer-ledger';

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => format(parseISO(d), 'dd MMM yyyy');

export function statementFileName(customer: CustomerSummary, statement: CustomerStatement): string {
  const safe = customer.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'customer';
  return `Statement-${safe}-${statement.to}.pdf`;
}

export function buildStatementPdf(params: {
  customer: CustomerSummary;
  statement: CustomerStatement;
  companyName: string;
  logoDataUrl?: string | null;
}): jsPDF {
  const { customer, statement, companyName, logoDataUrl } = params;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const dark: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];
  let y = 16;

  let textX = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, margin, y - 4, 16, 16);
      textX = margin + 20;
    } catch {
      /* unsupported image: skip */
    }
  }
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(companyName || 'Company', textX, y + 2);
  doc.setFontSize(14);
  doc.text('ACCOUNT STATEMENT', pageW - margin, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  const period = statement.from ? `${day(statement.from)} to ${day(statement.to)}` : `Up to ${day(statement.to)}`;
  doc.text(period, pageW - margin, y + 8, { align: 'right' });
  y += 16;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  doc.setTextColor(...muted);
  doc.setFontSize(9);
  doc.text(customer.internal ? 'Transfers to site' : 'Customer', margin, y);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(customer.name, margin, y + 6);
  doc.setFont('helvetica', 'normal');

  const due = statement.closingBalance;
  doc.setFontSize(9);
  doc.setTextColor(...muted);
  doc.text(due >= 0 ? 'Amount due' : 'Advance with us', pageW - margin, y, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(due > 0 ? 185 : 22, due > 0 ? 28 : 101, due > 0 ? 28 : 52);
  doc.text(rs(Math.abs(due)), pageW - margin, y + 7, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  y += 14;

  const body: any[] = [];
  if (statement.from) {
    body.push([day(statement.from), { content: 'Opening balance', styles: { fontStyle: 'italic' } }, '', '', rs(statement.openingBalance)]);
  }
  statement.entries.forEach(e => body.push([
    day(e.date),
    e.particulars,
    e.debit ? rs(e.debit) : '',
    e.credit ? rs(e.credit) : '',
    rs(e.balance),
  ]));
  if (!statement.entries.length) {
    body.push([{ content: 'No sales or payments in this period', colSpan: 5, styles: { textColor: muted } }]);
  }

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2, textColor: dark, valign: 'middle' },
    headStyles: { fillColor: [44, 62, 80], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 24 },
      2: { halign: 'right', cellWidth: 28 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 30 },
    },
    head: [['Date', 'Particulars', ...['Billed', 'Received', 'Balance'].map(content => ({ content, styles: { halign: 'right' as const } }))]],
    body,
    foot: [[
      '', 'Total for period', rs(statement.totalDebit), rs(statement.totalCredit), rs(statement.closingBalance),
    ]],
    footStyles: { fillColor: [241, 245, 249], textColor: dark, fontStyle: 'bold', halign: 'right' },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(
      `Generated on ${format(new Date(), 'dd MMM yyyy, hh:mm a')} with Inventra · Page ${i} of ${pages}`,
      pageW / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' },
    );
  }
  return doc;
}
