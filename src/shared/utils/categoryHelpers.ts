import type { Category } from '@/shared/types';

/**
 * True if this is a first-class domain category — not a legacy subcategory.
 * Does NOT check folderId: folder is a UI-only concept, irrelevant to domain logic.
 * The parentId check exists only to filter legacy Firestore docs during migration.
 */
export function isRootCategory(c: Category): boolean {
  return !c.parentId && !c.archived;
}
