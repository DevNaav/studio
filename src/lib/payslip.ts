/**
 * Worker payslip numbers for one month.
 *
 * Uses the same wage rules as the Labor tab's "Balance Due", so a payslip for the current
 * month always ends on the balance the app shows:
 *  - Daily:    each day from joining counts as Present unless attendance says otherwise
 *              (Half-day = 0.5, Absent/Unmarked = 0); future days count nothing.
 *  - Monthly:  months are counted from the joining date, the running month included.
 *  - Contract: the work logged.
 * Pure functions only, so they can be tested without a database.
 */
import { addDays, differenceInMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns';
import type { Attendance, Labor, LaborTransaction, WorkLog } from '@/lib/types';
import { roundMoney } from '@/lib/utils';

export interface PayslipLine {
  date: string;
  label: string;
  detail?: string;
  amount: number;
}

export interface Payslip {
  monthLabel: string;   // e.g. "November 2026"
  periodFrom: string;   // yyyy-MM-dd (first day counted)
  periodTo: string;     // yyyy-MM-dd (last day counted: month end, or today for the running month)
  isRunningMonth: boolean;
  /** Not employed yet in this month (joined later) or the month is in the future. */
  notEmployed: boolean;
  wageType: Labor['wageType'];
  rate?: number;
  attendance?: { present: number; halfDays: number; absent: number; unmarked: number; payableDays: number };
  workLines: PayslipLine[];     // Contract work logged in the month
  paymentLines: PayslipLine[];  // payments made in the month
  broughtForward: number;       // balance owed at the start of the month (negative = advance)
  earned: number;
  paid: number;
  closingBalance: number;       // broughtForward + earned - paid
}

const iso = (d: Date) => format(d, 'yyyy-MM-dd');

/** Wages earned from joining up to and including `upTo` (yyyy-MM-dd), capped at `today`. */
export function earnedUpTo(
  labor: Labor,
  upTo: string,
  today: string,
  attendanceByDate: Map<string, Attendance['status']>,
  workLogs: WorkLog[],
): number {
  const last = upTo < today ? upTo : today;
  if (labor.wageType === 'Contract') {
    return workLogs.filter(w => !w.isDeleted && w.laborerId === labor.id && w.date <= last)
      .reduce((sum, w) => sum + (Number(w.wageEarned) || 0), 0);
  }
  const joining = labor.dateOfJoining ? parseISO(labor.dateOfJoining) : null;
  if (!joining || !isValid(joining) || !labor.wage || labor.dateOfJoining! > last) return 0;

  if (labor.wageType === 'Monthly') {
    return (differenceInMonths(parseISO(last), joining) + 1) * labor.wage;
  }
  // Daily
  let total = 0;
  for (let d = joining; iso(d) <= last; d = addDays(d, 1)) {
    const status = attendanceByDate.get(iso(d)) ?? 'Present';
    if (status === 'Present') total += labor.wage;
    else if (status === 'Half-day') total += labor.wage / 2;
  }
  return total;
}

export function buildPayslip(params: {
  labor: Labor;
  month: string; // yyyy-MM
  today: string; // yyyy-MM-dd
  attendances: Attendance[];
  workLogs: WorkLog[];
  transactions: LaborTransaction[];
}): Payslip {
  const { labor, today } = params;
  const monthStart = startOfMonth(parseISO(`${params.month}-01`));
  const from = iso(monthStart);
  const monthEnd = iso(endOfMonth(monthStart));
  const isRunningMonth = today >= from && today <= monthEnd;
  const to = isRunningMonth ? today : monthEnd;
  const dayBefore = iso(addDays(monthStart, -1));

  const attendanceByDate = new Map(
    params.attendances.filter(a => !a.isDeleted && a.laborId === labor.id).map(a => [a.date, a.status]),
  );
  const myLogs = params.workLogs.filter(w => !w.isDeleted && w.laborerId === labor.id);
  const payments = params.transactions.filter(t => !t.isDeleted && t.laborId === labor.id && t.type === 'Payment');

  const earnedBefore = earnedUpTo(labor, dayBefore, today, attendanceByDate, myLogs);
  const earnedToEnd = earnedUpTo(labor, to, today, attendanceByDate, myLogs);
  const paidBefore = payments.filter(p => p.date < from).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const paymentLines = payments
    .filter(p => p.date >= from && p.date <= monthEnd)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(p => ({ date: p.date, label: 'Payment', detail: p.paymentMethod, amount: Number(p.amount) || 0 }));
  const paid = paymentLines.reduce((s, p) => s + p.amount, 0);

  const joinedBy = labor.dateOfJoining && labor.dateOfJoining <= to;
  const notEmployed = from > today || (labor.wageType !== 'Contract' && !joinedBy);

  let attendance: Payslip['attendance'];
  if (labor.wageType === 'Daily' && !notEmployed) {
    const counts = { present: 0, halfDays: 0, absent: 0, unmarked: 0, payableDays: 0 };
    const start = labor.dateOfJoining! > from ? parseISO(labor.dateOfJoining!) : monthStart;
    for (let d = start; iso(d) <= to; d = addDays(d, 1)) {
      const status = attendanceByDate.get(iso(d)) ?? 'Present';
      if (status === 'Present') counts.present += 1;
      else if (status === 'Half-day') counts.halfDays += 1;
      else if (status === 'Absent') counts.absent += 1;
      else counts.unmarked += 1;
    }
    counts.payableDays = counts.present + counts.halfDays / 2;
    attendance = counts;
  }

  const workLines = labor.wageType === 'Contract'
    ? myLogs.filter(w => w.date >= from && w.date <= to).sort((a, b) => a.date.localeCompare(b.date)).map(w => ({
        date: w.date,
        label: `${w.quantity} ${w.unit || labor.unit || ''}`.trim(),
        detail: `Rs. ${w.pricePerUnit} / ${w.unit || labor.unit || 'unit'}`,
        amount: Number(w.wageEarned) || 0,
      }))
    : [];

  const broughtForward = roundMoney(earnedBefore - paidBefore);
  const earned = roundMoney(earnedToEnd - earnedBefore);
  return {
    monthLabel: format(monthStart, 'MMMM yyyy'),
    periodFrom: from,
    periodTo: to,
    isRunningMonth,
    notEmployed,
    wageType: labor.wageType,
    rate: labor.wageType === 'Contract' ? labor.pricePerUnit : labor.wage,
    attendance,
    workLines,
    paymentLines,
    broughtForward,
    earned,
    paid: roundMoney(paid),
    closingBalance: roundMoney(broughtForward + earned - paid),
  };
}
