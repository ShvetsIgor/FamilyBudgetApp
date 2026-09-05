import type { Category, CategoryFolder } from '@/shared/types';
import { FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS } from '../preset/categoryPresets';

/** Category document shape ready for Firestore write (userId added by service). */
export type DefaultCategoryEntry = Omit<Category, 'userId'>;

/** CategoryFolder document shape ready for Firestore write (userId added by service). */
export type DefaultFolderEntry = Omit<CategoryFolder, 'userId'>;

// ─── Core context IDs ─────────────────────────────────────────────────────────
// Only these 11 folders + their categories are seeded for new users.
// Remaining blueprints are available via the Standard Library in CategoriesHub.
const CORE_FOLDER_IDS = new Set([
  'food',           // Супермаркет
  'dining',         // Вне дома
  'home',           // Дом
  'transport',      // Транспорт
  'car',            // Машина
  'health',         // Здоровье
  'kids',           // Дети
  'shopping',       // Покупки / Одежда
  'technology',     // Технологии
  'entertainment',  // Развлечения
  'travel',         // Путешествия
]);

// ─── Folder seeds ─────────────────────────────────────────────────────────────
// Only core contexts seeded — the rest live in the Standard Library.

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

// ─── Stable expense category ids ─────────────────────────────────────────────
// Every library blueprint plus the fixed app-managed 'savings'. A budget limit
// keyed by one of these ids stays valid across a category reset (the category
// can be re-activated from the Library under the same id); anything else can
// never resolve again and is safe to prune.

export const PRESET_EXPENSE_CATEGORY_IDS: ReadonlySet<string> = new Set([
  ...CATEGORY_BLUEPRINTS.filter((c) => c.folderId !== 'income').map((c) => c.id),
  'savings',
]);

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
