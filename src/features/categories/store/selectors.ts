import type { RootState } from '@/store/store';
import type { CategoryType } from '@/shared/types';
import { isActiveCategory } from '../policy/categoryPolicy';
import { buildFolderSections, type FolderSection } from '../utils/categoryViewModels';

const cats = (s: RootState, type: CategoryType) =>
  type === 'expense' ? s.categories.expense : s.categories.income;

const folders = (s: RootState, type: CategoryType) =>
  type === 'expense' ? s.categories.folders.expense : s.categories.folders.income;

// ─── Folder-based selectors ──────────────────────────────────────────────────

export const selectFolders = (s: RootState, type: CategoryType) => folders(s, type);

export const selectCategoriesInFolder = (s: RootState, folderId: string, type: CategoryType) =>
  cats(s, type).filter((c) => c.folderId === folderId && isActiveCategory(c));

/** Active categories not assigned to any folder */
export const selectUnfolderedCategories = (s: RootState, type: CategoryType) =>
  cats(s, type).filter((c) => !c.folderId && isActiveCategory(c));

/** All active categories regardless of folder assignment */
export const selectAllActiveCategories = (s: RootState, type: CategoryType) =>
  cats(s, type).filter(isActiveCategory);

/** Active categories grouped into folder sections for UI rendering. */
export const selectFolderSections = (s: RootState, type: CategoryType): FolderSection[] =>
  buildFolderSections(folders(s, type), cats(s, type).filter(isActiveCategory));

// ─── Library / constructor ───────────────────────────────────────────────────

/**
 * Returns folder blueprints not yet activated by the user.
 * Checks both folder IDs (new architecture) and category IDs (backward compat —
 * old users had parent categories instead of folders).
 * Driven entirely by store state — no direct TAXONOMY access.
 */
export const selectAvailableLibrary = (s: RootState, type: CategoryType) => {
  const activeFolderIds = new Set(folders(s, type).map((f) => f.id));
  const activeCategoryIds = new Set(cats(s, type).map((c) => c.id));

  return LIBRARY_FOLDERS.filter(
    (f) =>
      (type === 'expense' ? f.id !== 'income' : f.id === 'income') &&
      !activeFolderIds.has(f.id) &&
      !activeCategoryIds.has(f.id),
  );
};

export const selectBudgetFor = (s: RootState, categoryId: string): number =>
  s.budget.limits[categoryId] ?? 0;
