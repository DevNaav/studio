/**
 * Daily site report: what happened at one site on one day, as a one-page PDF a supervisor
 * can send every evening. buildDailyReport is pure (easy to test); buildDailyReportPdf draws it.
 */
import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import type {
  Attendance, Expense, FuelLog, InventoryItem, Labor, LaborTransaction, Machine, MachineAttendance, Task, Theft, WorkLog,
} from '@/lib/types';

export interface DailyReportInput {
  date: string; // yyyy-MM-dd
  siteId: string;
  labors: Labor[];               // workers of this site
  attendances: Attendance[];
  workLogs: WorkLog[];
  transactions: LaborTransaction[];
  inventory: InventoryItem[];    // this site's stock entries
  expenses: Expense[];
  fuelLogs: FuelLog[];
  machines: Machine[];           // company machines (filtered to this site)
  machineAttendances: MachineAttendance[];
  tasks: Task[];
  thefts: Theft[];
}

export interface DailyReport {
  date: string;
  attendance: { name: string; role: string; status: string }[];
  attendanceCounts: { present: number; halfDay: number; absent: number; notMarked: number };
  work: { name: string; detail: string; amount: number }[];
  materials: { name: string; status: string; quantity: string; cost: number }[];
  expenses: { description: string; category: string; amount: number }[];
  payments: { name: string; method: string; amount: number }[];
  machines: { name: string; status: string }[];
  tasks: { title: string; assignee: string; status: string }[];
  thefts: { item: string; value: number; details: string }[];
  totals: { materials: number; expenses: number; workerPayments: number; spentToday: number };
}

const live = <T extends { isDeleted?: boolean }>(list: T[]) => list.filter(x => !x.isDeleted);

export function buildDailyReport(input: DailyReportInput): DailyReport {
  const { date, siteId } = input;
  const laborName = new Map(input.labors.map(l => [l.id, l.name]));

  // Daily-wage workers who had joined by this date. Monthly/contract workers don't mark attendance.
  const statusByLabor = new Map(live(input.attendances).filter(a => a.date === date).map(a => [a.laborId, a.status]));
  const attendance = live(input.labors)
    .filter(l => l.employmentStatus !== 'Off Roll' && (!l.dateOfJoining || l.dateOfJoining <= date) && l.wageType === 'Daily')
    .map(l => {
      const s = statusByLabor.get(l.id);
      return { name: l.name, role: l.role || '', status: s && s !== 'Unmarked' ? s : 'Not marked' };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const attendanceCounts = {
    present: attendance.filter(a => a.status === 'Present').length,
    halfDay: attendance.filter(a => a.status === 'Half-day').length,
    absent: attendance.filter(a => a.status === 'Absent').length,
    notMarked: attendance.filter(a => a.status === 'Not marked').length,
  };

  const work = live(input.workLogs)
    .filter(w => w.date === date)
    .map(w => ({ name: laborName.get(w.laborerId) ?? 'Worker', detail: `${w.quantity} ${w.unit || ''}`.trim(), amount: Number(w.wageEarned) || 0 }));

  const materials = live(input.inventory)
    .filter(i => i.date === date && (i.status === 'Bought' || i.status === 'Used') && (i.type === 'Material' || !i.type))
    .map(i => ({
      name: i.name,
      status: i.status,
      quantity: `${i.quantity} ${i.unit || ''}`.trim(),
      cost: i.status === 'Bought' ? (Number(i.quantity) || 0) * (i.pricePerUnit || 0) : 0,
    }));

  const expenses = [
    ...live(input.expenses).filter(e => e.date === date).map(e => ({ description: e.description, category: e.category, amount: Number(e.amount) || 0 })),
    ...live(input.fuelLogs).filter(f => f.siteId === siteId && f.date === date)
      .map(f => ({ description: `${f.vehicleName}: ${f.quantity} L ${f.fuelType}`, category: 'Fuel', amount: Number(f.cost) || 0 })),
  ];

  const payments = live(input.transactions)
    .filter(t => t.date === date && t.type === 'Payment')
    .map(t => ({ name: laborName.get(t.laborId) ?? 'Worker', method: t.paymentMethod || '', amount: Number(t.amount) || 0 }));

  const machineStatus = new Map(live(input.machineAttendances).filter(a => a.date === date).map(a => [a.machineId, a.status]));
  const machines = live(input.machines)
    .filter(m => m.assignedSiteId === siteId && (!m.assignmentDate || m.assignmentDate <= date))
    .map(m => ({ name: m.name, status: machineStatus.get(m.id) && machineStatus.get(m.id) !== 'Unmarked' ? machineStatus.get(m.id)! : 'Not marked' }));

  const tasks = live(input.tasks)
    .filter(t => t.dueDate === date || (t.status !== 'Done' && t.dueDate && t.dueDate < date))
    .map(t => ({ title: t.title, assignee: t.assigneeName || '', status: t.status !== 'Done' && t.dueDate < date ? `${t.status} (overdue)` : t.status }));

  const thefts = live(input.thefts).filter(t => t.date === date).map(t => ({ item: t.item, value: Number(t.value) || 0, details: t.details || '' }));

  const sum = (xs: { amount?: number; cost?: number }[], k: 'amount' | 'cost') => xs.reduce((s, x) => s + (x[k] || 0), 0);
  const totals = {
    materials: sum(materials, 'cost'),
    expenses: sum(expenses, 'amount'),
    workerPayments: sum(payments, 'amount'),
    spentToday: 0,
  };
  totals.spentToday = totals.materials + totals.expenses + totals.workerPayments;

  return { date, attendance, attendanceCounts, work, materials, expenses, payments, machines, tasks, thefts, totals };
}

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function buildDailyReportPdf(report: DailyReport, siteName: string, companyName: string, preparedBy?: string): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const dark: [number, number, number] = [30, 41, 59];
  const muted: [number, number, number] = [100, 116, 139];
  let y = 16;

  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(companyName || 'Company', margin, y + 2);
  doc.text('DAILY SITE REPORT', pageW - margin, y + 2, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(`Site: ${siteName}`, margin, y + 8);
  doc.text(format(parseISO(report.date), 'EEEE, dd MMM yyyy'), pageW - margin, y + 8, { align: 'right' });
  y += 14;

  // Key numbers
  const c = report.attendanceCounts;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5, halign: 'center', textColor: dark },
    headStyles: { fillColor: [241, 245, 249], textColor: muted, fontStyle: 'normal' },
    bodyStyles: { fontStyle: 'bold', fontSize: 11 },
    head: [['Present', 'Half day', 'Absent', 'Not marked', 'Spent today']],
    body: [[String(c.present), String(c.halfDay), String(c.absent), String(c.notMarked), rs(report.totals.spentToday)]],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const section = (title: string, head: string[], rows: (string | number)[][], empty: string, rightCols: number[] = []) => {
    if (y > 260) { doc.addPage(); y = 16; }
    const columnStyles = Object.fromEntries(rightCols.map(i => [i, { halign: 'right' as const }]));
    autoTable(doc, {
      startY: y,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2, textColor: dark },
      headStyles: { fillColor: [44, 62, 80], textColor: 255 },
      columnStyles,
      head: [[{ content: title, colSpan: head.length, styles: { halign: 'left', fontSize: 10 } }], head.map((h, i) => ({ content: h, styles: { halign: rightCols.includes(i) ? 'right' as const : 'left' as const, fillColor: [71, 85, 105] as [number, number, number] } }))],
      body: rows.length ? rows.map(r => r.map(String)) : [[{ content: empty, colSpan: head.length, styles: { textColor: muted } }]],
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  };

  section('Attendance (daily-wage workers)', ['Worker', 'Role', 'Status'], report.attendance.map(a => [a.name, a.role, a.status]), 'No daily-wage workers on this site.');
  section('Work done', ['Worker', 'Work', 'Amount'], report.work.map(w => [w.name, w.detail, rs(w.amount)]), 'No work logged today.', [2]);
  section('Materials', ['Material', 'Bought / Used', 'Quantity', 'Cost'], report.materials.map(m => [m.name, m.status, m.quantity, m.cost ? rs(m.cost) : '']), 'No materials bought or used today.', [3]);
  section('Expenses', ['Description', 'Category', 'Amount'], report.expenses.map(e => [e.description, e.category, rs(e.amount)]), 'No expenses today.', [2]);
  section('Payments to workers', ['Worker', 'Method', 'Amount'], report.payments.map(p => [p.name, p.method, rs(p.amount)]), 'No payments today.', [2]);
  section('Machines on site', ['Machine', 'Status'], report.machines.map(m => [m.name, m.status]), 'No machines on this site.');
  section('Tasks due', ['Task', 'Assigned to', 'Status'], report.tasks.map(t => [t.title, t.assignee, t.status]), 'No tasks due.');
  if (report.thefts.length) section('Theft / loss reported', ['Item', 'Details', 'Value'], report.thefts.map(t => [t.item, t.details, rs(t.value)]), '', [2]);

  if (y > 270) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setTextColor(...dark);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total spent today: ${rs(report.totals.spentToday)}`, margin, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...muted);
  doc.text(`Materials ${rs(report.totals.materials)} · Expenses ${rs(report.totals.expenses)} · Worker payments ${rs(report.totals.workerPayments)}`, margin, y + 7);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(`${preparedBy ? `Prepared by ${preparedBy} · ` : ''}Generated ${format(new Date(), 'dd MMM yyyy, hh:mm a')} with Inventra · Page ${i} of ${pages}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  }
  return doc;
}
