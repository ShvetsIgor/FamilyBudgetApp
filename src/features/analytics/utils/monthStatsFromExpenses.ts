import { toLocalMonthKey } from '@/shared/utils/dateKey';
import type { MonthStats } from '@/features/stats/services/statsService';
import type { SerializableExpense } from '@/shared/types';

type StatsExpense = Pick<
  SerializableExpense,
  'amount' | 'categoryId' | 'date' | 'splits' | 'tags' | 'isRecurring'
>;

/** An expense counts as recurring when a template generated it. */
export function isRecurringExpense(expense: Pick<StatsExpense, 'tags' | 'isRecurring'>): boolean {
  return expense.isRecurring === true || (expense.tags?.includes('recurring') ?? false);
}

/**
 * Rebuilds `MonthStats` from raw expenses so analytics can answer questions the
 * stored aggregates cannot — they carry no recurring flag. Splits count toward
 * their own categories with the remainder on the main one, matching how
 * `expensesService` writes the real aggregates.
 *
 * `totalIncome` stays 0: this is an expense-side view, and inventing an income
 * number here would quietly compare filtered spend against unfiltered earnings.
 */
export function monthStatsFromExpenses(expenses: StatsExpense[], months: string[]): MonthStats[] {
  const byMonth = new Map<string, MonthStats>(
    months.map((month) => [month, { month, totalExpenses: 0, totalIncome: 0, byCategory: {} }]),
  );

  for (const expense of expenses) {
    const bucket = byMonth.get(toLocalMonthKey(expense.date));
    if (!bucket) continue;

    bucket.totalExpenses += expense.amount;

    if (expense.splits?.length) {
      let splitSum = 0;
      for (const split of expense.splits) {
        bucket.byCategory[split.categoryId] = (bucket.byCategory[split.categoryId] ?? 0) + split.amount;
        splitSum += split.amount;
      }
      const remainder = expense.amount - splitSum;
      if (remainder > 0.009) {
        bucket.byCategory[expense.categoryId] = (bucket.byCategory[expense.categoryId] ?? 0) + remainder;
      }
      continue;
    }

    bucket.byCategory[expense.categoryId] = (bucket.byCategory[expense.categoryId] ?? 0) + expense.amount;
  }

  return months.map((month) => byMonth.get(month)!);
}
