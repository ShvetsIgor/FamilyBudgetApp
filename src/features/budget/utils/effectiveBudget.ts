import type { BudgetSnapshot } from '@/features/ui/store/uiSlice';

/**
 * Budget settings effective for a given month ('yyyy-MM').
 * Exact snapshot wins; otherwise the nearest earlier snapshot (settings
 * persist forward until changed); otherwise the current global fields.
 * This is what keeps past months on the settings that were active then.
 */
export function getEffectiveBudget(
  byMonth: Record<string, BudgetSnapshot>,
  month: string,
  fallback: BudgetSnapshot,
): BudgetSnapshot {
  if (byMonth[month]) return byMonth[month];
  const earlier = Object.keys(byMonth).filter((k) => k < month).sort();
  const nearest = earlier[earlier.length - 1];
  return nearest ? byMonth[nearest] : fallback;
}
