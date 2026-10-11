import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, signOut } from 'firebase/auth';
import { getFirebaseAuth } from '@/shared/lib/firebase';
import { hasPasswordProvider } from '@/features/auth/services/authService';

export type DeleteAccountError =
  | 'wrong-password'
  | 'too-many-requests'
  | 'reauth-cancelled'
  | 'family_owner'
  | 'reauth_required'
  | 'unavailable';

/**
 * Deleting needs proof of identity right now, not a session left open on a
 * shared device: the server accepts only a sign-in from the last 5 minutes.
 * Password accounts re-enter the password; Google-only ones confirm in the
 * Google popup.
 */
async function reauthenticate(password: string): Promise<DeleteAccountError | null> {
  const user = getFirebaseAuth().currentUser;
  if (!user) return 'reauth_required';
  try {
    if (hasPasswordProvider() && user.email) {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
    } else {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }
    return null;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/too-many-requests') return 'too-many-requests';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/popup-blocked') {
      return 'reauth-cancelled';
    }
    if (code === 'auth/user-mismatch') return 'reauth-cancelled';
    return hasPasswordProvider() ? 'wrong-password' : 'unavailable';
  }
}

/** Removes this account's per-device leftovers: every key carries the uid. */
export function clearLocalAccountData(uid: string, storage: Pick<Storage, 'length' | 'key' | 'removeItem'> = localStorage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.includes(uid)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export async function deleteMyAccount(password: string): Promise<{ ok: true } | { ok: false; reason: DeleteAccountError }> {
  const reauthError = await reauthenticate(password);
  if (reauthError) return { ok: false, reason: reauthError };
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) return { ok: false, reason: 'reauth_required' };
  try {
    const token = await user.getIdToken(true);
    const response = await fetch('/api/account/delete', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      if (body.error === 'family_owner' || body.error === 'reauth_required') return { ok: false, reason: body.error };
      return { ok: false, reason: 'unavailable' };
    }
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  try { clearLocalAccountData(user.uid); } catch { /* storage blocked: nothing to clear */ }
  // The Auth user is gone already; signing out clears the local session
  await signOut(auth).catch(() => {});
  return { ok: true };
}
