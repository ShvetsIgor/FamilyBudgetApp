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

