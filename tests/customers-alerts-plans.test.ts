import { describe, expect, it } from 'vitest';
import { allocatePayment, buildStatement, groupCustomers, phoneFromText, reminderMessage } from '@/lib/customer-ledger';
import { computeAlerts } from '@/lib/alerts';
import { effectivePlan, planById, priceFor } from '@/lib/plans';
import { makeInvoiceNumber } from '@/lib/invoice-pdf';
import { buildDailyReport } from '@/lib/daily-report';
import type { Sale } from '@/lib/types';

const sales = [
  { id: 'a', siteId: 'u', date: '2026-03-10', gradeName: 'M20', salePrice: 50000, amountPaid: 50000, paymentStatus: 'Paid', buyerInfo: 'Sharma Builders', paymentHistory: [{ amount: 30000, date: '2026-03-15', method: 'UPI' }] },
  { id: 'b', siteId: 'u', date: '2026-09-01', gradeName: 'M25', salePrice: 48000, amountPaid: 18000, paymentStatus: 'Partially Paid', buyerInfo: '  sharma   builders 98765 43210', paymentHistory: [{ amount: 18000, date: '2026-09-20', method: 'Cash' }] },
  { id: 'c', siteId: 'u', date: '2026-10-25', gradeName: 'M20', salePrice: 20000, amountPaid: 0, paymentStatus: 'Unpaid', buyerInfo: 'SHARMA BUILDERS' },
  { id: 'd', siteId: 'u', date: '2026-11-01', gradeName: 'Old', salePrice: 999, amountPaid: 0, paymentStatus: 'Unpaid', buyerInfo: 'Sharma Builders', isDeleted: true },
  { id: 'e', siteId: 'u', date: '2026-11-02', gradeName: 'M20', salePrice: 9000, amountPaid: 0, paymentStatus: 'Unpaid', destinationSiteId: 's1' },
] as unknown as Sale[];
const sites = [{ id: 'u', name: 'Plant' }, { id: 's1', name: 'Tower' }] as any;

describe('customer ledger', () => {
  const customers = groupCustomers(sales, sites, '2026-11-16');
  const sharma = customers.find(c => c.key === 'buyer:sharma builders')!;

  it('merges spellings, skips deleted sales and keeps own sites separate', () => {
    // "Sharma Builders", "  sharma   builders 98765 43210" and "SHARMA BUILDERS" are one buyer.
    expect(sharma.sales.map(s => s.id).sort()).toEqual(['a', 'b', 'c']);
    expect(sharma.name).toBe('Sharma Builders');
    expect(sharma.outstanding).toBe(50000);
    expect(customers.find(c => c.internal)?.name).toBe('Tower');
  });

  it('statement closing balance equals the amount due (with undetailed payments)', () => {
    const st = buildStatement(sharma, sites, null, '2026-11-16');
    expect(st.closingBalance).toBe(sharma.outstanding);
  });

  it('applies payments oldest first and refuses overpayment', () => {
    const all = sales.filter(s => !s.isDeleted && !s.destinationSiteId);
    const alloc = allocatePayment(all, 35000);
    expect(alloc.map(a => [a.sale.id, a.apply, a.status])).toEqual([['b', 30000, 'Paid'], ['c', 5000, 'Partially Paid']]);
    expect(() => allocatePayment(all, 50001)).toThrow(/more than the amount due/);
  });

  it('a phone number typed with the name does not change who the buyer is', () => {
    expect(groupCustomers([{ ...sales[2], buyerInfo: 'Gill Traders (ph 98765-43210)' }, { ...sales[2], id: 'z', buyerInfo: 'gill traders' }] as Sale[], sites, '2026-11-16')).toHaveLength(1);
  });

  it('finds phone numbers and writes a reminder', () => {
    expect(phoneFromText('Gill +91-9876543210')).toBe('9876543210');
    expect(phoneFromText('Ravi (ph 09876543210)')).toBe('9876543210');
    expect(phoneFromText('Kaur 5876543210')).toBeNull();
    const msg = reminderMessage(sharma, 'Goyals', '16 Nov 2026');
    expect(msg).toMatch(/Rs\. 50,000 is due/);
    expect(msg.startsWith('Namaste Sharma Builders,')).toBe(true);
  });
});

describe('alerts', () => {
  const base = { today: '2026-11-16', inventory: [], machines: [], emiPayments: [], sales: [], documents: [], warranties: [], liabilities: [], rentedMaterials: [], tasks: [] };
  it('budget: warns at 80%, critical over 100%, skips completed and unbudgeted sites', () => {
    const r = computeAlerts({
      ...base,
      sites: [
        { id: 'a', name: 'A', status: 'Active', budget: 1000 }, { id: 'b', name: 'B', status: 'Active', budget: 1000 },
        { id: 'c', name: 'C', status: 'Active', budget: 1000 }, { id: 'd', name: 'D', status: 'Completed', budget: 1 },
        { id: 'e', name: 'E', status: 'Active' },
      ] as any,
      siteSpend: new Map([['a', 790], ['b', 820], ['c', 1500], ['d', 999], ['e', 9e9]]),
    });
    expect(r.map(x => [x.id, x.severity])).toEqual([['budget:c:over', 'critical'], ['budget:b:near', 'warning']]);
  });

  it('low stock uses converted units', () => {
    const r = computeAlerts({
      ...base,
      sites: [{ id: 's', name: 'S', status: 'Active' }] as any,
      inventory: [
        { siteId: 's', name: 'Steel', type: 'Material', status: 'Bought', quantity: 1, unit: 'ton', lowStockThreshold: 0.6 },
        { siteId: 's', name: 'Steel', type: 'Material', status: 'Used', quantity: 500, unit: 'kg' },
      ] as any,
    });
    expect(r[0].detail).toMatch(/0\.5 ton left/);
  });
});

describe('plans and invoices', () => {
  it('a trial gets Business limits; plans resolve to the right limits', () => {
    expect(effectivePlan({ planId: 'starter-annually', subscriptionStatus: 'Trial' }).name).toBe('Business');
    expect(effectivePlan({ planId: 'starter-annually', subscriptionStatus: 'Active' })).toMatchObject({ maxSites: 1, maxUsers: 3, salesAndCustomers: false });
    expect(effectivePlan({ planId: 'basic-monthly', subscriptionStatus: 'Active' })).toMatchObject({ name: 'Growth', maxSites: 5, maxUsers: 10 });
    expect(priceFor(planById('premium')!, 'annually')).toBe(59999);
  });
  it('invoice numbers are date + payment id', () => {
    expect(makeInvoiceNumber('aB12cD34eF56', new Date('2026-11-16T10:00:00'))).toBe('INV-20261116-AB12CD');
  });
});

describe('daily report', () => {
  it('only counts the chosen day and daily-wage workers on roll', () => {
    const date = '2026-11-16';
    const r = buildDailyReport({
      date, siteId: 's',
      labors: [
        { id: 'a', name: 'A', role: '', wageType: 'Daily', dateOfJoining: '2026-01-01' },
        { id: 'b', name: 'B', role: '', wageType: 'Monthly', dateOfJoining: '2026-01-01' },
        { id: 'c', name: 'C', role: '', wageType: 'Daily', employmentStatus: 'Off Roll' },
      ] as any,
      attendances: [{ laborId: 'a', date, status: 'Present' }] as any,
      workLogs: [], tasks: [], thefts: [], machines: [], machineAttendances: [],
      transactions: [{ laborId: 'a', date, type: 'Payment', amount: 500 }, { laborId: 'a', date, type: 'Food', amount: 100 }] as any,
      inventory: [{ name: 'Cement', type: 'Material', status: 'Bought', quantity: 10, pricePerUnit: 380, date }, { name: 'X', status: 'Bought', quantity: 1, pricePerUnit: 9, date: '2026-11-01' }] as any,
      expenses: [{ description: 'Tea', category: 'Food', amount: 200, date }] as any,
      fuelLogs: [{ siteId: 's', vehicleName: 'JCB', fuelType: 'Diesel', quantity: 10, cost: 900, date }] as any,
    });
    expect(r.attendance.map(a => a.name)).toEqual(['A']);
    expect(r.totals).toEqual({ materials: 3800, expenses: 1100, workerPayments: 500, spentToday: 5400 });
  });
});
