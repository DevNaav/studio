/**
 * Activity log: who added, changed or deleted what, and when.
 *
 * Entries go to companies/{companyId}/activity. The security rules make them add-only
 * (nobody can edit or delete them, admins included), stamp them with the server time and
 * check the person really is who the entry says. Only admins can read them.
 *
 * Logging never blocks or breaks the actual save: failures are only printed to the console.
 */
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type ActivityAction = 'create' | 'update' | 'delete' | 'restore' | 'payment' | 'other';

export interface ActivityChange {
  field: string;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
}

export interface ActivityEntry {
  id?: string;
  companyId: string;
  siteId?: string | null;
  actorUid: string;
  actorName: string;
  actorRole: string;
  action: ActivityAction;
  entity: string;      // collection name, e.g. 'expenses'
  entityId?: string | null;
  label?: string;      // e.g. the expense description
  summary: string;     // one readable line
  changes?: ActivityChange[];
  at?: any;            // server timestamp
}

interface Actor {
  uid: string;
  name: string;
  role: string;
}

let actor: Actor | null = null;

/** Called by the auth context when the signed-in profile loads or changes. */
export function setActivityActor(next: Actor | null) {
  actor = next;
}

/** Collections that are not logged one by one (too noisy) or are the log itself. */
const NOT_LOGGED = new Set(['attendances', 'machine_attendances', 'rented_material_attendances', 'activity', 'emi_payments']);

/** Friendly singular names for collections. */
const ENTITY_NAMES: Record<string, string> = {
  sites: 'site', expenses: 'expense', manufacturing_expenses: 'manufacturing expense', inventory: 'stock entry',
  labors: 'worker', labor_transactions: 'worker payment', work_logs: 'work log', machines: 'machine',
  maintenance_logs: 'maintenance log', fuel_logs: 'fuel log', documents: 'document', sales: 'sale', tools: 'tool',
  rented_materials: 'rented material', tasks: 'task', thefts: 'theft report', warranties: 'warranty',
  defect_liabilities: 'defect liability', orders: 'material order', rental_payments: 'rental payment',
  site_payments: 'site payment', users: 'team member', companies: 'company', bbs: 'bar bending schedule',
};

export const entityName = (entity: string) => ENTITY_NAMES[entity] ?? entity.replace(/_/g, ' ').replace(/s$/, '');

/** Fields never shown in "what changed" (internal, huge or private). */
const HIDDEN_FIELDS = new Set([
  'companyId', 'isDeleted', 'createdAt', 'updatedAt', 'extractedText', 'content', 'url', 'filePath',
  'idProofUrl', 'idProofFilePath', 'documentUrl', 'documentPath', 'logoUrl', 'logoPath', 'photoURL', 'uid',
]);

const LABEL_FIELDS = ['name', 'description', 'materialName', 'productName', 'gradeName', 'title', 'machineName', 'responsibleParty'];
const AMOUNT_FIELDS = ['amount', 'salePrice', 'cost', 'price', 'totalCost', 'purchasePrice', 'wage'];

export function labelOf(data: Record<string, any> | undefined | null): string | undefined {
  if (!data) return undefined;
  for (const f of LABEL_FIELDS) {
    if (typeof data[f] === 'string' && data[f].trim()) return data[f].trim().slice(0, 80);
  }
  return undefined;
}

const rs = (n: number) => `Rs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

function amountOf(data: Record<string, any> | undefined | null): number | undefined {
  if (!data) return undefined;
  for (const f of AMOUNT_FIELDS) if (typeof data[f] === 'number' && data[f] > 0) return data[f];
  return undefined;
}

/** Turns a stored value into something small and readable for the log. */
function simple(value: any): string | number | boolean | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  return '(details)';
}

/** Lists the fields that actually changed between the old and new data. */
export function diffChanges(before: Record<string, any> | undefined, update: Record<string, any>): ActivityChange[] {
  const out: ActivityChange[] = [];
  for (const [field, next] of Object.entries(update)) {
    if (HIDDEN_FIELDS.has(field)) continue;
    const prev = before?.[field];
    if (JSON.stringify(prev ?? null) === JSON.stringify(next ?? null)) continue;
    out.push({ field, from: simple(prev), to: simple(next) });
  }
  return out.slice(0, 20);
}

function summaryFor(action: ActivityAction, entity: string, label?: string, amount?: number): string {
  const verb = { create: 'Added', update: 'Edited', delete: 'Deleted', restore: 'Restored', payment: 'Recorded', other: 'Changed' }[action];
  return `${verb} ${entityName(entity)}${label ? ` "${label}"` : ''}${amount ? ` · ${rs(amount)}` : ''}`;
}

/** Writes one entry. Never throws. */
export function logActivity(entry: Omit<ActivityEntry, 'actorUid' | 'actorName' | 'actorRole' | 'at' | 'companyId'> & { companyId: string | null | undefined }) {
  if (!actor || !entry.companyId || (NOT_LOGGED.has(entry.entity) && entry.action !== 'other')) return;
  const doc: Record<string, any> = {
    companyId: entry.companyId,
    actorUid: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    action: entry.action,
    entity: entry.entity,
    summary: entry.summary.slice(0, 300),
    at: serverTimestamp(),
  };
  // Firestore rejects undefined values, so optional fields are only added when set.
  if (entry.siteId) doc.siteId = entry.siteId;
  if (entry.entityId) doc.entityId = entry.entityId;
  if (entry.label) doc.label = entry.label;
  if (entry.changes?.length) doc.changes = entry.changes;
  addDoc(collection(db, 'companies', entry.companyId, 'activity'), doc).catch(err =>
    console.warn('Could not write activity log entry:', err),
  );
}

/** Log helpers used by the shared save functions. */
export const activity = {
  created(entity: string, id: string | undefined, data: Record<string, any>) {
    const label = labelOf(data);
    logActivity({
      companyId: data.companyId, siteId: data.siteId, action: 'create', entity, entityId: id, label,
      summary: summaryFor('create', entity, label, amountOf(data)),
    });
  },
  updated(entity: string, id: string, before: Record<string, any> | undefined, update: Record<string, any>) {
    const companyId = update.companyId ?? before?.companyId;
    const label = labelOf({ ...before, ...update });
    let action: ActivityAction = 'update';
    if (update.isDeleted === true && !before?.isDeleted) action = 'delete';
    else if (update.isDeleted === false && before?.isDeleted) action = 'restore';
    const changes = action === 'update' ? diffChanges(before, update) : [];
    if (action === 'update' && changes.length === 0) return; // nothing visible changed
    logActivity({
      companyId, siteId: update.siteId ?? before?.siteId, action, entity, entityId: id, label, changes,
      summary: action === 'update'
        ? `${summaryFor('update', entity, label)}: ${changes.map(c => c.field).join(', ')}`
        : summaryFor(action, entity, label, amountOf(before)),
    });
  },
  deleted(entity: string, id: string, before: Record<string, any> | undefined, permanent = false) {
    const label = labelOf(before);
    logActivity({
      companyId: before?.companyId, siteId: before?.siteId, action: 'delete', entity, entityId: id, label,
      summary: `${summaryFor('delete', entity, label, amountOf(before))}${permanent ? ' (permanently)' : ''}`,
    });
  },
};
