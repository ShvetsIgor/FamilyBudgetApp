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
    name:      INCOME_TAXONOMY.name,
    icon:      INCOME_TAXONOMY.icon,
    color:     INCOME_TAXONOMY.color,
    parentId:  undefined,
    isPrivate: false,
    order:     0,
    type:      'income' as const,
  },
  ...INCOME_TAXONOMY.subs.map((sub, subOrder) => ({
    name:      sub.name,
    icon:      sub.icon,
    color:     INCOME_TAXONOMY.color,
    parentId:  makeKey(INCOME_TAXONOMY.name),
    isPrivate: false,
    order:     subOrder,
    type:      'income' as const,
  })),
];
