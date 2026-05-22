import type { Category } from '@/shared/types';
import { FOLDER_BLUEPRINTS, CATEGORY_BLUEPRINTS } from '../preset/categoryPresets';
export { legacyCategoryMap } from '../compat/legacyCategoryMap';

export type DefaultCategory = Omit<Category, 'userId'>;

// Expense folders → flat Category entries (for reset-to-defaults, which uses the old flat model)
export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  ...FOLDER_BLUEPRINTS
    .filter((f) => f.id !== 'income')
    .map((f, order) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      color: f.color,
      isPrivate: false,
      order,
      type: 'expense' as const,
    })),
  ...CATEGORY_BLUEPRINTS
    .filter((c) => c.folderId !== 'income')
    .map((c, order) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      isPrivate: false,
      order,
      type: 'expense' as const,
    })),
];

DEFAULT_EXPENSE_CATEGORIES.push({
  id: 'savings', name: 'Savings', icon: 'piggy', color: '#81B29A',
  isPrivate: false, order: 98, type: 'expense',
});

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  ...FOLDER_BLUEPRINTS
    .filter((f) => f.id === 'income')
    .map((f) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      color: f.color,
      isPrivate: false,
      order: 0,
      type: 'income' as const,
    })),
  ...CATEGORY_BLUEPRINTS
    .filter((c) => c.folderId === 'income')
    .map((c, order) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      isPrivate: false,
      order,
      type: 'income' as const,
    })),
];

/**
 * Maps old category IDs to their canonical flat-model replacement.
 * Used only in resetCategoriesToDefaults to remap old expense categoryIds.
 */
export const legacyCategoryMap: Record<string, string> = {
  food:           'groceries',
  home:           'household',
  transport:      'public_transport',
  entertainment:  'movies',
  shopping:       'clothing',
  health:         'pharmacy',
  education:      'courses',
  travel:         'flights',
  kids:           'toys',
  pets:           'pet_food',
  beauty:         'haircut',
  sport:          'gym',
  cafe:           'restaurants',
  gifts:          'gifts_given',
  finance:        'bank_fees',
  utilities:      'electricity',
  business:       'office_supplies',
  charity:        'donations',
  other:          'misc',
  income:         'salary',
};
