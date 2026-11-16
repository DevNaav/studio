/**
 * Company backup: every record of one company in a single JSON file.
 *
 * Runs in the browser for admins ("Download backup" in Settings) and works with any
 * Firestore instance passed in, so tests can run it against the emulator. Uploaded files
 * (documents, ID proofs, logos) are stored separately in Vercel Blob; the backup keeps
 * their links and paths.
 *
 * Restore with scripts/restore-backup.mjs.
 */
import { collection, doc, getDoc, getDocs, query, where, Timestamp, type Firestore } from 'firebase/firestore';

export const BACKUP_FORMAT = 'inventra-backup';
export const BACKUP_VERSION = 1;

/** Every collection that holds a company's records (each record has a companyId). */
export const COMPANY_COLLECTIONS = [
  'sites', 'inventory', 'expenses', 'labors', 'attendances', 'labor_transactions', 'work_logs',
  'machines', 'maintenance_logs', 'fuel_logs', 'emi_payments', 'rental_payments', 'machine_attendances',
  'documents', 'sales', 'tools', 'rented_materials', 'rented_material_attendances', 'tasks', 'thefts',
  'warranties', 'defect_liabilities', 'orders', 'bbs', 'site_payments', 'manufacturing_expenses',
  'manufacturing_inventory', 'manufacturing_labor_transactions', 'custom_roles', 'tickets', 'payments', 'users',
] as const;

export interface BackupRecord { id: string; data: Record<string, unknown> }

export interface CompanyBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  companyId: string;
  companyName: string;
  company: Record<string, unknown> | null;
  collections: Record<string, BackupRecord[]>;
  /** Sub-collections under the company, e.g. "activity". */
  companySubcollections: Record<string, BackupRecord[]>;
  counts: Record<string, number>;
}

/** Firestore Timestamps become {"__timestamp": "ISO date"} so they survive JSON and can be restored. */
export function toJsonValue(value: unknown): unknown {
  if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (value && typeof value === 'object') {
    if (typeof (value as any).toDate === 'function' && typeof (value as any).seconds === 'number') {
      return { __timestamp: (value as any).toDate().toISOString() };
    }
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJsonValue(v)]));
  }
  return value;
}

export async function exportCompanyData(db: Firestore, companyId: string, onProgress?: (done: number, total: number) => void): Promise<CompanyBackup> {
  const companySnap = await getDoc(doc(db, 'companies', companyId));
  const company = companySnap.exists() ? (toJsonValue(companySnap.data()) as Record<string, unknown>) : null;

  const collections: Record<string, BackupRecord[]> = {};
  const total = COMPANY_COLLECTIONS.length + 1;
  let done = 0;
  for (const name of COMPANY_COLLECTIONS) {
    const snap = await getDocs(query(collection(db, name), where('companyId', '==', companyId)));
    collections[name] = snap.docs.map(d => ({ id: d.id, data: toJsonValue(d.data()) as Record<string, unknown> }));
    onProgress?.(++done, total);
  }

  const companySubcollections: Record<string, BackupRecord[]> = {};
  try {
    const activity = await getDocs(collection(db, 'companies', companyId, 'activity'));
    companySubcollections.activity = activity.docs.map(d => ({ id: d.id, data: toJsonValue(d.data()) as Record<string, unknown> }));
  } catch {
    companySubcollections.activity = []; // only admins can read the activity log
  }
  onProgress?.(++done, total);

  const counts = Object.fromEntries([
    ...Object.entries(collections).map(([k, v]) => [k, v.length]),
    ...Object.entries(companySubcollections).map(([k, v]) => [`companies/${companyId}/${k}`, v.length]),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    companyId,
    companyName: String(company?.name ?? ''),
    company,
    collections,
    companySubcollections,
    counts,
  };
}

export const backupFileName = (b: Pick<CompanyBackup, 'companyName' | 'exportedAt'>) =>
  `Inventra-backup-${(b.companyName || 'company').replace(/[^a-z0-9]+/gi, '-')}-${b.exportedAt.slice(0, 10)}.json`;
