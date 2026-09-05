import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, connectFirestoreEmulator, persistentLocalCache, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Emulator wiring for E2E. Strictly opt-in via a build-time flag so a
// production bundle can NEVER point at a local emulator. Hosts are fixed to
// the ports in firebase.json; the flag is only set for the emulated E2E build.
const USE_EMULATOR = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === '1';
const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
const FIRESTORE_EMULATOR_PORT = 8090;

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
let _authEmulatorConnected = false;
let _dbEmulatorConnected = false;

export function isFirebaseConfigured(): boolean {
  return Object.values(firebaseConfig).every(Boolean);
}

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured. Fill .env.local with NEXT_PUBLIC_FIREBASE_* values.');
  }
}

export function getApp(): FirebaseApp {
  assertFirebaseConfigured();
  if (!_app) {
    _app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return _app;
}

export function getDb(): Firestore {
  if (!_db) {
    const app = getApp();
    try {
      // The emulator has no persistence layer; a plain instance connects cleanly.
      _db = USE_EMULATOR
        ? getFirestore(app)
        : initializeFirestore(app, { localCache: persistentLocalCache() });
    } catch {
      _db = getFirestore(app);
    }
    if (USE_EMULATOR && !_dbEmulatorConnected) {
      connectFirestoreEmulator(_db, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT);
      _dbEmulatorConnected = true;
    }
  }
  return _db;
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getApp());
    if (USE_EMULATOR && !_authEmulatorConnected) {
      connectAuthEmulator(_auth, AUTH_EMULATOR_URL, { disableWarnings: true });
      _authEmulatorConnected = true;
    }
  }
  return _auth;
}

// Legacy export for compatibility
export function getFirebaseApp() { return getApp(); }
