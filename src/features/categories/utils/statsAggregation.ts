import type { Category } from '@/shared/types';

export interface TopCategory {
  catId: string;
  name: string;
  color: string;
  icon: string;
  total: number;
}

/**
 * Aggregates per-category spend totals across monthly stats, sorted by total.
 * Aggregates by categoryId only — folders are UI-only and must not affect domain analytics.
 * Without a limit every category comes back: a list claiming to break down a
 * total must add up to it. Pass a limit only for something labelled «top».
 */
export function aggregateTopCategories(
  months: { byCategory: Record<string, number> }[],
  allCats: Category[],
  limit = Infinity,
): TopCategory[] {
  const totals = new Map<string, number>();
  for (const m of months) {
    for (const [catId, amount] of Object.entries(m.byCategory)) {
      totals.set(catId, (totals.get(catId) ?? 0) + amount);
    }
  }
  return Array.from(totals.entries())
    .filter(([, amt]) => amt > 0)
    .map(([catId, total]) => {
      const cat = allCats.find((c) => c.id === catId);
      return {
        catId,
        name: cat?.name ?? 'Other',
        color: cat?.color ?? '#6b7280',
        icon: cat?.icon ?? 'box',
        total,
      };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

/**
 * A donut stops being readable past a handful of slices, so the smallest ones
 * merge into one — the chart still covers the whole total. `rows` come sorted
 * from `aggregateTopCategories`; a single leftover keeps its own slice.
 */
export function pieSlices<T extends { amount: number }>(rows: T[], maxSlices: number, rest: (amount: number) => T): T[] {
  if (rows.length <= maxSlices) return rows;
  const kept = rows.slice(0, maxSlices - 1);
  return [...kept, rest(rows.slice(maxSlices - 1).reduce((sum, row) => sum + row.amount, 0))];
}
