import type { Category } from '@/shared/types';
import { TAXONOMY, INCOME_TAXONOMY } from '../icons/icons';

export type DefaultCategory = Omit<Category, 'userId'>;

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = TAXONOMY.flatMap((parent, order) => [
  {
    id:        parent.id,
    name:      parent.name,
    icon:      parent.icon,
    color:     parent.color,
    parentId:  undefined,
    isPrivate: false,
    order,
    type:      'expense' as const,
  },
  ...parent.subs.map((sub, subOrder) => ({
    id:        sub.id,
    name:      sub.name,
    icon:      sub.icon,
    color:     parent.color,
    parentId:  parent.id,
    isPrivate: false,
    order:     subOrder,
    type:      'expense' as const,
  })),
]);

// Savings special category (no subs)
DEFAULT_EXPENSE_CATEGORIES.push({
  id: 'savings', name: 'Savings', icon: 'piggy', color: '#81B29A',
  parentId: undefined, isPrivate: false, order: 98, type: 'expense',
});

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  {
    id:        INCOME_TAXONOMY.id,
    name:      INCOME_TAXONOMY.name,
    icon:      INCOME_TAXONOMY.icon,
    color:     INCOME_TAXONOMY.color,
    parentId:  undefined,
    isPrivate: false,
    order:     0,
    type:      'income' as const,
  },
  ...INCOME_TAXONOMY.subs.map((sub, subOrder) => ({
    id:        sub.id,
    name:      sub.name,
    icon:      sub.icon,
    color:     INCOME_TAXONOMY.color,
    parentId:  INCOME_TAXONOMY.id,
    isPrivate: false,
    order:     subOrder,
    type:      'income' as const,
  })),
];

/**
 * Maps legacy parent-level category IDs to their primary subcategory ID.
 * Used during migration: old expenses where categoryId === parentId
 * get remapped to the first/most sensible subcategory.
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
