/**
 * Shared money rules, so the Dashboard, Site summary, Site details and Analysis pages
 * all add things up the same way.
 */
import { eachDayOfInterval, format as formatDate, isAfter as isAfterDate } from 'date-fns';
import type {
  Expense, ExpenseCategory, FuelLog, InventoryItem, Machine, MachineAttendance, MaintenanceLog, RentedMaterial,
  RentedMaterialAttendance, Sale, Tool,
} from '@/lib/types';

/**
 * Expense records that count directly towards a site's cost.
 *
 * Left out on purpose, because they are already counted from their own records and would
 * otherwise be counted twice:
 *  - Materials: material transfers also create a "Bought" stock entry with its price.
 *  - Rental:    rent is worked out day by day from rented materials/machines.
 *  - Labor:     taken from wage payments.
 *  - Fuel:      taken from fuel logs.
 */
export const DIRECT_EXPENSE_CATEGORIES: ExpenseCategory[] = ['EMI', 'Transport', 'Other', 'Tools', 'Food', 'Maintenance'];

export function isDirectSiteExpense(expense: Pick<Expense, 'category' | 'isDeleted'>): boolean {
  return !expense.isDeleted && DIRECT_EXPENSE_CATEGORIES.includes(expense.category);
}

/** Sum of direct expenses, optionally only one category. */
export function sumDirectExpenses(expenses: Expense[], category?: ExpenseCategory): number {
  return expenses
    .filter(e => isDirectSiteExpense(e) && (!category || e.category === category))
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

/** Profit on a sale: price minus production cost and the transport paid for that sale. */
export function saleProfit(sale: Pick<Sale, 'salePrice' | 'productionCost' | 'transportCost'>): number {
  return (sale.salePrice || 0) - (sale.productionCost || 0) - (sale.transportCost || 0);
}

// ---------------------------------------------------------------------------
// Site spend: the "Total Site Expenses" shown on a site's Summary tab. Budget alerts
// use the same function, so the alert and the Summary page always show the same number.
// ---------------------------------------------------------------------------

export interface SiteSpendInput {
  siteId: string;
  /** Wages paid to the site's workers (Payment transactions). */
  laborPaid: number;
  expenses: Expense[];                 // this site's expense records
  materials: InventoryItem[];          // this site's inventory
  machines: Machine[];                 // all company machines (filtered to this site here)
  maintenanceLogs: MaintenanceLog[];
  fuelLogs: FuelLog[];
  rentedMaterials: RentedMaterial[];   // this site's rented materials
  rentedMaterialAttendances: RentedMaterialAttendance[];
  machineAttendances: MachineAttendance[];
  tools: Tool[];                       // this site's tools
  today?: Date;
}

export function computeSiteSpend(input: SiteSpendInput): { breakdown: { name: string; value: number }[]; total: number } {
  const today = input.today ?? new Date();
  const map = new Map<string, number>();
  const add = (k: string, v: number) => { if (v > 0) map.set(k, (map.get(k) || 0) + v); };

  add('Labor', input.laborPaid);
  add('Materials', input.materials
    .filter(i => !i.isDeleted && i.type === 'Material' && i.status === 'Bought')
    .reduce((s, i) => s + i.quantity * (i.pricePerUnit || 0), 0));

  const siteMachines = input.machines.filter(m => m.assignedSiteId === input.siteId);
  const machineIds = new Set(siteMachines.map(m => m.id));
  add('Maintenance', input.maintenanceLogs
    .filter(l => !l.isDeleted && machineIds.has(l.machineId) && l.costAllocation === 'Site Expenses')
    .reduce((s, l) => s + (l.cost || 0), 0));
  add('Fuel', input.fuelLogs.filter(f => f.siteId === input.siteId && !f.isDeleted).reduce((s, f) => s + f.cost, 0));

  // Rent accrues day by day; days marked "Not Used" (materials) or "Absent" (machines) are free.
  let rental = 0;
  // If a day has two records, the first one counts (same as the pages always did).
  const firstWins = <T,>(pairs: [string, T][]) => { const m = new Map<string, T>(); pairs.forEach(([k, v]) => { if (!m.has(k)) m.set(k, v); }); return m; };
  const materialDays = firstWins(input.rentedMaterialAttendances.map(a => [`${a.rentedMaterialId}|${a.date}`, a.status] as [string, string]));
  input.rentedMaterials.filter(r => !r.isDeleted).forEach(item => {
    const end = item.status === 'Returned' && item.returnDate ? new Date(item.returnDate) : today;
    if (!isAfterDate(end, new Date(item.startDate))) return;
    let days = 0;
    eachDayOfInterval({ start: new Date(item.startDate), end }).forEach(d => {
      const status = materialDays.get(`${item.id}|${formatDate(d, 'yyyy-MM-dd')}`);
      if (!status || status === 'Used') days++;
    });
    rental += item.rentPerDay * item.quantity * days;
  });
  const machineDays = firstWins(input.machineAttendances.map(a => [`${a.machineId}|${a.date}`, a.status] as [string, string]));
  siteMachines.filter(m => m.acquisition === 'Rented' && m.dailyRentalPrice && m.assignmentDate).forEach(m => {
    const start = new Date(m.assignmentDate!);
    if (isAfterDate(start, today)) return;
    eachDayOfInterval({ start, end: today }).forEach(d => {
      const status = machineDays.get(`${m.id}|${formatDate(d, 'yyyy-MM-dd')}`) || 'Unmarked';
      if (status === 'Present' || status === 'Unmarked') rental += m.dailyRentalPrice!;
      else if (status === 'Half-day') rental += m.dailyRentalPrice! / 2;
    });
  });
  add('Rental', rental);

  add('EMI', input.expenses.filter(e => e.category === 'EMI' && !e.isDeleted).reduce((s, e) => s + e.amount, 0));
  add('Tools', input.tools.filter(t => !t.isDeleted && t.price).reduce((s, t) => s + t.price!, 0));
  (['Transport', 'Other', 'Tools', 'Food', 'Maintenance'] as const).forEach(category =>
    add(category, input.expenses.filter(e => e.category === category && !e.isDeleted).reduce((s, e) => s + e.amount, 0)));

  const breakdown = [...map.entries()].map(([name, value]) => ({ name, value }));
  return { breakdown, total: breakdown.reduce((s, b) => s + b.value, 0) };
}
