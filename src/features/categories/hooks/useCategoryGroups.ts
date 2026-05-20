'use client';
import { useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import { isRootCategory } from '@/shared/utils/categoryHelpers';
import type { Category, CategoryType } from '@/shared/types';

export interface CategoryGroup {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isFolder: boolean;
}

/**
 * Abstracts the "folder vs legacy parentId" two-level picker.
 * When folders exist: groups = folders, getCatsInGroup uses folderId.
 * When no folders: groups = legacy root categories that have children, getCatsInGroup uses parentId.
 */
export function useCategoryGroups(type: CategoryType) {
  const allCats = useAppSelector((s) =>
    type === 'expense' ? s.categories.expense : s.categories.income
  );
  const folders = useAppSelector((s) =>
    type === 'expense' ? s.categories.folders.expense : s.categories.folders.income
  );

  const hasFolders = folders.length > 0;

  const groups = useMemo((): CategoryGroup[] => {
    if (hasFolders) {
      return folders.map((f) => ({ id: f.id, name: f.name, icon: f.icon, color: f.color, isFolder: true }));
    }
    // Legacy: root categories that have children act as groups
    const childParentIds = new Set(allCats.filter((c) => c.parentId).map((c) => c.parentId!));
    return allCats
      .filter((c) => isRootCategory(c) && childParentIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, isFolder: false }));
  }, [allCats, folders, hasFolders]);

  function getCatsInGroup(groupId: string): Category[] {
    if (hasFolders) {
      return allCats.filter((c) => c.folderId === groupId && !c.archived);
    }
    return allCats.filter((c) => c.parentId === groupId && !c.archived);
  }

  /** Given a category, return the ID of the group it belongs to (folder or legacy parent). */
  function getGroupOf(cat: Category | undefined): string {
    if (!cat) return '';
    if (hasFolders) return cat.folderId ?? '';
    return cat.parentId ?? '';
  }

  /** Standalone root categories not in any folder (shown directly, not inside a group) */
  const standaloneCats = useMemo(
    () => allCats.filter((c) => isRootCategory(c) && !c.folderId),
    [allCats]
  );

  return { groups, getCatsInGroup, getGroupOf, standaloneCats, allCats, hasFolders, folders };
}
