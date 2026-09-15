/**
 * Firebase Auth — optional Google Sign-In.
 *
 * To enable:
 *   1. Create a Firebase project.
 *   2. Enable Google authentication under Authentication → Sign-in method.
 *   3. Add your web app and copy the config values.
 *   4. Set VITE_FIREBASE_API_KEY and friends in web/.env.
 *
 * ## Why every import here is dynamic
 *
 * The Firebase SDK is roughly 200KB of JavaScript. It used to be imported
 * statically, which meant every visitor downloaded and parsed all of it before
 * the page could paint — including the overwhelming majority who never sign
 * in, and including deployments (like the current one) where the feature is
 * **not configured at all** and the SDK can do nothing but sit there.
 *
 * `isFirebaseConfigured()` deliberately reads only `import.meta.env`, so it
 * answers without touching the SDK. Everything that actually needs Firebase
 * imports it at the moment of use. On an unconfigured deployment the SDK is
 * never fetched; on a configured one it's fetched when someone taps sign-in,
 * which is a moment they're already expecting to wait a beat.
 *
 * The cost is that these functions are all async and the caller has to handle
 * that. That's a fair price for a fifth of a megabyte on the critical path of
 * a product whose users are on mobile data.
 */

/** Minimal shape of what callers use, so nothing here imports Firebase types. */
export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

/**
 * Is sign-in available in this deployment?
 *
 * Reads env only — no SDK import — so the UI can decide whether to render a
 * sign-in button without paying for Firebase to find out.
 */
export const isFirebaseConfigured = (): boolean => Boolean(firebaseConfig.apiKey);

/** Cached across calls so a second sign-in doesn't re-initialise anything. */
let authPromise: Promise<import("firebase/auth").Auth | null> | null = null;

async function loadAuth(): Promise<import("firebase/auth").Auth | null> {
  if (!isFirebaseConfigured()) return null;
  if (!authPromise) {
    authPromise = (async () => {
      const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
      ]);
      // getApps() guards against double-initialisation across HMR reloads,
      // which otherwise throws on the second one in development.
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      return getAuth(app);
    })().catch((err) => {
      console.error("[auth] Firebase failed to load:", err);
      authPromise = null;
      return null;
    });
  }
  return authPromise;
}

function toAuthUser(user: import("firebase/auth").User | null): AuthUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

export async function signInWithGoogle(): Promise<AuthUser | null> {
  const auth = await loadAuth();
  if (!auth) return null;

  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  try {
    const result = await signInWithPopup(auth, new GoogleAuthProvider());
    return toAuthUser(result.user);
  } catch (error) {
    // A closed popup is a user decision, not an error worth reporting.
    console.error("[auth] Google sign-in failed:", error);
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  const auth = await loadAuth();
  if (!auth) return;
  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}

/**
 * Subscribe to sign-in state.
 *
 * Returns the unsubscribe function synchronously even though the SDK loads
 * asynchronously, so a caller can wire this up in a `useEffect` cleanup
 * without an await. Unsubscribing before the SDK finishes loading is handled:
 * the listener is never attached.
 */
export function onAuthChange(callback: (user: AuthUser | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => {};
  }

  let cancelled = false;
  let detach: (() => void) | null = null;

  void (async () => {
    const auth = await loadAuth();
    if (cancelled || !auth) {
      if (!cancelled) callback(null);
      return;
    }
    const { onAuthStateChanged } = await import("firebase/auth");
    if (cancelled) return;
    detach = onAuthStateChanged(auth, (user) => callback(toAuthUser(user)));
  })();

  return () => {
    cancelled = true;
    detach?.();
  };
}
