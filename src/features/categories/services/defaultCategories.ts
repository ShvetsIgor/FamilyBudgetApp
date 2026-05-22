import type { Category, CategoryFolder } from '@/shared/types';
import { FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS } from '../preset/categoryPresets';

/** Category document shape ready for Firestore write (userId added by service). */
export type DefaultCategoryEntry = Omit<Category, 'userId'>;

/** CategoryFolder document shape ready for Firestore write (userId added by service). */
export type DefaultFolderEntry = Omit<CategoryFolder, 'userId'>;

// ─── Folder seeds ─────────────────────────────────────────────────────────────
// Folder blueprints → CategoryFolder documents. Folders are UI grouping only.

export const DEFAULT_EXPENSE_FOLDER_SEEDS: DefaultFolderEntry[] = FOLDER_BLUEPRINTS
  .filter((f) => f.id !== 'income')
  .map((f, order) => ({
    id: f.id,
    name: f.name,
    icon: f.icon,
    color: f.color,
    order,
    type: 'expense' as const,
  }));

export const DEFAULT_INCOME_FOLDER_SEEDS: DefaultFolderEntry[] = FOLDER_BLUEPRINTS
  .filter((f) => f.id === 'income')
  .map((f) => ({
    id: f.id,
    name: f.name,
    icon: f.icon,
    color: f.color,
    order: 0,
    type: 'income' as const,
  }));

// ─── Category seeds ───────────────────────────────────────────────────────────
// Category blueprints only → Category documents with folderId set.
// Folder blueprints are NOT represented here — they are UI grouping, not categories.

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategoryEntry[] = [
  ...CATEGORY_BLUEPRINTS
    .filter((c) => c.folderId !== 'income')
    .map((c, order) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      folderId: c.folderId,
      isPrivate: false,
      order,
      type: 'expense' as const,
    })),
  // Savings is a fixed app-managed category, not a blueprint.
  {
    id: 'savings', name: 'Savings', icon: 'piggy', color: '#81B29A',
    isPrivate: false, order: 98, type: 'expense' as const,
  },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategoryEntry[] = CATEGORY_BLUEPRINTS
  .filter((c) => c.folderId === 'income')
  .map((c, order) => ({
    id: c.id,
    name: c.name,
    icon: c.icon,
    color: c.color,
    folderId: c.folderId,
    isPrivate: false,
    order,
    type: 'income' as const,
  }));
