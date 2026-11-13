/**
 * In-app alerts: works out what needs attention from data the app already stores.
 * Pure functions only (no database calls), so the rules are easy to test and change.
 */
import { differenceInCalendarDays, parseISO, isValid } from 'date-fns';
import type {
  DefectLiability, Document, EmiPayment, InventoryItem, Machine, RentedMaterial, Sale, Site, Task, Warranty,
} from '@/lib/types';

export type AlertSeverity = 'critical' | 'warning' | 'info';

/** Where clicking an alert takes the user. */
export type AlertTarget =
  | { view: 'site'; siteId: string }
  | { view: 'machines' | 'documents' | 'warranty-tracker' | 'defect-liability' };

export interface AppAlert {
  /** Stable id: the same problem keeps the same id, so "mark as read" sticks. */
  id: string;
  severity: AlertSeverity;
  category: 'Stock' | 'EMI' | 'Payments' | 'Documents' | 'Warranty' | 'Retention' | 'Rentals' | 'Tasks';
  title: string;
  detail: string;
  target: AlertTarget;
  /** True when only admins can open the target page. */
  adminOnly?: boolean;
}

export interface AlertInputs {
  sites: Site[];
  inventory: InventoryItem[];
  emiPayments: EmiPayment[];
  machines: Machine[];
  sales: Sale[];
  documents: Document[];
  warranties: Warranty[];
  liabilities: DefectLiability[];
  rentedMaterials: RentedMaterial[];
  tasks: Task[];
  /** yyyy-MM-dd in the user's time zone. */
  today: string;
}

/** How far ahead to warn, and when unpaid things become a problem. */
export const ALERT_RULES = {
  emiDueSoonDays: 7,
  expiringSoonDays: 30,
  unpaidSaleDays: 30,
  longRentalDays: 60,
};

const money = (n: number) => `Rs. ${Math.round(n).toLocaleString('en-IN')}`;

function daysFrom(today: Date, dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  const d = parseISO(dateStr.slice(0, 10));
  return isValid(d) ? differenceInCalendarDays(d, today) : null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const severityRank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };

export function computeAlerts(input: AlertInputs): AppAlert[] {
  const today = parseISO(input.today);
  const alerts: AppAlert[] = [];
  const liveSites = input.sites.filter(s => !s.isDeleted);
  const siteName = new Map(liveSites.map(s => [s.id, s.name]));
  const activeSiteIds = new Set(liveSites.filter(s => s.status !== 'Completed').map(s => s.id));

  // --- Low stock: per site and material, same maths as the Materials tab (bought - used). ---
  const stock = new Map<string, { siteId: string; name: string; unit?: string; qty: number; threshold?: number }>();
  input.inventory
    .filter(i => !i.isDeleted && i.type === 'Material' && activeSiteIds.has(i.siteId))
    .forEach(i => {
      const key = `${i.siteId}|${i.name.trim().toLowerCase()}`;
      const entry = stock.get(key) ?? { siteId: i.siteId, name: i.name.trim(), qty: 0 };
      if (i.status === 'Bought') entry.qty += Number(i.quantity) || 0;
      else if (i.status === 'Used') entry.qty -= Number(i.quantity) || 0;
      if (i.unit) entry.unit = i.unit;
      if (i.lowStockThreshold) entry.threshold = i.lowStockThreshold;
      stock.set(key, entry);
    });
  stock.forEach((s, key) => {
    if (s.threshold === undefined || s.qty > s.threshold) return;
    const unit = s.unit ? ` ${s.unit}` : '';
    alerts.push({
      id: `stock:${key}`,
      severity: s.qty <= 0 ? 'critical' : 'warning',
      category: 'Stock',
      title: s.qty <= 0 ? `${s.name} is out of stock` : `${s.name} is running low`,
      detail: `${siteName.get(s.siteId)}: ${Math.max(0, +s.qty.toFixed(2))}${unit} left (alert at ${s.threshold}${unit}).`,
      target: { view: 'site', siteId: s.siteId },
    });
  });

  // --- EMI instalments overdue or due soon. ---
  const machineName = new Map(input.machines.map(m => [m.id, m.name]));
  input.emiPayments
    .filter(p => !p.isDeleted && p.status !== 'Paid' && machineName.has(p.machineId))
    .forEach(p => {
      const days = daysFrom(today, p.dueDate);
      if (days === null || days > ALERT_RULES.emiDueSoonDays) return;
      const name = machineName.get(p.machineId);
      alerts.push({
        id: `emi:${p.id}:${days < 0 ? 'overdue' : 'soon'}`,
        severity: days < 0 ? 'critical' : 'warning',
        category: 'EMI',
        title: days < 0 ? `EMI overdue for ${name}` : days === 0 ? `EMI due today for ${name}` : `EMI due in ${plural(days, 'day')} for ${name}`,
        detail: `${money(p.amount)} due on ${p.dueDate}${days < 0 ? ` (${plural(-days, 'day')} late)` : ''}.`,
        target: { view: 'machines' },
      });
    });

  // --- Sales unpaid for a long time, grouped by selling site and buyer. ---
  const unpaid = new Map<string, { siteId: string; buyer: string; count: number; due: number; oldest: number }>();
  input.sales
    .filter(s => !s.isDeleted && s.paymentStatus !== 'Paid' && siteName.has(s.siteId))
    .forEach(s => {
      const age = daysFrom(today, s.date);
      const due = (s.salePrice || 0) - (s.amountPaid || 0);
      if (age === null || -age < ALERT_RULES.unpaidSaleDays || due <= 0.5) return;
      const buyer = s.destinationSiteId ? (siteName.get(s.destinationSiteId) ?? 'another site') : (s.buyerInfo?.trim() || 'External buyers');
      const key = `${s.siteId}|${buyer.toLowerCase()}`;
      const entry = unpaid.get(key) ?? { siteId: s.siteId, buyer, count: 0, due: 0, oldest: 0 };
      entry.count += 1;
      entry.due += due;
      entry.oldest = Math.max(entry.oldest, -age);
      unpaid.set(key, entry);
    });
  unpaid.forEach((u, key) => {
    alerts.push({
      id: `sales:${key}`,
      severity: u.oldest >= ALERT_RULES.unpaidSaleDays * 2 ? 'critical' : 'warning',
      category: 'Payments',
      title: `${money(u.due)} unpaid by ${u.buyer}`,
      detail: `${plural(u.count, 'sale')} from ${siteName.get(u.siteId)}, oldest ${u.oldest} days ago.`,
      target: { view: 'site', siteId: u.siteId },
    });
  });

  // --- Documents expired or expiring (licences, insurance, permits...). ---
  input.documents
    .filter(d => !d.isDeleted && d.expiryDate)
    .forEach(d => {
      const days = daysFrom(today, d.expiryDate);
      if (days === null || days > ALERT_RULES.expiringSoonDays) return;
      const isMachineDoc = !!d.machineId;
      alerts.push({
        id: `doc:${d.id}:${days < 0 ? 'expired' : 'soon'}`,
        severity: days < 0 ? 'critical' : days <= 7 ? 'warning' : 'info',
        category: 'Documents',
        title: days < 0 ? `"${d.name}" has expired` : `"${d.name}" expires in ${plural(days, 'day')}`,
        detail: `${isMachineDoc ? `Machine: ${machineName.get(d.machineId!) ?? 'unknown'}` : (siteName.get(d.siteId) ?? 'Company document')} · expiry ${d.expiryDate}.`,
        target: isMachineDoc ? { view: 'machines' } : { view: 'documents' },
        adminOnly: !isMachineDoc,
      });
    });

  // --- Warranties ending soon: last chance to claim. ---
  input.warranties
    .filter(w => !w.isDeleted)
    .forEach(w => {
      const days = daysFrom(today, w.endDate);
      if (days === null || days < 0 || days > ALERT_RULES.expiringSoonDays) return;
      alerts.push({
        id: `warranty:${w.id}`,
        severity: 'info',
        category: 'Warranty',
        title: `Warranty for ${w.productName} ends in ${plural(days, 'day')}`,
        detail: `${w.type} · ${w.responsibleParty}. Raise any claims before ${w.endDate}.`,
        target: { view: 'warranty-tracker' },
        adminOnly: true,
      });
    });

  // --- Defect liability period over, retention money not yet claimed back. ---
  input.liabilities
    .filter(l => !l.isDeleted && !l.retentionReleased && (l.retentionAmount || 0) > 0)
    .forEach(l => {
      const days = daysFrom(today, l.endDate);
      if (days === null || days > 0) return;
      alerts.push({
        id: `retention:${l.id}`,
        severity: 'warning',
        category: 'Retention',
        title: `Claim ${money(l.retentionAmount)} retention`,
        detail: `${siteName.get(l.siteId) ?? 'Completed site'}: defect liability ended ${l.endDate} (${l.responsibleParty}).`,
        target: { view: 'defect-liability' },
        adminOnly: true,
      });
    });

  // --- Rented material kept for a long time: rent keeps adding up. ---
  input.rentedMaterials
    .filter(r => !r.isDeleted && r.status === 'Active' && activeSiteIds.has(r.siteId))
    .forEach(r => {
      const days = daysFrom(today, r.startDate);
      if (days === null || -days < ALERT_RULES.longRentalDays) return;
      const rentSoFar = -days * (r.rentPerDay || 0) * (r.quantity || 0);
      alerts.push({
        id: `rental:${r.id}`,
        severity: 'info',
        category: 'Rentals',
        title: `${r.materialName} rented for ${-days} days`,
        detail: `${siteName.get(r.siteId)}: from ${r.rentedFrom}, about ${money(rentSoFar)} so far. Return it if no longer needed.`,
        target: { view: 'site', siteId: r.siteId },
      });
    });

  // --- Overdue tasks, one alert per site. ---
  const overdueBySite = new Map<string, number>();
  input.tasks
    .filter(t => !t.isDeleted && t.status !== 'Done' && t.dueDate && t.dueDate < input.today && siteName.has(t.siteId))
    .forEach(t => overdueBySite.set(t.siteId, (overdueBySite.get(t.siteId) ?? 0) + 1));
  overdueBySite.forEach((count, siteId) => {
    alerts.push({
      id: `tasks:${siteId}:${count}`,
      severity: 'warning',
      category: 'Tasks',
      title: `${plural(count, 'task')} overdue`,
      detail: `${siteName.get(siteId)}: past the due date and not done.`,
      target: { view: 'site', siteId },
    });
  });

  return alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.category.localeCompare(b.category));
}

