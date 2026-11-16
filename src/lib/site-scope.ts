/**
 * Site access for queries. Admins and Project Managers see every site; other roles only the
 * sites assigned to them (plus the warehouse). firestore.rules enforces the same, so
 * company-wide queries for those users must ask only for their sites or the database refuses.
 */
import { collection, getDocs, query, where, type Query } from 'firebase/firestore';
import { db } from '@/lib/firebase';


/** Collections whose records belong to one site (they carry a siteId). */
export const SITE_SCOPED_COLLECTIONS = new Set([
  'inventory', 'labors', 'expenses', 'sales', 'tools', 'rented_materials', 'rented_material_attendances',
  'labor_transactions', 'documents', 'work_logs', 'warranties', 'defect_liabilities', 'attendances', 'tasks',
  'thefts', 'fuel_logs', 'maintenance_logs', 'manufacturing_expenses', 'manufacturing_inventory',
  'manufacturing_labor_transactions', 'bbs', 'orders', 'site_payments',
]);

/** null = this user may see every site; otherwise the site ids they may see. */
let siteScope: string[] | null = null;

/** Called by the auth context when the signed-in profile loads or changes. */
export function setSiteScope(sites: string[] | null) {
  // The warehouse ('main') and company-level records ('') are visible to everyone.
  siteScope = sites === null ? null : Array.from(new Set([...sites, 'main', '']));
}

/** Queries for one company's records, limited to the user's sites when needed (max 30 per query). */
export function companyQueries(collectionName: string, companyId: string): Query[] {
  const base = collection(db, collectionName);
  if (siteScope === null || !SITE_SCOPED_COLLECTIONS.has(collectionName)) {
    return [query(base, where('companyId', '==', companyId))];
  }
  const chunks: string[][] = [];
  for (let i = 0; i < siteScope.length; i += 30) chunks.push(siteScope.slice(i, i + 30));
  return chunks.map(sites => query(base, where('companyId', '==', companyId), where('siteId', 'in', sites)));
}

/** One-off read of a company's records (respects the user's site access). */
export async function getCompanyDocs<T>(collectionName: string, companyId: string): Promise<T[]> {
  const snaps = await Promise.all(companyQueries(collectionName, companyId).map(q => getDocs(q)));
  const seen = new Set<string>();
  return snaps.flatMap(s => s.docs)
    .filter(d => (seen.has(d.id) ? false : (seen.add(d.id), true)))
    .map(d => ({ id: d.id, ...d.data() }) as T)
    .filter((d: any) => !d.isDeleted);
}

