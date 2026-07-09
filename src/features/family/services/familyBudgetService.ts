import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { fetchSharedMonthExpenses } from '@/features/expenses/services/expensesService';
import type { Category, SerializableExpense, UserProfile } from '@/shared/types';

export interface FamilyExpense extends SerializableExpense {
  memberId: string;
  memberName: string;
}

export interface FamilyCategoryMeta {
  name: string;
  icon: string;
  color: string;
}

export interface FamilyMonthData {
  expenses: FamilyExpense[];
  categoryMeta: Record<string, FamilyCategoryMeta>;
}

/**
 * Aggregates the month's shared (non-secret) expenses of every family
 * member. Own categories come from Redux; other members' category names
 * are resolved with per-doc reads — security rules deny private ones,
 * which then simply fall back to a generic label in the UI.
 */
export async function fetchFamilyMonthExpenses(
  members: UserProfile[],
  month: string,
  selfId: string,
  selfCategories: Category[],
): Promise<FamilyMonthData> {
  const perMember = await Promise.all(
    members.map(async (m) => {
      try {
        const list = await fetchSharedMonthExpenses(m.id, month);
        return list.map((e) => ({ ...e, memberId: m.id, memberName: m.name }));
      } catch {
        // Member detached or rules denied — skip instead of failing the view
        return [] as FamilyExpense[];
      }
    }),
  );
  const expenses = perMember.flat().sort((a, b) => b.date.localeCompare(a.date));

  const categoryMeta: Record<string, FamilyCategoryMeta> = {};
  for (const c of selfCategories) {
    categoryMeta[c.id] = { name: c.name, icon: c.icon, color: c.color };
  }

  const foreign = new Map<string, string>();
  for (const e of expenses) {
    if (e.memberId !== selfId && !categoryMeta[e.categoryId]) foreign.set(e.categoryId, e.memberId);
  }
  await Promise.all([...foreign.entries()].map(async ([catId, memberId]) => {
    try {
      const snap = await getDoc(doc(getDb(), 'categories', memberId, 'expense', catId));
      if (snap.exists()) {
        const d = snap.data();
        categoryMeta[catId] = { name: d.name, icon: d.icon, color: d.color };
      }
    } catch { /* private category — keep hidden */ }
  }));

  return { expenses, categoryMeta };
}
