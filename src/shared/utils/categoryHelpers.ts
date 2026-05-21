import type { Category } from '@/shared/types';

/**
 * @deprecated Use `!c.archived` directly.
 * Kept only for legacy migration adapters that still need to exclude parentId-based
 * subcategories from Firestore docs written before the folder model migration.
 */
export function isRootCategory(c: Category): boolean {
  return !c.parentId && !c.archived;
}
