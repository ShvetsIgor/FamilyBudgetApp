import type { Category } from '@/shared/types';

export interface TopCategory {
  catId: string;
  name: string;
  color: string;
  icon: string;
  total: number;
}

/**
 * Aggregates per-category spend totals across monthly stats, returns top-N sorted by total.
 * Aggregates by categoryId only — folders are UI-only and must not affect domain analytics.
 */
export function aggregateTopCategories(
  months: { byCategory: Record<string, number> }[],
  allCats: Category[],
  limit: number,
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
