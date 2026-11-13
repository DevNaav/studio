
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth, initializeAuth, inMemoryPersistence } from "firebase/auth";
import { getFirestore, initializeFirestore, Firestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
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
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
    db = getFirestore(app); // already initialised (hot reload)
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
