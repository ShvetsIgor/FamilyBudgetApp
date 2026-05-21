import type { Category } from '@/shared/types';
import { TAXONOMY, INCOME_TAXONOMY } from '@/features/categories/icons/icons';

/**
 * Resolve a category from an alias or ID string.
 *
 * Resolution order:
 * 1. Direct ID lookup in categoriesById map (O(1))
 * 2. Taxonomy name match — handles legacy random Firestore IDs that map to
 *    a known taxonomy entry by name rather than by stable slug ID
 * 3. Sub-taxonomy name match
 *
 * Returns undefined if no active category matches.
 */
export function resolveCategoryByAlias(
  alias: string | null,
  categoriesById: Map<string, Category>,
): Category | undefined {
  if (!alias) return undefined;

  const direct = categoriesById.get(alias);
  if (direct) return direct;

  for (const parent of [...TAXONOMY, INCOME_TAXONOMY as typeof TAXONOMY[0]]) {
    if (parent.id === alias) {
      for (const [, cat] of categoriesById) {
        if (cat.name === parent.name && !cat.archived) return cat;
      }
    }
    for (const sub of parent.subs ?? []) {
      if (sub.id === alias) {
        for (const [, cat] of categoriesById) {
          if (cat.name === sub.name) return cat;
        }
      }
    }
  }

  return undefined;
}

/** Look up a category by its exact Firestore ID. Always resolvable — even if archived. */
export function getCategoryById(
  id: string | undefined | null,
  categoriesById: Map<string, Category>,
): Category | undefined {
  if (!id) return undefined;
  return categoriesById.get(id);
}
