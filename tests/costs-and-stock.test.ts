import { describe, expect, it } from 'vitest';
import { computeSiteSpend, saleProfit, sumDirectExpenses } from '@/lib/costs';
import { summariseMaterials, unitProblem } from '@/lib/materials';
import type { Expense, InventoryItem } from '@/lib/types';

const empty = {
  siteId: 's', expenses: [], materials: [], machines: [], maintenanceLogs: [], fuelLogs: [],
  rentedMaterials: [], rentedMaterialAttendances: [], machineAttendances: [], tools: [],
  today: new Date('2026-11-16T12:00:00'),
};

describe('computeSiteSpend: labour and food settings', () => {
  const labour = { laborPaid: 15000, laborEarned: 28000, foodGiven: 600 };
  it('company pays for food, labour counted as earned', () => {
    expect(computeSiteSpend({ ...empty, ...labour, laborBasis: 'earned', foodMode: 'company' }).total).toBe(28600);
  });
  it('company pays for food, labour counted as paid', () => {
    expect(computeSiteSpend({ ...empty, ...labour, laborBasis: 'paid', foodMode: 'company' }).total).toBe(15600);
  });
  it('food cut from wages, labour counted as earned (food is inside wages)', () => {
    expect(computeSiteSpend({ ...empty, ...labour, laborBasis: 'earned', foodMode: 'deduct' }).total).toBe(28000);
  });
  it('food cut from wages, labour counted as paid (cash + food given)', () => {
    expect(computeSiteSpend({ ...empty, ...labour, laborBasis: 'paid', foodMode: 'deduct' }).total).toBe(15600);
  });
});

describe('computeSiteSpend: other costs', () => {
  it('adds materials, direct expenses, fuel and tools but not double-counted categories', () => {
    const r = computeSiteSpend({
      ...empty,
      laborPaid: 0,
      materials: [
        { type: 'Material', status: 'Bought', quantity: 10, pricePerUnit: 380 },
        { type: 'Material', status: 'Used', quantity: 4, pricePerUnit: 380 },
      ] as InventoryItem[],
      expenses: [
        { category: 'Transport', amount: 1000 }, { category: 'Other', amount: 500 },
        { category: 'Materials', amount: 9999 }, { category: 'Rental', amount: 9999 }, // counted elsewhere
        { category: 'EMI', amount: 2000 }, { category: 'Food', amount: 100, isDeleted: true },
      ] as Expense[],
      fuelLogs: [{ siteId: 's', cost: 700 }, { siteId: 'other', cost: 999 }] as any,
      tools: [{ price: 1200 }] as any,
    });
    expect(r.total).toBe(3800 + 1000 + 500 + 2000 + 700 + 1200);
  });

  it('charges rented machines per day, half days at half price, future bookings nothing', () => {
    const r = computeSiteSpend({
      ...empty,
      laborPaid: 0,
      machines: [
        { id: 'm1', assignedSiteId: 's', acquisition: 'Rented', dailyRentalPrice: 1000, assignmentDate: '2026-11-14' },
        { id: 'm2', assignedSiteId: 's', acquisition: 'Rented', dailyRentalPrice: 1000, assignmentDate: '2026-11-20' },
      ] as any,
      machineAttendances: [{ machineId: 'm1', date: '2026-11-15', status: 'Half-day' }] as any,
    });
    expect(r.total).toBe(1000 + 500 + 1000); // 14th, half 15th, 16th
  });

  it('sumDirectExpenses and saleProfit', () => {
    expect(sumDirectExpenses([{ category: 'Tools', amount: 50 }, { category: 'Materials', amount: 99 }] as Expense[])).toBe(50);
    expect(saleProfit({ salePrice: 1000, productionCost: 600, transportCost: 100 })).toBe(300);
  });
});

describe('material stock', () => {
  const items = [
    { name: 'Cement', type: 'Material', status: 'Bought', quantity: 100, unit: 'BAGS', pricePerUnit: 380 },
    { name: 'cement ', type: 'Material', status: 'Used', quantity: 30 },
    { name: 'CEMENT', type: 'Material', status: 'Bought', quantity: 20, unit: 'bags', pricePerUnit: 390 },
    { name: 'Cement', type: 'Material', status: 'Bought', quantity: 50, unit: 'kg', pricePerUnit: 8 },
    { name: 'Steel', type: 'Material', status: 'Bought', quantity: 2, unit: 'ton', pricePerUnit: 60000 },
    { name: 'Steel', type: 'Material', status: 'Used', quantity: 500, unit: 'kg' },
  ] as InventoryItem[];

  it('groups spellings, converts units and flags units that cannot be converted', () => {
    const s = Object.fromEntries(summariseMaterials(items).map(m => [m.key, m]));
    expect(s.cement).toMatchObject({ bought: 120, used: 30, stored: 90, mixedUnits: ['kg'] });
    expect(s.steel).toMatchObject({ unit: 'ton', bought: 2, used: 0.5, stored: 1.5 });
  });

  it('blocks a unit that does not fit the material', () => {
    expect(unitProblem('cement', 'kg', items)).toMatch(/recorded in BAGS/);
    expect(unitProblem('Cement', 'Bags', items)).toBeNull();
    expect(unitProblem('Steel', 'kg', items)).toBeNull(); // convertible
    expect(unitProblem('Bricks', 'pcs', items)).toBeNull(); // new material
  });
});
