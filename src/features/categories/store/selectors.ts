import type { RootState } from '@/store/store';
import type { CategoryType } from '@/shared/types';
import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';
import { isActiveCategory } from '../policy/categoryPolicy';

const cats = (s: RootState, type: CategoryType) =>
  type === 'expense' ? s.categories.expense : s.categories.income;

// ─── Folder-based selectors ──────────────────────────────────────────────────

export const selectFolders = (s: RootState, type: CategoryType) =>
  type === 'expense' ? s.categories.folders.expense : s.categories.folders.income;

export const selectCategoriesInFolder = (s: RootState, folderId: string, type: CategoryType) =>
  cats(s, type).filter((c) => c.folderId === folderId && isActiveCategory(c));

/** Active categories not assigned to any folder (excludes legacy parentId-based children) */
export const selectUnfolderedCategories = (s: RootState, type: CategoryType) =>
  cats(s, type).filter((c) => !c.folderId && !c.parentId && isActiveCategory(c));

/** All active categories regardless of folder assignment */
export const selectAllActiveCategories = (s: RootState, type: CategoryType) =>
  cats(s, type).filter(isActiveCategory);

// ─── Library / constructor ───────────────────────────────────────────────────

export const selectAvailableLibrary = (s: RootState, type: CategoryType) => {
  const tax = type === 'expense' ? TAXONOMY : [INCOME_TAXONOMY];
  const existingIds = new Set(cats(s, type).map((c) => c.id));
  return tax.filter((p) => !existingIds.has(p.id));
};

export const selectBudgetFor = (s: RootState, categoryId: string): number =>
  s.budget.limits[categoryId] ?? 0;
