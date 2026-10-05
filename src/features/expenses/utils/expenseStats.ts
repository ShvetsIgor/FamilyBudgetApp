import type { Currency, SplitItem } from '@/shared/types';

export interface StatsDelta {
  /** Currency of the expense this delta came from — totals are kept per currency. */
  currency: Currency;
  totalExpenses: number;
  byCategory: Record<string, number>;
}

export function buildStatsDelta(
  categoryId: string,
  amount: number,
  splits: SplitItem[],
  sign: 1 | -1,
  currency: Currency,
): StatsDelta {
  const splitTotal = splits.reduce((sum, split) => sum + split.amount, 0);
  const mainAmount = amount - splitTotal;
  const byCategory: Record<string, number> = {
    [categoryId]: sign * mainAmount,
  };

  for (const split of splits) {
    if (split.categoryId && split.amount > 0) {
      byCategory[split.categoryId] = (byCategory[split.categoryId] ?? 0) + sign * split.amount;
    }
  }

  return {
    currency,
    totalExpenses: sign * amount,
    byCategory,
  };
}

/**
 * Which halves of the month aggregate a delta touches.
 *
 * `byCategoryByCurrency` moves with the category map, NOT with the total.
 * Gating it on the total meant an edit that changed only the category — same
 * amount, same month, same currency — updated `byCategory` and left
 * `byCategoryByCurrency` behind, so the two disagreed for that month forever
 * after. Nobody noticed while the document was write-only.
 */
export function statsPatchShape(delta: StatsDelta): {
  writesTotals: boolean;
  writesCategories: boolean;
} {
  const movedCategories = Object.values(delta.byCategory).some((value) => value !== 0);
  return {
    writesTotals: delta.totalExpenses !== 0,
    writesCategories: movedCategories,
  };
}

/** SDK-neutral patch; client and Admin supply their own atomic transforms. */
export function buildMonthlyStatsPatch<T, S>(
  userId: string, month: string, delta: StatsDelta,
  increment: (value: number) => T, updatedAt: S,
) {
  const shape = statsPatchShape(delta);
  if (!shape.writesTotals && !shape.writesCategories) return null;
  const byCategory = Object.fromEntries(Object.entries(delta.byCategory)
    .filter(([, value]) => value !== 0)
    .map(([categoryId, value]) => [categoryId, increment(value)]));
  return {
    userId, month,
    // Keep the legacy fields for compatibility; displayed totals use currency maps.
    ...(shape.writesTotals ? {
      totalExpenses: increment(delta.totalExpenses),
      totalsByCurrency: { [delta.currency]: increment(delta.totalExpenses) },
    } : {}),
    ...(shape.writesCategories ? { byCategory, byCategoryByCurrency: { [delta.currency]: byCategory } } : {}),
    updatedAt,
  };
}
