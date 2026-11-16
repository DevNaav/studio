
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager, terminate, clearIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// The Firebase web key comes from NEXT_PUBLIC_FIREBASE_API_KEY (set in Vercel).
// Without it Firebase throws while the build pre-renders pages, failing the whole build
// (e.g. Vercel preview builds when the key is only set for Production). A placeholder
// lets the build finish; that deployment simply can't sign anyone in, and says so.
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'missing-NEXT_PUBLIC_FIREBASE_API_KEY';
if (!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && typeof window !== 'undefined') {
  console.error('NEXT_PUBLIC_FIREBASE_API_KEY is not set for this deployment, so sign-in will not work. Add it in Vercel → Settings → Environment Variables.');
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey,
  authDomain: "duplicatemanagmne.firebaseapp.com",
  projectId: "duplicatemanagmne",
  storageBucket: "duplicatemanagmne.appspot.com",
  messagingSenderId: "1026096148735",
  appId: "1:1026096148735:web:10e6bbd8295bcf4b585cca",
  measurementId: "G-P0PLK3DB1P"
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    if (typeof window !== 'undefined') {
        isSupported().then(yes => yes ? getAnalytics(app) : null);
    }
} else {
    app = getApp();
}

const auth = getAuth(app);
// Skip undefined fields (e.g. blank optional form inputs) instead of rejecting the whole write.
let db: Firestore;
try {
    db = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        // Keep a copy of loaded records in the browser, so pages show the last-seen numbers at once
        // and then update live, instead of waiting for every list on every visit.
        // Wiped on sign-out (clearLocalData) so the next person on a shared computer starts clean.
        ...(typeof window !== 'undefined' ? { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) } : {}),
    });
} catch {
    db = getFirestore(app); // already initialised (hot reload)
}

/** Delete the browser's copy of company records. Firestore can't be used afterwards, so reload the page next. */
export async function clearLocalData() {
    try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
    } catch (e) {
        console.warn('Could not clear the local data cache', e);
    }
}

/**
 * A separate Auth instance used only to create accounts for other people
 * (admins adding team members). Creating a user on the main instance would sign
 * the admin out and sign the new user in; this one keeps the admin's session intact.
 */
const SECONDARY_APP_NAME = 'user-provisioning';
function getProvisioningAuth(): Auth {
    const existing = getApps().find(a => a.name === SECONDARY_APP_NAME);
    if (existing) return getAuth(existing);
    const secondary = initializeApp(firebaseConfig, SECONDARY_APP_NAME);
    return initializeAuth(secondary, { persistence: inMemoryPersistence });
}

// Export the initialized instances.
// Files are stored on the app server (see src/lib/file-upload.ts), not Firebase Storage.
export { app, auth, db, getProvisioningAuth };
