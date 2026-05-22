import type { RootState } from '@/store/store';
import type { CategoryType } from '@/shared/types';
import { LIBRARY_FOLDERS } from '../config/libraryConfig';

/**
 * Returns folder blueprints not yet activated by the user.
 * Checks both folder IDs (new architecture) and category IDs (backward compat —
 * old users had parent categories instead of folders).
 */
export const selectAvailableLibrary = (s: RootState, type: CategoryType) => {
  const activeFolderIds = new Set(
    (type === 'expense' ? s.categories.folders.expense : s.categories.folders.income).map(
      (f) => f.id,
    ),
  );
  const activeCategoryIds = new Set(
    (type === 'expense' ? s.categories.expense : s.categories.income).map((c) => c.id),
  );

  return LIBRARY_FOLDERS.filter(
    (f) =>
      (type === 'expense' ? f.id !== 'income' : f.id === 'income') &&
      !activeFolderIds.has(f.id) &&
      !activeCategoryIds.has(f.id),
  );
};
