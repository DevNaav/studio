// Shared helpers for the backup and restore scripts (Node, firebase-admin).
import { Timestamp } from 'firebase-admin/firestore';

/** Firestore Timestamps <-> {"__timestamp": ISO} so data survives JSON. */
export function toJson(value) {
  if (value instanceof Timestamp) return { __timestamp: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(toJson);
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function' && typeof value.seconds === 'number') return { __timestamp: value.toDate().toISOString() };
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v)]));
  }
  return value;
}

export function fromJson(value) {
  if (Array.isArray(value)) return value.map(fromJson);
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && typeof value.__timestamp === 'string') return Timestamp.fromDate(new Date(value.__timestamp));
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromJson(v)]));
  }
  return value;
}

/**
 * Turns either backup format into a flat list of { path, data } documents.
 * - "inventra-backup": one company (Settings > Download backup)
 * - "inventra-full-backup": every collection (nightly backup)
 */
export function documentsInBackup(backup) {
  const out = [];
  if (backup.format === 'inventra-backup') {
    if (backup.company) out.push({ path: `companies/${backup.companyId}`, data: backup.company });
    for (const [name, docs] of Object.entries(backup.collections)) for (const d of docs) out.push({ path: `${name}/${d.id}`, data: d.data });
    for (const [name, docs] of Object.entries(backup.companySubcollections || {})) for (const d of docs) out.push({ path: `companies/${backup.companyId}/${name}/${d.id}`, data: d.data });
  } else if (backup.format === 'inventra-full-backup') {
    for (const d of backup.documents) out.push({ path: d.path, data: d.data });
  } else {
    throw new Error('Not an Inventra backup file.');
  }
  return out;
}
