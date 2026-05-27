import { getPresetDisplayName } from '@/features/categories/config/categoryLabels';
import { getStoreGroupFolderId } from '@/features/categories/utils/storeGroupFolders';
import type { Category, CategoryFolder, SerializableExpense } from '@/shared/types';

export interface ExpenseListMeta {
  key: string;
  labelSource: string;
  icon: string;
  color: string;
  kind: 'category' | 'storeGroup';
}

function titleCaseStoreGroup(storeGroup: string): string {
  return storeGroup
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getStoreGroupFolder(
  storeGroup: string | undefined,
  folders: CategoryFolder[],
): CategoryFolder | undefined {
  const folderId = getStoreGroupFolderId(storeGroup);
  return folderId ? folders.find((folder) => folder.id === folderId) : undefined;
}

function getStoreGroupLabelSource(
  storeGroup: string | undefined,
  folders: CategoryFolder[],
  language = 'en',
): string | undefined {
  if (!storeGroup) return undefined;

  const folder = getStoreGroupFolder(storeGroup, folders);
  if (folder) return folder.name;

  const folderId = getStoreGroupFolderId(storeGroup);
  if (folderId) {
    const presetLabel = getPresetDisplayName(folderId, language);
    if (presetLabel) return presetLabel;
  }

  return titleCaseStoreGroup(storeGroup);
}

export function hasMeaningfulSplit(
  expense: Pick<SerializableExpense, 'amount' | 'splits'>,
): boolean {
  const splitSum = expense.splits.reduce((sum, split) => sum + split.amount, 0);
  const mainPortion = expense.amount - splitSum;
  const positiveSplitCount = expense.splits.filter((split) => split.amount > 0).length;
  return positiveSplitCount + (mainPortion > 0.01 ? 1 : 0) > 1;
}

export function getExpenseListMeta(
  expense: SerializableExpense,
  categories: Category[],
  folders: CategoryFolder[],
  language = 'en',
): ExpenseListMeta | null {
  const category = categories.find((entry) => entry.id === expense.categoryId);
  const folder =
    category?.folderId != null
      ? folders.find((entry) => entry.id === category.folderId)
      : undefined;

  if (hasMeaningfulSplit(expense) && expense.storeGroup) {
    const groupFolder = getStoreGroupFolder(expense.storeGroup, folders);
    const groupLabel = getStoreGroupLabelSource(expense.storeGroup, folders, language);
    if (groupLabel) {
      return {
        key: `store-group:${expense.storeGroup}`,
        labelSource: groupLabel,
        icon: groupFolder?.icon ?? folder?.icon ?? 'box',
        color: groupFolder?.color ?? folder?.color ?? category?.color ?? '#94A3B8',
        kind: 'storeGroup',
      };
    }
  }

  if (category) {
    return {
      key: `category:${category.id}`,
      labelSource: category.name,
      icon: category.icon,
      color: category.color,
      kind: 'category',
    };
  }

  return null;
}

export function matchesExpenseListFilter(
  expense: SerializableExpense,
  filterKey: string,
): boolean {
  if (!filterKey) return true;

  if (filterKey.startsWith('category:')) {
    return expense.categoryId === filterKey.slice('category:'.length);
  }

  if (filterKey.startsWith('store-group:')) {
    return (
      hasMeaningfulSplit(expense) &&
      expense.storeGroup === filterKey.slice('store-group:'.length)
    );
  }

  return false;
}
