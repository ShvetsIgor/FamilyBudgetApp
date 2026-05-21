'use client';
import { useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import { isActiveCategory } from '@/features/categories/policy/categoryPolicy';
import type { Category, CategoryType } from '@/shared/types';

export interface CategoryGroup {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isFolder: true;
}

/** Folder-based two-level category grouping. Folders are the only grouping model. */
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

  function getCatsInGroup(folderId: string): Category[] {
    return allCats.filter((c) => c.folderId === folderId && isActiveCategory(c));
  }

  function getGroupOf(cat: Category | undefined): string {
    return cat?.folderId ?? '';
  }

  /** Categories not assigned to any folder */
  const ungroupedCats = useMemo(
    () => allCats.filter((c) => !c.folderId && !c.archived),
    [allCats],
  );

  return { groups, getCatsInGroup, getGroupOf, ungroupedCats, allCats, folders };
}
