import type { RootState } from '@/store/store';
import type { CategoryType } from '@/shared/types';
import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';

const cats = (s: RootState, type: CategoryType) =>
  type === 'expense' ? s.categories.expense : s.categories.income;

// ─── Legacy selectors (parentId-based) — kept during migration ───────────────

export const selectActiveParents = (s: RootState, type: CategoryType) =>
  cats(s, type).filter((c) => !c.parentId && !c.archived);

export const selectSubsOf = (s: RootState, parentId: string, type: CategoryType) =>
  cats(s, type).filter((c) => c.parentId === parentId && !c.archived);

// ─── Folder-based selectors ──────────────────────────────────────────────────

export const selectFolders = (s: RootState, type: CategoryType) =>
  type === 'expense' ? s.categories.folders.expense : s.categories.folders.income;

export const selectCategoriesInFolder = (s: RootState, folderId: string, type: CategoryType) =>
  cats(s, type).filter((c) => c.folderId === folderId && !c.archived);

/** All active (non-archived) categories that don't belong to any folder */
export const selectUnfolderedCategories = (s: RootState, type: CategoryType) =>
  cats(s, type).filter((c) => !c.folderId && !c.parentId && !c.archived);

/** All active categories (non-archived), regardless of folder */
export const selectAllActiveCategories = (s: RootState, type: CategoryType) =>
  cats(s, type).filter((c) => !c.archived);

// ─── Library / constructor ───────────────────────────────────────────────────

export const selectAvailableLibrary = (s: RootState, type: CategoryType) => {
  const tax = type === 'expense' ? TAXONOMY : [INCOME_TAXONOMY];
  const existingIds = new Set(cats(s, type).map((c) => c.id));
  return tax.filter((p) => !existingIds.has(p.id));
};

export const selectBudgetFor = (s: RootState, categoryId: string): number =>
  s.budget.limits[categoryId] ?? 0;
