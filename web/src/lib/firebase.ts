/**
 * Firebase Auth - Google Sign-In (Optional)
 *
 * To enable Google Sign-In:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Google authentication in Authentication > Sign-in method
 * 3. Add your web app to get the config values
 * 4. Set VITE_FIREBASE_API_KEY and other env vars in web/.env
 *
 * When enabled, the home screen will show a "Sign in with Google" button
 * that allows persistent profiles and stat tracking.
 */

import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

/** Whether Firebase is configured */
export const isFirebaseConfigured = (): boolean => {
  return !!firebaseConfig.apiKey;
};

let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;

function getFirebaseApp() {
  if (!app && isFirebaseConfigured()) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseAuth() {
  if (!auth) {
    const fbApp = getFirebaseApp();
    if (!fbApp) return null;
    auth = getAuth(fbApp);
  }
  return auth;
}

export async function signInWithGoogle(): Promise<User | null> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return null;

  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(firebaseAuth, provider);
    return result.user;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) return;
  await signOut(firebaseAuth);
}

export function onAuthChange(callback: (user: User | null) => void): () => void {
  const firebaseAuth = getFirebaseAuth();
  if (!firebaseAuth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(firebaseAuth, callback);
}
