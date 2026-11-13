/**
 * Decides who may upload or delete which files.
 *
 * Folder layout (first segment = category):
 *   logos/<companyId>/…            company admins
 *   documents/<companyId>/…        company members
 *   labor_ids/<companyId>/…        company members
 *   rented_materials/<companyId>/… company members
 *   avatars/<uid>/…                the user themself
 *   landing/…                      SuperAdmin (public website images)
 */
import 'server-only';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, ADMIN_PROJECT_ID } from '@/lib/firebase-admin';

export type FileCategory = 'logos' | 'documents' | 'labor_ids' | 'rented_materials' | 'avatars' | 'landing';
export const FILE_CATEGORIES: FileCategory[] = ['logos', 'documents', 'labor_ids', 'rented_materials', 'avatars', 'landing'];

export interface Caller {
  uid: string;
  role: string | null;
  companyId: string | null;
  isSuperAdmin: boolean;
}

export class AccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Verifies the Firebase ID token and loads the caller's profile. The profile is
 * read through the Firestore REST API *with the caller's own token*, so the
 * security rules apply and no admin credentials are needed.
 */
export async function getCaller(authHeader: string | null): Promise<Caller> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) throw new AccessError('You must be signed in.', 401);

  let uid: string;
  try {
    uid = (await getAuth(getAdminApp()).verifyIdToken(token)).uid;
  } catch {
    throw new AccessError('Your session has expired. Please sign in again.', 401);
  }

  const res = await fetch(
    `https://firestore.googleapis.com/v1/projects/${ADMIN_PROJECT_ID}/databases/(default)/documents/users/${encodeURIComponent(uid)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (res.status === 404) throw new AccessError('Your profile was not found.', 403);
  if (!res.ok) throw new AccessError('Could not verify your account.', 502);
  const fields = (await res.json()).fields ?? {};
  const role: string | null = fields.role?.stringValue ?? null;
  const companyId: string | null = fields.companyId?.stringValue || null;
  return { uid, role, companyId, isSuperAdmin: role === 'SuperAdmin' && !companyId };
}

/** Returns the folder a new upload goes into, or throws if the caller may not upload there. */
export function folderForUpload(caller: Caller, category: string, companyId: string | null): string {
  if (!FILE_CATEGORIES.includes(category as FileCategory)) throw new AccessError('Unknown upload type.', 400);
  const cat = category as FileCategory;

  if (cat === 'avatars') return `avatars/${caller.uid}`;
  if (cat === 'landing') {
    if (!caller.isSuperAdmin) throw new AccessError('Only the platform admin can upload website images.', 403);
    return 'landing';
  }
  if (!companyId || !/^[A-Za-z0-9_-]{1,128}$/.test(companyId)) throw new AccessError('Missing company.', 400);
  const member = caller.isSuperAdmin || caller.companyId === companyId;
  if (!member) throw new AccessError('You can only upload files for your own company.', 403);
  if (cat === 'logos' && !caller.isSuperAdmin && caller.role !== 'Admin') {
    throw new AccessError('Only company admins can change the logo.', 403);
  }
  return `${cat}/${companyId}`;
}

/** Throws unless the caller may delete the file at relPath. */
export function assertCanDelete(caller: Caller, relPath: string): void {
  const [cat, owner] = relPath.split('/');
  if (caller.isSuperAdmin) return;
  if (cat === 'avatars' && owner === caller.uid) return;
  if (cat === 'landing') throw new AccessError('Not allowed.', 403);
  if (!FILE_CATEGORIES.includes(cat as FileCategory) || owner !== caller.companyId) {
    throw new AccessError('You can only delete your own company’s files.', 403);
  }
  if (cat === 'logos' && caller.role !== 'Admin') throw new AccessError('Only company admins can change the logo.', 403);
}

/** Throws unless the caller may get a link to the file at relPath (any member of the owning company). */
export function assertCanRead(caller: Caller, relPath: string): void {
  const [cat, owner] = relPath.split('/');
  if (caller.isSuperAdmin || cat === 'landing') return;
  if (cat === 'avatars' && owner === caller.uid) return;
  if (!FILE_CATEGORIES.includes(cat as FileCategory) || owner !== caller.companyId) {
    throw new AccessError('You can only access your own company’s files.', 403);
  }
}
