'use client';
/**
 * LAYER: view-model hook — UI-ready category grouping.
 *
 * Ownership: this hook owns the UI view-model for folder-based category selection.
 * It bundles multiple Redux reads into a single, convenient API for form components
 * that need both folder groups and per-folder category lists.
 *
 * Derivation ownership:
 *   - selectors.ts owns raw state derivation (selectFolders, selectCategoriesInFolder, etc.)
 *   - this hook owns the CategoryGroup view-model type and the convenience
 *     getCatsInGroup(folderId) accessor that works with a locally-captured category list.
 *
 * getCatsInGroup is intentionally NOT a selector — callers need a plain function that
 * can be called dynamically per folder without triggering additional Redux subscriptions.
 */
import { useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import { isActiveCategory } from '@/features/categories/policy/categoryPolicy';
import type { Category, CategoryType } from '@/shared/types';

/** UI view-model for a folder shown in category pickers and forms. */
export interface CategoryGroup {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isFolder: true;
}

/** Folder-based two-level category grouping for UI components. */
export function useCategoryGroups(type: CategoryType) {
  const allCats = useAppSelector((s) =>
    type === 'expense' ? s.categories.expense : s.categories.income
  );
  const folders = useAppSelector((s) =>
    type === 'expense' ? s.categories.folders.expense : s.categories.folders.income
  );

  const groups = useMemo((): CategoryGroup[] =>
    folders.map((f) => ({ id: f.id, name: f.name, icon: f.icon, color: f.color, isFolder: true as const })),
    [folders],
  );

  /** Active categories in the given folder. */
  function getCatsInGroup(folderId: string): Category[] {
    return allCats.filter((c) =>
      (c.folderId === folderId || c.extraFolderIds?.includes(folderId)) && isActiveCategory(c)
    );
  }

  /** Returns the folder ID the category belongs to, or empty string if ungrouped. */
  function getGroupOf(cat: Category | undefined): string {
    return cat?.folderId ?? '';
  }

  return { groups, getCatsInGroup, getGroupOf };
}
