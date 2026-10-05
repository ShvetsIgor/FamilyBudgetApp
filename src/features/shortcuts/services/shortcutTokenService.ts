import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';

export interface ShortcutToken {
  id: string;
  label: string;
}

const tokens = (uid: string) => collection(getDb(), 'users', uid, 'shortcutTokens');
const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

export async function fetchShortcutTokens(uid: string): Promise<ShortcutToken[]> {
  const snapshot = await getDocs(tokens(uid));
  return snapshot.docs.map((item) => ({ id: item.id, label: item.data().label as string }));
}

/** The secret is returned once, after Firestore acknowledges the hash write. */
export async function createShortcutToken(uid: string, label: string) {
  const name = label.trim();
  if (!name || name.length > 80) throw new Error('Invalid token label');
  const secret = hex(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))));
  const ref = doc(tokens(uid));
  await setDoc(ref, { tokenHash, label: name, createdAt: serverTimestamp(), lastUsedAt: null });
  return { token: { id: ref.id, label: name }, secret };
}

export async function revokeShortcutToken(uid: string, tokenId: string): Promise<void> {
  await deleteDoc(doc(tokens(uid), tokenId));
}
