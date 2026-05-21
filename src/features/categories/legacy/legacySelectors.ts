/**
 * Legacy parentId-based selectors.
 * Use only in migration scripts or adapter code — not in UI or domain logic.
 */
import type { RootState } from '@/store/store';
import type { CategoryType } from '@/shared/types';
const cats = (s: RootState, type: CategoryType) =>
  type === 'expense' ? s.categories.expense : s.categories.income;

/** @deprecated Use active categories filtered by folderId instead. */
export const selectActiveParents = (s: RootState, type: CategoryType) =>
  cats(s, type).filter((c) => !c.parentId && !c.archived);

/** @deprecated Use selectCategoriesInFolder for new data. */
export const selectSubsOf = (s: RootState, parentId: string, type: CategoryType) =>
  cats(s, type).filter((c) => c.parentId === parentId && !c.archived);
