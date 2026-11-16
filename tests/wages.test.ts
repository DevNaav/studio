import { describe, expect, it } from 'vitest';
import { buildPayslip, monthlyWageEarned } from '@/lib/payslip';
import { siteLaborTotals, workerMoney } from '@/lib/wages';
import type { Attendance, Labor, LaborTransaction, WorkLog } from '@/lib/types';

const today = '2026-11-16';

describe('monthlyWageEarned (pro-rated by calendar days)', () => {
  it('pays part of the joining month', () => {
    expect(monthlyWageEarned(30000, '2026-11-21', '2026-11-30')).toBe(10000); // 10 of 30 days
  });
  it('pays a full month in full', () => {
    expect(monthlyWageEarned(30000, '2026-11-01', '2026-11-30')).toBe(30000);
  });
  it('builds up day by day in the running month', () => {
    expect(monthlyWageEarned(30000, '2026-11-01', '2026-11-16')).toBe(16000);
  });
  it('adds part months and full months', () => {
    expect(monthlyWageEarned(30000, '2026-09-21', '2026-11-16')).toBe(10000 + 30000 + 16000);
  });
  it('handles February', () => {
    expect(monthlyWageEarned(30000, '2026-02-15', '2026-02-28')).toBe(15000); // 14 of 28 days
  });
  it('pays nothing before joining', () => {
    expect(monthlyWageEarned(30000, '2026-12-01', '2026-11-16')).toBe(0);
  });
  it('works across the year end', () => {
    expect(monthlyWageEarned(30000, '2025-12-31', '2026-01-01')).toBe(1935.48);
  });
});

const labors: Labor[] = [
  { id: 'R', companyId: 'c', siteId: 's', name: 'Ramesh', role: 'Mason', wageType: 'Daily', wage: 800, dateOfJoining: '2026-11-01' },
  { id: 'S', companyId: 'c', siteId: 's', name: 'Suresh', role: 'Supervisor', wageType: 'Monthly', wage: 30000, dateOfJoining: '2026-11-01' },
  { id: 'M', companyId: 'c', siteId: 's', name: 'Mohan', role: 'Tiler', wageType: 'Contract', pricePerUnit: 40, dateOfJoining: '2026-10-01' },
];
const attendances = [{ laborId: 'R', date: '2026-11-05', status: 'Absent' }, { laborId: 'R', date: '2026-11-06', status: 'Half-day' }] as Attendance[];
const workLogs = [{ laborerId: 'M', date: '2026-11-03', quantity: 150, wageEarned: 6000 }] as WorkLog[];
const transactions = [
  { laborId: 'R', type: 'Payment', amount: 5000, date: '2026-11-10' },
  { laborId: 'R', type: 'Food', amount: 300, date: '2026-11-08' },
  { laborId: 'S', type: 'Payment', amount: 10000, date: '2026-10-31' },
] as LaborTransaction[];

describe('workerMoney', () => {
  it('works out earned, paid and balance for each wage type', () => {
    const w = workerMoney({ labors, attendances, workLogs, transactions, today });
    const by = Object.fromEntries(w.map(x => [x.id, x]));
    // Ramesh: 16 days, 1 absent, 1 half day -> 14.5 x 800
    expect(by.R.totalWages).toBe(11600);
    expect(by.R.totalPaid).toBe(5000);
    expect(by.R.balance).toBe(6600); // food not deducted by default
    expect(by.S.totalWages).toBe(16000);
    expect(by.S.balance).toBe(6000);
    expect(by.M.totalWages).toBe(6000);
  });

  it('takes food off the balance only when the company cuts it from wages', () => {
    const deduct = workerMoney({ labors, attendances, workLogs, transactions, today, foodMode: 'deduct' });
    expect(deduct.find(x => x.id === 'R')!.balance).toBe(6300);
    const totals = siteLaborTotals(deduct);
    expect(totals).toMatchObject({ earned: 33600, paid: 15000, food: 300 });
  });
});

describe('payslips agree with the Labor tab', () => {
  for (const foodMode of ['company', 'deduct'] as const) {
    it(`current month closes on the worker's balance (food: ${foodMode})`, () => {
      const w = workerMoney({ labors, attendances, workLogs, transactions, today, foodMode });
      for (const labor of labors) {
        const slip = buildPayslip({ labor, month: '2026-11', today, attendances, workLogs, transactions, foodMode });
        expect(slip.closingBalance).toBeCloseTo(w.find(x => x.id === labor.id)!.balance, 2);
      }
    });
  }

  it('each month carries its closing balance into the next', () => {
    const labor: Labor = { id: 'X', companyId: 'c', siteId: 's', name: 'X', role: '', wageType: 'Monthly', wage: 25000, dateOfJoining: '2026-08-10' };
    const tx = [{ laborId: 'X', type: 'Payment', amount: 50000, date: '2026-10-30' }] as LaborTransaction[];
    let previous = 0;
    for (const month of ['2026-08', '2026-09', '2026-10', '2026-11']) {
      const slip = buildPayslip({ labor, month, today, attendances: [], workLogs: [], transactions: tx });
      expect(slip.broughtForward).toBeCloseTo(previous, 2);
      previous = slip.closingBalance;
    }
    expect(previous).toBeCloseTo(monthlyWageEarned(25000, '2026-08-10', today) - 50000, 2);
  });

  it('marks workers who had not joined yet', () => {
    const slip = buildPayslip({ labor: labors[0], month: '2026-08', today, attendances, workLogs, transactions });
    expect(slip.notEmployed).toBe(true);
    expect(slip.earned).toBe(0);
  });
});
