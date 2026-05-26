import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { StoreProfile } from '@/shared/types';
import { toLocalDateKey } from '@/shared/utils/dateKey';

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
  categoryId: string,
  storeGroup?: string,
): Promise<void> {
  const ref = doc(getDb(), 'storeProfiles', userId, 'profiles', storeId);
  const snap = await getDoc(ref);
  const now = toLocalDateKey(new Date());

  if (!snap.exists()) {
    const profile: StoreProfile = {
      id: storeId,
      name: storeName,
      ...(storeGroup ? { storeGroup } : {}),
      probableCategories: [{ categoryId, usageCount: 1, lastUsed: now }],
    };
    await setDoc(ref, profile);
    return;
  }

  const existing = snap.data() as StoreProfile;
  const cats = [...(existing.probableCategories ?? [])];
  const idx = cats.findIndex((c) => c.categoryId === categoryId);

  if (idx >= 0) {
    cats[idx] = { ...cats[idx], usageCount: cats[idx].usageCount + 1, lastUsed: now };
  } else {
    cats.push({ categoryId, usageCount: 1, lastUsed: now });
  }

  await setDoc(ref, { ...existing, probableCategories: cats }, { merge: true });
}
