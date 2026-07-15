import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { remapLimits } from '../utils/limits';

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

/** Drops a single category's limit (e.g. when the category is hard-deleted). */
export async function removeBudgetLimit(userId: string, categoryId: string): Promise<void> {
  await saveBudget(userId, categoryId, 0);
}

/**
 * Rewrites the whole limits doc through remapLimits: remaps ids after a
 * category reset and prunes entries that can no longer resolve (deleted
 * custom categories, folder-keyed legacy limits from the old constructor).
 * Returns the new map so callers can sync Redux.
 */
export async function remapBudgetLimits(
  userId: string,
  idMap: Record<string, string>,
  keepIds: ReadonlySet<string>,
): Promise<Record<string, number>> {
  const current = await fetchBudgets(userId);
  const next = remapLimits(current, idMap, keepIds);
  const changed =
    Object.keys(current).length !== Object.keys(next).length ||
    Object.entries(next).some(([catId, limit]) => current[catId] !== limit);
  if (changed) await setDoc(ref(userId), { limits: next });
  return next;
}
