/**
 * Material stock maths, shared by the Materials tab, low-stock alerts and the sales stock check.
 *
 * One material = one unit. Entries are grouped by name ignoring case and extra spaces.
 * - The material's unit is its most-used unit ("bags" and "BAGS" are the same).
 * - Entries without a unit (often "Used" entries) count in that unit.
 * - Other units are converted when possible (kg <-> ton, ft³ <-> m³, ...).
 * - Units that can't be converted (bags vs kg) are left out of the totals and reported,
 *   instead of being silently added together.
 */
import { convertUnits } from '@/lib/utils';
import type { InventoryItem } from '@/lib/types';

export const materialKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();
const unitKey = (unit?: string | null) => (unit ?? '').trim().toLowerCase();

export interface MaterialSummary {
  key: string;
  name: string;
  unit: string;              // '' when no entry has a unit
  bought: number;
  used: number;
  stored: number;            // bought - used, in `unit`
  totalCost: number;         // Rs. spent on "Bought" entries (including ones left out below)
  lowStockThreshold?: number;
  /** Units that couldn't be converted to `unit`; those entries are not in the totals. */
  mixedUnits: string[];
}

/** The unit a material is recorded in (its most common unit), or '' if none. */
export function mainUnit(items: Pick<InventoryItem, 'unit'>[]): string {
  const counts = new Map<string, { label: string; n: number }>();
  items.forEach(i => {
    const k = unitKey(i.unit);
    if (!k) return;
    const c = counts.get(k) ?? { label: i.unit!.trim(), n: 0 };
    c.n += 1;
    counts.set(k, c);
  });
  return [...counts.values()].sort((a, b) => b.n - a.n)[0]?.label ?? '';
}

/** Converts an entry's quantity into `unit`; null when it can't be converted. */
export function quantityIn(item: Pick<InventoryItem, 'quantity' | 'unit'>, unit: string): number | null {
  const qty = Number(item.quantity) || 0;
  const from = unitKey(item.unit);
  if (!from || !unit || from === unitKey(unit)) return qty;
  // convertUnits uses exact unit names; try the stored spelling and lower case.
  return convertUnits(qty, item.unit!.trim(), unit) ?? convertUnits(qty, from, unitKey(unit));
}

export function summariseMaterials(items: InventoryItem[]): MaterialSummary[] {
  const groups = new Map<string, InventoryItem[]>();
  items
    .filter(i => !i.isDeleted && (i.type === 'Material' || !i.type))
    .forEach(i => {
      const k = materialKey(i.name || '');
      if (!k) return;
      groups.set(k, [...(groups.get(k) ?? []), i]);
    });

  return [...groups.entries()].map(([key, list]) => {
    const unit = mainUnit(list);
    const mixed = new Set<string>();
    let bought = 0, used = 0, totalCost = 0;
    let lowStockThreshold: number | undefined;
    list.forEach(i => {
      if (i.status === 'Bought') totalCost += (Number(i.quantity) || 0) * (i.pricePerUnit || 0);
      if (i.lowStockThreshold) lowStockThreshold = i.lowStockThreshold;
      const q = quantityIn(i, unit);
      if (q === null) { mixed.add(i.unit!.trim()); return; }
      if (i.status === 'Bought') bought += q;
      else if (i.status === 'Used') used += q;
    });
    const round = (n: number) => Math.round(n * 1000) / 1000;
    return {
      key,
      name: list[0].name.trim(),
      unit,
      bought: round(bought),
      used: round(used),
      stored: round(bought - used),
      totalCost,
      lowStockThreshold,
      mixedUnits: [...mixed],
    };
  });
}

/**
 * Checks a new or edited entry's unit against the material's other entries.
 * Returns an error message when it doesn't fit, or null when it's fine.
 */
export function unitProblem(name: string, unit: string | undefined, otherEntries: InventoryItem[]): string | null {
  const others = otherEntries.filter(i => !i.isDeleted && materialKey(i.name || '') === materialKey(name));
  const existing = mainUnit(others);
  if (!existing || !unitKey(unit) || unitKey(unit) === unitKey(existing)) return null;
  if (quantityIn({ quantity: 1, unit }, existing) !== null) return null; // convertible (e.g. kg vs ton)
  return `"${name.trim()}" is recorded in ${existing}. Enter the quantity in ${existing} so stock adds up correctly.`;
}
