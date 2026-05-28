import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getDb } from '@/shared/lib/firebase';
import type { UserProfile } from '@/shared/types';

export async function createUserProfile(uid: string, data: { name: string; email: string }): Promise<UserProfile> {
  const profile = {
    id: uid,
    name: data.name,
    email: data.email,
    currency: 'ILS' as const,
    language: 'ru' as const,
    theme: 'mist' as const,
    darkMode: false,
    accountType: 'personal' as const,
    onboarded: false,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(getDb(), 'users', uid), profile);
  return profile as UserProfile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function signInWithGoogle(): Promise<UserProfile> {
  const result = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
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

export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<UserProfile> {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return createUserProfile(result.user.uid, { name, email });
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}
