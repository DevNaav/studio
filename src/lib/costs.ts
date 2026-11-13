/**
 * Shared money rules, so the Dashboard, Site summary, Site details and Analysis pages
 * all add things up the same way.
 */
import type { Expense, ExpenseCategory, Sale } from '@/lib/types';

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
