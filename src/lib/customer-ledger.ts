/**
 * Customer ledger: groups sales by buyer and turns sales and their payments into a
 * running statement (like a khata). Pure functions only, so they can be tested.
 *
 * A customer is the sale's "Buyer" text for outside buyers (matched ignoring case and
 * extra spaces), or the receiving site for internal transfers.
 */
import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { Sale, Site } from '@/lib/types';
import { roundMoney } from '@/lib/utils';

export interface CustomerSummary {
  key: string;
  name: string;
  internal: boolean;      // internal transfer to one of your own sites
  sales: Sale[];
  billed: number;
  received: number;
  outstanding: number;
  lastActivity: string;   // yyyy-MM-dd
  oldestUnpaidDays: number | null;
}

export interface LedgerEntry {
  date: string;
  kind: 'sale' | 'payment';
  particulars: string;
  debit: number;   // amount billed
  credit: number;  // amount received
  balance: number; // running balance after this entry
}

export interface CustomerStatement {
  from: string | null;
  to: string;
  openingBalance: number;
  entries: LedgerEntry[];
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
}

export const normaliseName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export function customerKey(sale: Sale): string {
  if (sale.destinationSiteId) return `site:${sale.destinationSiteId}`;
  const name = normaliseName(sale.buyerInfo || '');
  return name ? `buyer:${name}` : 'buyer:(no name)';
}

export function groupCustomers(sales: Sale[], sites: Site[], today: string): CustomerSummary[] {
  const siteName = new Map(sites.map(s => [s.id, s.name]));
  const groups = new Map<string, CustomerSummary>();

  sales.filter(s => !s.isDeleted).forEach(sale => {
    const key = customerKey(sale);
    const internal = !!sale.destinationSiteId;
    const displayName = internal
      ? siteName.get(sale.destinationSiteId!) ?? 'Deleted site'
      : (sale.buyerInfo?.trim().replace(/\s+/g, ' ') || 'Buyer not named');
    const g = groups.get(key) ?? {
      key, name: displayName, internal, sales: [], billed: 0, received: 0, outstanding: 0, lastActivity: '', oldestUnpaidDays: null,
    };
    g.sales.push(sale);
    g.billed += sale.salePrice || 0;
    g.received += sale.amountPaid || 0;
    const lastPayment = (sale.paymentHistory || []).reduce((max, p) => (p.date > max ? p.date : max), '');
    g.lastActivity = [g.lastActivity, sale.date, lastPayment].sort().pop() || '';
    if ((sale.salePrice || 0) - (sale.amountPaid || 0) > 0.005) {
      const age = differenceInCalendarDays(parseISO(today), parseISO(sale.date));
      g.oldestUnpaidDays = Math.max(g.oldestUnpaidDays ?? 0, age);
    }
    groups.set(key, g);
  });

  return [...groups.values()]
    .map(g => ({ ...g, billed: roundMoney(g.billed), received: roundMoney(g.received), outstanding: roundMoney(g.billed - g.received) }))
    .sort((a, b) => b.outstanding - a.outstanding || b.lastActivity.localeCompare(a.lastActivity));
}

/**
 * Statement for one customer between `from` (inclusive, null = from the start) and `to`.
 * Everything before `from` is rolled into the opening balance.
 */
export function buildStatement(customer: CustomerSummary, sites: Site[], from: string | null, to: string): CustomerStatement {
  const siteName = new Map(sites.map(s => [s.id, s.name]));
  const all: Omit<LedgerEntry, 'balance'>[] = [];

  customer.sales.forEach(sale => {
    const qty = sale.quantity ? `${sale.quantity} ${sale.totalQuantityUnit || ''}`.trim() : '';
    all.push({
      date: sale.date,
      kind: 'sale',
      particulars: `Sale: ${sale.gradeName}${qty ? `, ${qty}` : ''} (from ${siteName.get(sale.siteId) ?? 'site'})`,
      debit: sale.salePrice || 0,
      credit: 0,
    });
    // Older sales may have an amount paid without payment details; show it so the statement
    // still adds up to the same balance as the sale.
    const detailed = (sale.paymentHistory || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    const undetailed = roundMoney((sale.amountPaid || 0) - detailed);
    if (undetailed > 0.005) {
      all.push({ date: sale.date, kind: 'payment', particulars: 'Payment received (no details recorded)', debit: 0, credit: undetailed });
    }
    (sale.paymentHistory || []).forEach(p => {
      all.push({
        date: p.date,
        kind: 'payment',
        particulars: `Payment received${p.method ? ` (${p.method})` : ''}${p.notes ? `: ${p.notes}` : ''}`,
        debit: 0,
        credit: p.amount || 0,
      });
    });
  });

  // Oldest first; on the same day the sale comes before the payment against it.
  all.sort((a, b) => a.date.localeCompare(b.date) || (a.kind === b.kind ? 0 : a.kind === 'sale' ? -1 : 1));

  const before = from ? all.filter(e => e.date < from) : [];
  const openingBalance = roundMoney(before.reduce((s, e) => s + e.debit - e.credit, 0));
  let balance = openingBalance;
  const entries: LedgerEntry[] = all
    .filter(e => (!from || e.date >= from) && e.date <= to)
    .map(e => {
      balance = roundMoney(balance + e.debit - e.credit);
      return { ...e, balance };
    });

  const totalDebit = roundMoney(entries.reduce((s, e) => s + e.debit, 0));
  const totalCredit = roundMoney(entries.reduce((s, e) => s + e.credit, 0));
  return { from, to, openingBalance, entries, totalDebit, totalCredit, closingBalance: roundMoney(openingBalance + totalDebit - totalCredit) };
}

/** Start of the Indian financial year (1 April) that `today` falls in. */
export function financialYearStart(today: string): string {
  const [y, m] = today.split('-').map(Number);
  return `${m >= 4 ? y : y - 1}-04-01`;
}

/**
 * Splits a payment over the customer's unpaid sales, oldest first.
 * Returns the per-sale updates, or throws if the payment is more than what is owed.
 */
export function allocatePayment(sales: Sale[], amount: number): { sale: Sale; apply: number; newPaid: number; status: Sale['paymentStatus'] }[] {
  const unpaid = sales
    .filter(s => !s.isDeleted && (s.salePrice || 0) - (s.amountPaid || 0) > 0.005)
    .sort((a, b) => a.date.localeCompare(b.date));
  const owed = roundMoney(unpaid.reduce((s, x) => s + (x.salePrice || 0) - (x.amountPaid || 0), 0));
  const pay = roundMoney(amount);
  if (!(pay > 0)) throw new Error('Payment amount must be more than zero.');
  if (pay > owed) throw new Error(`Payment is more than the amount due (Rs. ${owed.toLocaleString('en-IN')}).`);

  let remaining = pay;
  const out: { sale: Sale; apply: number; newPaid: number; status: Sale['paymentStatus'] }[] = [];
  for (const sale of unpaid) {
    if (remaining <= 0) break;
    const due = roundMoney((sale.salePrice || 0) - (sale.amountPaid || 0));
    const apply = Math.min(remaining, due);
    const newPaid = roundMoney((sale.amountPaid || 0) + apply);
    out.push({ sale, apply, newPaid, status: newPaid >= (sale.salePrice || 0) - 0.005 ? 'Paid' : 'Partially Paid' });
    remaining = roundMoney(remaining - apply);
  }
  return out;
}
