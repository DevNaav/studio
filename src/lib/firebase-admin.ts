/**
 * Server-only Firebase Admin app. Token verification only needs the project
 * ID; other Admin operations (deleting auth users, server-side Firestore) use
 * Application Default Credentials, which Firebase App Hosting / Cloud Run
 * provide automatically. Locally they require `gcloud auth application-default login`
 * or a GOOGLE_APPLICATION_CREDENTIALS service-account file.
 */
import { getApps, initializeApp, type App } from 'firebase-admin/app';

if (typeof window !== 'undefined') {
  throw new Error('firebase-admin must only be imported on the server.');
}

export const ADMIN_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  process.env.GCLOUD_PROJECT ||
  'duplicatemanagmne';

const ADMIN_APP_NAME = 'inventra-admin';

export function getAdminApp(): App {
  return getApps().find((a) => a.name === ADMIN_APP_NAME)
    ?? initializeApp({ projectId: ADMIN_PROJECT_ID }, ADMIN_APP_NAME);
}

/** True when an error means the server has no Google credentials (typical in local dev). */
export function isMissingCredentialsError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error);
  return /default credentials|Could not load the default credentials|credential|invalid_grant|metadata/i.test(msg);
}
