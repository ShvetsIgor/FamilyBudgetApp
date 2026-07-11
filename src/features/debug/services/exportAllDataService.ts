import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { suggestionMemoryStorageKey } from '@/features/expenses/store/suggestionMemorySlice';

/**
 * Recursively converts Firestore Timestamps to ISO strings.
 *
 * This must run BEFORE JSON.stringify: Timestamp has its own toJSON()
 * (returning {seconds, nanoseconds}), and JSON.stringify calls toJSON before
 * the replacer ever sees the value — a replacer-based conversion silently
 * never fires.
 */
export function normalizeForExport(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeForExport);
  if (value !== null && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalizeForExport(v)]),
    );
  }
  return value;
}

/**
 * Full account backup as pretty-printed JSON: every user-owned collection,
 * the profile and budgets docs, chat history, learned parser keywords, the
 * derived monthlyStats (restorable from expenses/incomes — kept for
 * reference), and the device-local suggestion memory.
 *
 * Never includes Firebase config or auth tokens.
 */
export async function exportAllDataJson(userId: string): Promise<string> {
  const subcols: Array<[top: string, sub: string, key: string]> = [
    ['expenses', 'items', 'expenses'],
    ['incomes', 'items', 'incomes'],
    ['savingsGoals', 'goals', 'savingsGoals'],
    ['recurringPayments', 'items', 'recurringPayments'],
    ['recurringIncome', 'items', 'recurringIncome'],
    ['categories', 'expense', 'expenseCategories'],
    ['categories', 'income', 'incomeCategories'],
    ['categoryFolders', 'expense', 'expenseFolders'],
    ['categoryFolders', 'income', 'incomeFolders'],
    ['storeProfiles', 'profiles', 'storeProfiles'],
    ['messages', 'items', 'messages'],
    // Derived from expenses/incomes; exported for reference, safe to rebuild.
    ['monthlyStats', 'months', 'monthlyStats'],
  ];

  const result: Record<string, unknown> = {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    userId,
    derivedCollections: ['monthlyStats'],
  };

  await Promise.all(subcols.map(async ([top, sub, key]) => {
    const snap = await getDocs(collection(getDb(), top, userId, sub));
    result[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));

  // Parser keywords live under the user doc, not a top-level collection.
  const learnedSnap = await getDocs(collection(getDb(), 'users', userId, 'learnedKeywords'));
  result.learnedKeywords = learnedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const [profile, budgets] = await Promise.all([
    getDoc(doc(getDb(), 'users', userId)),
    getDoc(doc(getDb(), 'budgets', userId)),
  ]);
  result.profile = profile.exists() ? profile.data() : null;
  result.budgets = budgets.exists() ? budgets.data() : null;

  // Device-local ranking memory (merchants, recents, split combos) is not in
  // Firestore at all — include it as its own section.
  try {
    const localMemory = typeof window !== 'undefined'
      ? localStorage.getItem(suggestionMemoryStorageKey(userId))
      : null;
    result.localSuggestionMemory = localMemory ? JSON.parse(localMemory) : null;
  } catch {
    result.localSuggestionMemory = null;
  }

  return JSON.stringify(normalizeForExport(result), null, 2);
}
