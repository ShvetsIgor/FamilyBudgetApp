import type { Category, Privacy } from '@/shared/types';

/**
 * Single domain rule for №9: an expense whose category (or any split
 * category) is marked private must be owner-only (`privacy: 'secret'`), so
 * the "hidden from family" promise is real — not just a hidden category
 * name in the UI. Every expense-write entry point resolves privacy through
 * this helper, and a migration backfills pre-existing expenses.
 */

export function isCategoryPrivate(cat?: Pick<Category, 'isPrivate'>): boolean {
  return cat?.isPrivate === true;
}

/**
 * Resolves the privacy an expense must carry.
 * - A private main/split category forces 'secret'.
 * - An already-secret expense is never silently downgraded on edit (№8).
 * - Otherwise 'regular'.
 */
export function resolveExpensePrivacy(params: {
  categories: Category[];
  categoryId: string;
  splitCategoryIds?: string[];
  previousPrivacy?: Privacy;
}): Privacy {
  const byId = new Map(params.categories.map((c) => [c.id, c]));
  const ids = [params.categoryId, ...(params.splitCategoryIds ?? [])];
  const anyPrivate = ids.some((id) => isCategoryPrivate(byId.get(id)));
  if (anyPrivate || params.previousPrivacy === 'secret') return 'secret';
  return 'regular';
}
