import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  initializeFirestore,
  persistentLocalCache,
} from 'firebase/firestore';
import { getFirebaseApp } from '@/shared/lib/firebase';
import type { UserProfile } from '@/shared/types';

function getDb() {
  const app = getFirebaseApp();
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    return getFirestore(app);
  }
}

export async function createUserProfile(
  uid: string,
  data: { name: string; email: string }
): Promise<UserProfile> {
  const db = getDb();
  const profile: Omit<UserProfile, 'createdAt'> & { createdAt: unknown } = {
    id: uid,
    name: data.name,
    email: data.email,
    currency: 'ILS',
    language: 'en',
    theme: 'light',
    accountType: 'personal',
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'users', uid), profile);
  return profile as UserProfile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getDb();
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const app = getFirebaseApp();
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  const { user } = result;

  let profile = await getUserProfile(user.uid);
  if (!profile) {
    profile = await createUserProfile(user.uid, {
      name: user.displayName ?? 'User',
      email: user.email ?? '',
    });
  }
  return profile;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<void> {
  const auth = getAuth(getFirebaseApp());
  await signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<UserProfile> {
  const auth = getAuth(getFirebaseApp());
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return createUserProfile(result.user.uid, { name, email });
}

export async function signOut(): Promise<void> {
  const auth = getAuth(getFirebaseApp());
  await firebaseSignOut(auth);
}
