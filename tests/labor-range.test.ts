import { describe, expect, it } from 'vitest';
import { laborCostInRange, siteLaborTotals, workerMoney } from '@/lib/wages';

const labors = [
  { id: 'd', name: 'Daily', role: '', wageType: 'Daily', wage: 500, dateOfJoining: '2026-11-01' },
  { id: 'm', name: 'Monthly', role: '', wageType: 'Monthly', wage: 30000, dateOfJoining: '2026-11-01' },
  { id: 'c', name: 'Contract', role: '', wageType: 'Contract' },
  { id: 'x', name: 'Removed', role: '', wageType: 'Daily', wage: 999, dateOfJoining: '2026-11-01', isDeleted: true },
] as any;
const attendances = [{ laborId: 'd', date: '2026-11-03', status: 'Absent' }, { laborId: 'd', date: '2026-11-04', status: 'Half-day' }] as any;
const workLogs = [{ laborerId: 'c', date: '2026-11-02', wageEarned: 1200 }, { laborerId: 'c', date: '2026-11-10', wageEarned: 800 }] as any;
const transactions = [
  { laborId: 'd', date: '2026-11-02', type: 'Payment', amount: 700 },
  { laborId: 'd', date: '2026-11-09', type: 'Payment', amount: 300 },
  { laborId: 'd', date: '2026-11-02', type: 'Food', amount: 100 },
  { laborId: 'x', date: '2026-11-02', type: 'Payment', amount: 5000 },
] as any;
const base = { labors, attendances, workLogs, transactions, today: '2026-11-16' };

describe('labour cost for a date range', () => {
  it('earned: only wages earned inside the dates', () => {
    // Daily: 2nd present 500, 3rd absent 0, 4th half 250. Monthly: 3 of 30 days = 3000. Contract: 1200 on the 2nd.
    expect(laborCostInRange({ ...base, from: '2026-11-02', to: '2026-11-04', basis: 'earned' })).toEqual({ labor: 500 + 250 + 3000 + 1200, food: 100 });
  });

  it('paid: cash paid inside the dates; food joins pay when cut from wages', () => {
    expect(laborCostInRange({ ...base, from: '2026-11-02', to: '2026-11-04', basis: 'paid' })).toEqual({ labor: 700, food: 100 });
    expect(laborCostInRange({ ...base, from: '2026-11-02', to: '2026-11-04', basis: 'paid', foodMode: 'deduct' })).toEqual({ labor: 800, food: 0 });
    expect(laborCostInRange({ ...base, from: '2026-11-02', to: '2026-11-04', basis: 'earned', foodMode: 'deduct' }).food).toBe(0);
  });

  it('from the start to today matches the site totals used by the Dashboard', () => {
    const all = siteLaborTotals(workerMoney({ ...base }));
    expect(laborCostInRange({ ...base, from: '', to: '', basis: 'earned' })).toEqual({ labor: all.earned, food: all.food });
    expect(laborCostInRange({ ...base, from: '', to: '', basis: 'paid' }).labor).toBe(all.paid);
  });

  it('dates after today earn nothing yet', () => {
    expect(laborCostInRange({ ...base, from: '2026-12-01', to: '2026-12-31', basis: 'earned' }).labor).toBe(0);
  });
});
