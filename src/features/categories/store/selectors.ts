/**
 * LAYER: selectors — single source of UI-oriented state derivation.
 *
 * Architecture invariants enforced here:
 *   - Categories: semantic expense classification targets only.
 *   - Folders:    UI grouping only; never drive analytics or domain logic.
 *   - isActiveCategory: the canonical policy gate for all active-category reads.
 *   - buildFolderSections: the single derivation path for folder-grouped UI state.
 *
 * All components must read category/folder state through these selectors,
 * not by accessing Redux slices directly.
 */
import type { RootState } from '@/store/store';
import type { CategoryType } from '@/shared/types';
import { isActiveCategory } from '../policy/categoryPolicy';
import { buildFolderSections, type FolderSection } from '../utils/folderSections';

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

export const selectBudgetFor = (s: RootState, categoryId: string): number =>
  s.budget.limits[categoryId] ?? 0;
