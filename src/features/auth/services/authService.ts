import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
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

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
}

/** True when the account has an email/password credential to change. */
export function hasPasswordProvider(): boolean {
  const user = getFirebaseAuth().currentUser;
  return !!user?.providerData.some((p) => p.providerId === EmailAuthProvider.PROVIDER_ID);
}

export type ChangePasswordError =
  | 'wrong-password'
  | 'weak-password'
  | 'too-many-requests'
  | 'no-password-provider'
  | 'unknown';

/**
 * Changes the signed-in user's password. Firebase requires a recent login for
 * this, so the current password is re-verified first — that also means a wrong
 * current password fails before anything is written.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: ChangePasswordError }> {
  const user = getFirebaseAuth().currentUser;
  if (!user?.email || !hasPasswordProvider()) {
    return { ok: false, reason: 'no-password-provider' };
  }
  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword),
    );
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/too-many-requests') return { ok: false, reason: 'too-many-requests' };
    // invalid-credential / wrong-password / invalid-login-credentials all mean
    // the same thing to the user: the current password did not match
    return { ok: false, reason: 'wrong-password' };
  }
  try {
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/weak-password') return { ok: false, reason: 'weak-password' };
    return { ok: false, reason: 'unknown' };
  }
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<UserProfile> {
  const result = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  return createUserProfile(result.user.uid, { name, email });
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}
