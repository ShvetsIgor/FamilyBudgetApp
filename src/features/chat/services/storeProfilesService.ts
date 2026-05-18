import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { StoreProfile } from '@/shared/types';

export async function fetchStoreProfiles(userId: string): Promise<Record<string, StoreProfile>> {
  const col = collection(getDb(), 'storeProfiles', userId, 'profiles');
  const snap = await getDocs(col);
  const result: Record<string, StoreProfile> = {};
  snap.docs.forEach((d) => { result[d.id] = d.data() as StoreProfile; });
  return result;
}

export async function updateStoreProfile(
  userId: string,
  storeId: string,
  storeName: string,
  subcategoryId: string,
  parentId: string,
  storeGroup?: string,
): Promise<void> {
  const ref = doc(getDb(), 'storeProfiles', userId, 'profiles', storeId);
  const snap = await getDoc(ref);
  const now = new Date().toISOString().slice(0, 10);

  if (!snap.exists()) {
    const profile: StoreProfile = {
      id: storeId,
      name: storeName,
      ...(storeGroup ? { storeGroup } : {}),
      probableSubcategories: [{ subcategoryId, parentId, usageCount: 1, lastUsed: now }],
    };
    await setDoc(ref, profile);
    return;
  }

  const existing = snap.data() as StoreProfile;
  const subs = [...existing.probableSubcategories];
  const idx = subs.findIndex((s) => s.subcategoryId === subcategoryId);

  if (idx >= 0) {
    subs[idx] = { ...subs[idx], usageCount: subs[idx].usageCount + 1, lastUsed: now };
  } else {
    subs.push({ subcategoryId, parentId, usageCount: 1, lastUsed: now });
  }

  await setDoc(ref, { ...existing, probableSubcategories: subs }, { merge: true });
}
