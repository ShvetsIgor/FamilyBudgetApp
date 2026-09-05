/**
 * Canonical archived-category policy.
 *
 * Invariants:
 * - Active category   → available for new entries; shown in pickers, suggestions, analytics
 * - Archived category → hidden from pickers and suggestions; still resolvable by ID for
 *   historical display (old transactions retain their category reference)
 * - Resolution        → always succeeds by ID regardless of archived status; the caller
 *   decides whether to display the name or suppress the entry
 *
 * All "is this category selectable?" checks must go through isActiveCategory().
 * Direct `!c.archived` inline is acceptable in one-liner filter chains but use
 * isActiveCategory in selector and hook layer for semantic clarity.
 */

import type { Category } from '@/shared/types';

/** True when the category is available for new expense/income entries. */
export function isActiveCategory(c: Category): boolean {
  return !c.archived;
}
