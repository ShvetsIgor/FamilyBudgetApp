import type { Category, CategoryFolder } from '@/shared/types';
import { FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS } from '../preset/categoryPresets';

/** Category document shape ready for Firestore write (userId added by service). */
export type DefaultCategoryEntry = Omit<Category, 'userId'>;

/** CategoryFolder document shape ready for Firestore write (userId added by service). */
export type DefaultFolderEntry = Omit<CategoryFolder, 'userId'>;

// ─── Core context IDs ─────────────────────────────────────────────────────────
// Only these 9 folders + their categories are seeded for new users.
// Remaining blueprints are available via the Standard Library in CategoriesHub.
const CORE_FOLDER_IDS = new Set([
  'food',           // Supermarket
  'home',           // Home
  'transport',      // Transport
  'health',         // Health
  'shopping',       // Shopping
  'entertainment',  // Entertainment
  'travel',         // Travel
  'work',           // Work
  'subscriptions',  // Subscriptions
]);

// ─── Folder seeds ─────────────────────────────────────────────────────────────
// Only core contexts seeded — the rest live in the Standard Library.

export const DEFAULT_EXPENSE_FOLDER_SEEDS: DefaultFolderEntry[] = FOLDER_BLUEPRINTS
  .filter((f) => CORE_FOLDER_IDS.has(f.id))
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
// Only categories belonging to core folders are seeded.
// Non-core categories are accessible via the Standard Library.

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategoryEntry[] = [
  ...CATEGORY_BLUEPRINTS
    .filter((c) => CORE_FOLDER_IDS.has(c.folderId))
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
