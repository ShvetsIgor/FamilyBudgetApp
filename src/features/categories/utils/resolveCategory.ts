import type { Category } from '@/shared/types';
import { CATEGORY_ALIAS_MAP } from '../config/categoryLabels';

/**
 * Resolve a category from an alias or ID string.
 *
 * Resolution order:
 * 1. Direct ID lookup in categoriesById map (O(1)) — covers all new-architecture categories
 * 2. Flat alias fallback — handles legacy Firestore docs where the stored categoryId
 *    is a preset slug (e.g. 'groceries') but the user's actual category has a
 *    random Firestore-generated ID. CATEGORY_ALIAS_MAP maps slug → canonical name
 *    without any hierarchy traversal.
 *
 * Preset data is never imported or traversed here — all slug resolution goes through
 * the pre-built flat CATEGORY_ALIAS_MAP.
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

  // Legacy fallback: alias is a stable preset slug, but user's category has a random ID.
  // Match by canonical name from the flat alias map.
  const entry = CATEGORY_ALIAS_MAP.get(alias);
  if (entry) {
    for (const [, cat] of categoriesById) {
      if (cat.name === entry.name && !cat.archived) return cat;
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
