import { collection, doc, getDoc, getDocs, Timestamp } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';

/**
 * Full account backup as pretty-printed JSON: every user-owned collection
 * plus the profile and budgets docs. Timestamps serialize to ISO strings.
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
  ];

  const result: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    userId,
  };

  await Promise.all(subcols.map(async ([top, sub, key]) => {
    const snap = await getDocs(collection(getDb(), top, userId, sub));
    result[key] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }));

  const [profile, budgets] = await Promise.all([
    getDoc(doc(getDb(), 'users', userId)),
    getDoc(doc(getDb(), 'budgets', userId)),
  ]);
  result.profile = profile.exists() ? profile.data() : null;
  result.budgets = budgets.exists() ? budgets.data() : null;

  return JSON.stringify(
    result,
    (_key, value) => (value instanceof Timestamp ? value.toDate().toISOString() : value),
    2,
  );
}
