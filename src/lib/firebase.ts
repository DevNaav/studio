
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
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
const db = getFirestore(app);
const storage = getStorage(app);

// Export the initialized instances.
export { app, auth, db, storage };
