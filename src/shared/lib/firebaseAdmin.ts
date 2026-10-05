import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_APP_NAME = 'family-budget-admin';

/** Lazy initialization: importing this module does not require credentials. */
function getAdminApp() {
  // The SDK registry survives module reloads; never reuse an unrelated app.
  const existing = getApps().find((app) => app.name === ADMIN_APP_NAME);
  if (existing) return existing;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const encodedKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64?.trim();
  if (!projectId || !clientEmail || !encodedKey) {
    throw new Error('Firebase Admin requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY_BASE64.');
  }
  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (clientProjectId && clientProjectId !== projectId) {
    throw new Error('Firebase Admin project must match NEXT_PUBLIC_FIREBASE_PROJECT_ID.');
  }

  // Buffer decoding is permissive: reject corrupted base64 before parsing PEM.
  const keyBytes = Buffer.from(encodedKey, 'base64');
  if (keyBytes.toString('base64') !== encodedKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY_BASE64 must contain valid base64.');
  }

  let credential;
  try {
    credential = cert({ projectId, clientEmail, privateKey: keyBytes.toString('utf8') });
  } catch {
    // Do not include credential contents or SDK parsing details in errors.
    throw new Error('Firebase Admin credentials are invalid. Check the service account email and encoded private key.');
  }

  return initializeApp({ projectId, credential }, ADMIN_APP_NAME);
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}
