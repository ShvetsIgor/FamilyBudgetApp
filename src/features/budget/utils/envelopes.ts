import type { SerializableExpense, Category } from '@/shared/types';
import { toLocalMonthKey } from '@/shared/utils/dateKey';

export interface Envelope {
  catId: string;
  limit: number;
  spent: number;
  name: string;
  icon: string;
  color: string;
}

type EnvelopeExpense = Pick<SerializableExpense, 'amount' | 'categoryId' | 'currency' | 'date' | 'splits'>;

/**
 * Spend per category. Split rows count toward their own categories, the
 * remainder toward the main one — `categoryId` alone would file a whole mixed
 * receipt under its first category. Pass one currency only: amounts in
 * different currencies do not add up.
 */
export function spentByCategory(expenses: Pick<SerializableExpense, 'amount' | 'categoryId' | 'splits'>[]): Record<string, number> {
  const spent: Record<string, number> = {};
  for (const e of expenses) {
    if (e.splits?.length) {
      let splitsSum = 0;
      for (const sp of e.splits) {
        spent[sp.categoryId] = (spent[sp.categoryId] ?? 0) + sp.amount;
        splitsSum += sp.amount;
      }
      const rem = e.amount - splitsSum;
      if (rem > 0.009) spent[e.categoryId] = (spent[e.categoryId] ?? 0) + rem;
    } else {
      spent[e.categoryId] = (spent[e.categoryId] ?? 0) + e.amount;
    }
  }
  return spent;
}

/**
 * Per-category envelopes for one month: limits from budgets/{uid} vs actual
 * spend. Limits are set in the account currency, so only that currency counts
 * against them. Limits that do not resolve to a known category (deleted
 * category, or a preset not re-activated after reset) are hidden here —
 * persistent cleanup of such entries lives in budgetService, this layer is
 * presentation only.
 */
export function buildEnvelopes(
  expenses: EnvelopeExpense[],
  limits: Record<string, number>,
  categories: Category[],
  monthKey: string,
  currency: SerializableExpense['currency'],
): Envelope[] {
  const spent = spentByCategory(
    expenses.filter((e) => e.currency === currency && toLocalMonthKey(e.date) === monthKey),
  );
  return Object.entries(limits)
    .filter(([, limit]) => limit > 0)
    .flatMap(([catId, limit]) => {
      const cat = categories.find((c) => c.id === catId);
      if (!cat) return [];
      return [{
        catId,
        limit,
        spent: spent[catId] ?? 0,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
      }];
    })
    .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
}
