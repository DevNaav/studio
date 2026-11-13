'use server';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp, isMissingCredentialsError } from '@/lib/firebase-admin';
import { requireUser, AuthError } from '@/ai/require-user';

export type DeleteUserResult =
  | { ok: true }
  | { ok: false; reason: 'no-credentials' | 'forbidden' | 'error'; message: string };

/**
 * Permanently deletes a team member: their Firebase Auth login and their
 * Firestore profile. Only a SuperAdmin, or an Admin of the same company
 * (deleting someone other than themselves), may do this.
 */
export async function deleteUserAccount(targetUid: string, idToken: string): Promise<DeleteUserResult> {
  try {
    const callerUid = await requireUser(idToken);
    if (!targetUid || typeof targetUid !== 'string') {
      return { ok: false, reason: 'error', message: 'No user specified.' };
    }

    const app = getAdminApp();
    const db = getFirestore(app);
    const [callerSnap, targetSnap] = await Promise.all([
      db.doc(`users/${callerUid}`).get(),
      db.doc(`users/${targetUid}`).get(),
    ]);
    const caller = callerSnap.data();
    const target = targetSnap.data();

    const isSuperAdmin = caller?.role === 'SuperAdmin' && !caller?.companyId;
    const isCompanyAdmin =
      caller?.role === 'Admin' && !!caller?.companyId && caller.companyId === target?.companyId;
    if (!isSuperAdmin && !(isCompanyAdmin && callerUid !== targetUid)) {
      return { ok: false, reason: 'forbidden', message: 'You can only remove users from your own company.' };
    }
    if (target?.role === 'SuperAdmin' && !target?.companyId) {
      return { ok: false, reason: 'forbidden', message: 'SuperAdmin accounts can only be removed in the Firebase console.' };
    }

    try {
      await getAuth(app).deleteUser(targetUid);
    } catch (error: any) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }
    await db.doc(`users/${targetUid}`).delete();
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, reason: 'forbidden', message: error.message };
    if (isMissingCredentialsError(error)) {
      return { ok: false, reason: 'no-credentials', message: 'Server has no Firebase Admin credentials.' };
    }
    console.error('deleteUserAccount failed:', error);
    return { ok: false, reason: 'error', message: 'Could not delete the user. Please try again.' };
  }
}
