/**
 * Worker money for a site: wages earned, cash paid, food given and what is still owed.
 * Used by the Labor tab, the site page, site totals and budget alerts, and uses the same
 * earning rules as payslips (earnedUpTo), so every screen agrees.
 */
import { differenceInDays, parseISO, isValid } from 'date-fns';
import type { Attendance, FoodCostMode, Labor, LaborTransaction, WorkLog } from '@/lib/types';
import { earnedUpTo } from '@/lib/payslip';
import { roundMoney } from '@/lib/utils';

export interface WorkerMoney {
  id: string;
  name: string;
  role: string;
  wageType: Labor['wageType'];
  daysWorked: number;
  totalWages: number;   // earned so far
  totalPaid: number;    // cash payments
  food: number;         // food given (Food transactions)
  /** Taken off the balance when food is cut from wages. */
  foodDeducted: number;
  balance: number;      // still owed to the worker (negative = advance)
}

export interface SiteLaborTotals {
  earned: number;
  paid: number;     // cash
  food: number;
  owed: number;     // sum of positive balances
  advances: number; // sum of negative balances (as a positive number)
}

export function workerMoney(params: {
  labors: Labor[];
  attendances: Attendance[];
  workLogs: WorkLog[];
  transactions: LaborTransaction[];
  today: string; // yyyy-MM-dd
  foodMode?: FoodCostMode;
}): WorkerMoney[] {
  const { today } = params;
  const deduct = params.foodMode === 'deduct';
  return params.labors.filter(l => !l.isDeleted).map(labor => {
    const attendanceByDate = new Map(params.attendances.filter(a => !a.isDeleted && a.laborId === labor.id).map(a => [a.date, a.status]));
    const logs = params.workLogs.filter(w => !w.isDeleted && w.laborerId === labor.id);
    const tx = params.transactions.filter(t => !t.isDeleted && t.laborId === labor.id);
    const totalWages = roundMoney(earnedUpTo(labor, today, today, attendanceByDate, logs));
    const totalPaid = roundMoney(tx.filter(t => t.type === 'Payment').reduce((s, t) => s + (Number(t.amount) || 0), 0));
    const food = roundMoney(tx.filter(t => t.type === 'Food').reduce((s, t) => s + (Number(t.amount) || 0), 0));
    const foodDeducted = deduct ? food : 0;

    let daysWorked = 0;
    const joining = labor.dateOfJoining ? parseISO(labor.dateOfJoining) : null;
    if (labor.wageType === 'Contract') daysWorked = logs.filter(w => w.date <= today).length;
    else if (labor.wageType === 'Monthly' && joining && isValid(joining) && labor.dateOfJoining! <= today) daysWorked = differenceInDays(parseISO(today), joining);
    else if (labor.wageType === 'Daily' && labor.wage) daysWorked = labor.wage > 0 ? totalWages / labor.wage : 0;

    return {
      id: labor.id,
      name: labor.name,
      role: labor.role,
      wageType: labor.wageType,
      daysWorked: Math.round(daysWorked * 10) / 10,
      totalWages,
      totalPaid,
      food,
      foodDeducted,
      balance: roundMoney(totalWages - totalPaid - foodDeducted),
    };
  });
}

export function siteLaborTotals(workers: WorkerMoney[]): SiteLaborTotals {
  return {
    earned: roundMoney(workers.reduce((s, w) => s + w.totalWages, 0)),
    paid: roundMoney(workers.reduce((s, w) => s + w.totalPaid, 0)),
    food: roundMoney(workers.reduce((s, w) => s + w.food, 0)),
    owed: roundMoney(workers.reduce((s, w) => s + Math.max(0, w.balance), 0)),
    advances: roundMoney(workers.reduce((s, w) => s + Math.max(0, -w.balance), 0)),
  };
}
