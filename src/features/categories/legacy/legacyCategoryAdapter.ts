/**
 * Migration adapters for the legacy parentId-based category tree model.
 *
 * These helpers exist in ONE isolated place so that the rest of the runtime UI
 * never needs to know what a "parent category" is.
 *
 * Usage: call these only during data migration / Firestore read normalization.
 * Do NOT use in rendering, grouping, or business logic.
 */

import type { Category, CategoryFolder } from '@/shared/types';

/** True when the category was created under the legacy parentId tree model. */
export function isLegacySubcategory(c: Category): boolean {
  return !!c.parentId && !c.folderId;
}

/** True when the category was a "parent" in the legacy tree model and has not yet been
 *  converted to a folder. */
export function isLegacyParent(c: Category, allCats: Category[]): boolean {
  if (c.archived) return false;
  return allCats.some((child) => child.parentId === c.id);
}

/** Convert a legacy parent category into a CategoryFolder shape (does not write to Firestore). */
export function legacyCategoryToFolder(
  c: Category,
): Omit<CategoryFolder, 'id' | 'userId'> {
  return {
    name: c.name,
    icon: c.icon,
    color: c.color,
    type: c.type,
    order: c.order,
  };
}

/** Return categories that belong to a legacy parent (parentId-based children). */
export function getLegacyChildren(parentId: string, allCats: Category[]): Category[] {
  return allCats.filter((c) => c.parentId === parentId && !c.archived);
}
