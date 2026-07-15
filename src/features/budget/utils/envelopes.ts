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

type EnvelopeExpense = Pick<SerializableExpense, 'amount' | 'categoryId' | 'date' | 'splits'>;

/**
 * Per-category envelopes for one month: limits from budgets/{uid} vs actual
 * spend. Split rows count toward their own categories, the remainder toward
 * the main one. Limits that do not resolve to a known category (deleted
 * category, or a preset not re-activated after reset) are hidden here —
 * persistent cleanup of such entries lives in budgetService, this layer is
 * presentation only.
 */
export function buildEnvelopes(
  expenses: EnvelopeExpense[],
  limits: Record<string, number>,
  categories: Category[],
  monthKey: string,
): Envelope[] {
  const spent: Record<string, number> = {};
  for (const e of expenses) {
    if (toLocalMonthKey(e.date) !== monthKey) continue;
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
