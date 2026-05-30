import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { clearStoreProfiles } from '@/features/chat/services/storeProfilesService';
import { clearLearnedKeywords } from '@/features/chat/parser/learning';

const SUGGESTION_MEMORY_KEY = 'suggestionMemory_v2';

const SUBCOLLECTIONS: Array<[string, string]> = [
  ['expenses', 'items'],
  ['incomes', 'items'],
  ['savingsGoals', 'goals'],
  ['recurringPayments', 'items'],
  ['messages', 'items'],
  ['monthlyStats', 'months'],
];

async function wipeSubcollection(userId: string, top: string, sub: string): Promise<void> {
  const snap = await getDocs(collection(getDb(), top, userId, sub));
  if (snap.empty) return;

  // Firestore batch hard cap is 500 ops
  let batch = writeBatch(getDb());
  let n = 0;
  for (const docSnap of snap.docs) {
    batch.delete(docSnap.ref);
    n++;
    if (n === 450) {
      await batch.commit();
      batch = writeBatch(getDb());
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}

/**
 * Wipe everything except categories/folders/profile/settings.
 * Used for debug "fresh start while keeping category structure".
 *
 * Deletes:
 *  - all expenses, income, savings goals, recurring payments, messages
 *  - monthlyStats (derived; would be rebuilt naturally on new writes)
 *  - storeProfiles + learnedKeywords (merchant memory)
 *  - localStorage suggestionMemory_v2 (shared deterministic memory)
 *
 * Keeps:
 *  - users/{userId} profile doc (name, currency, language, theme, weekStart, familyId)
 *  - categories/{userId} + categoryFolders/{userId}
 *  - family/{familyId} (if the user is a member)
 *  - budgets (per-category limits)
 */
export async function resetUserDataExceptCategories(userId: string): Promise<void> {
  await Promise.all(SUBCOLLECTIONS.map(([top, sub]) => wipeSubcollection(userId, top, sub)));
  await Promise.all([
    clearStoreProfiles(userId),
    clearLearnedKeywords(userId),
  ]);

  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(SUGGESTION_MEMORY_KEY); } catch { /* ignore */ }
  }
}

// Re-export for symmetry; not currently used but the contract is "delete one user thing"
export { deleteDoc };
