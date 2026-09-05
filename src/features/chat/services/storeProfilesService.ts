/**
 * Store profiles were the chat's first merchant memory. Nothing reads or
 * writes them any more — `suggestionMemory` took the role over — so all that
 * remains is the ability to wipe documents left behind on older accounts.
 */
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';

export async function clearStoreProfiles(userId: string): Promise<void> {
  const col = collection(getDb(), 'storeProfiles', userId, 'profiles');
  const snap = await getDocs(col);
  await Promise.all(snap.docs.map((profile) => deleteDoc(profile.ref)));
}
