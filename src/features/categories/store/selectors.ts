import type { RootState } from '@/store/store';
import type { CategoryType } from '@/shared/types';
import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';

export const selectActiveParents = (s: RootState, type: CategoryType) =>
  (type === 'expense' ? s.categories.expense : s.categories.income).filter((c) => !c.parentId);

export const selectAvailableLibrary = (s: RootState, type: CategoryType) => {
  const tax = type === 'expense' ? TAXONOMY : [INCOME_TAXONOMY];
  const existingIds = new Set((type === 'expense' ? s.categories.expense : s.categories.income).map((c) => c.id));
  return tax.filter((p) => !existingIds.has(p.id));
};

export const selectSubsOf = (s: RootState, parentId: string, type: CategoryType) =>
  (type === 'expense' ? s.categories.expense : s.categories.income).filter((c) => c.parentId === parentId);

export const selectBudgetFor = (s: RootState, categoryId: string): number =>
  s.budget.limits[categoryId] ?? 0;
