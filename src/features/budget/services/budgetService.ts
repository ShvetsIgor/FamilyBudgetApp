import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';

function ref(userId: string) {
  return doc(getDb(), 'budgets', userId);
}

export async function fetchBudgets(userId: string): Promise<Record<string, number>> {
  const snap = await getDoc(ref(userId));
  if (!snap.exists()) return {};
  return (snap.data().limits as Record<string, number>) ?? {};
}

export async function saveBudget(userId: string, categoryId: string, limit: number): Promise<void> {
  const snap = await getDoc(ref(userId));
  const current = snap.exists() ? ((snap.data().limits as Record<string, number>) ?? {}) : {};
  const updated = { ...current };
  if (limit <= 0) {
    delete updated[categoryId];
  } else {
    updated[categoryId] = limit;
  }
  await setDoc(ref(userId), { limits: updated });
}
