import type { Category } from '@/shared/types';

type DefaultCategory = Omit<Category, 'id' | 'userId'>;

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  // Food
  { name: 'Food', icon: '🍽️', color: '#f97316', parentId: undefined, isPrivate: false, order: 0, type: 'expense' },
  { name: 'Groceries', icon: '🛒', color: '#f97316', parentId: '__food__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Restaurants', icon: '🍜', color: '#f97316', parentId: '__food__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Coffee', icon: '☕', color: '#f97316', parentId: '__food__', isPrivate: false, order: 2, type: 'expense' },
  { name: 'Alcohol', icon: '🍷', color: '#f97316', parentId: '__food__', isPrivate: false, order: 3, type: 'expense' },

  // Home
  { name: 'Home', icon: '🏠', color: '#3b82f6', parentId: undefined, isPrivate: false, order: 1, type: 'expense' },
  { name: 'Rent', icon: '🔑', color: '#3b82f6', parentId: '__home__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Utilities', icon: '💡', color: '#3b82f6', parentId: '__home__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Household', icon: '🧹', color: '#3b82f6', parentId: '__home__', isPrivate: false, order: 2, type: 'expense' },
  { name: 'Furniture', icon: '🛋️', color: '#3b82f6', parentId: '__home__', isPrivate: false, order: 3, type: 'expense' },

  // Transport
  { name: 'Transport', icon: '🚗', color: '#8b5cf6', parentId: undefined, isPrivate: false, order: 2, type: 'expense' },
  { name: 'Fuel', icon: '⛽', color: '#8b5cf6', parentId: '__transport__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Public Transit', icon: '🚌', color: '#8b5cf6', parentId: '__transport__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Taxi / Uber', icon: '🚕', color: '#8b5cf6', parentId: '__transport__', isPrivate: false, order: 2, type: 'expense' },
  { name: 'Parking', icon: '🅿️', color: '#8b5cf6', parentId: '__transport__', isPrivate: false, order: 3, type: 'expense' },

  // Health
  { name: 'Health', icon: '❤️', color: '#ec4899', parentId: undefined, isPrivate: false, order: 3, type: 'expense' },
  { name: 'Medicine', icon: '💊', color: '#ec4899', parentId: '__health__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Doctor', icon: '🩺', color: '#ec4899', parentId: '__health__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Gym', icon: '🏋️', color: '#ec4899', parentId: '__health__', isPrivate: false, order: 2, type: 'expense' },

  // Shopping
  { name: 'Shopping', icon: '🛍️', color: '#06b6d4', parentId: undefined, isPrivate: false, order: 4, type: 'expense' },
  { name: 'Clothes', icon: '👕', color: '#06b6d4', parentId: '__shopping__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Electronics', icon: '📱', color: '#06b6d4', parentId: '__shopping__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Cosmetics', icon: '💄', color: '#06b6d4', parentId: '__shopping__', isPrivate: false, order: 2, type: 'expense' },

  // Entertainment
  { name: 'Entertainment', icon: '🎬', color: '#eab308', parentId: undefined, isPrivate: false, order: 5, type: 'expense' },
  { name: 'Subscriptions', icon: '📺', color: '#eab308', parentId: '__entertainment__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Cinema', icon: '🎥', color: '#eab308', parentId: '__entertainment__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Games', icon: '🎮', color: '#eab308', parentId: '__entertainment__', isPrivate: false, order: 2, type: 'expense' },

  // Education
  { name: 'Education', icon: '📚', color: '#10b981', parentId: undefined, isPrivate: false, order: 6, type: 'expense' },
  { name: 'Courses', icon: '🎓', color: '#10b981', parentId: '__education__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Books', icon: '📖', color: '#10b981', parentId: '__education__', isPrivate: false, order: 1, type: 'expense' },

  // Kids
  { name: 'Kids', icon: '👶', color: '#f59e0b', parentId: undefined, isPrivate: false, order: 7, type: 'expense' },
  { name: 'Kindergarten', icon: '🏫', color: '#f59e0b', parentId: '__kids__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Toys', icon: '🧸', color: '#f59e0b', parentId: '__kids__', isPrivate: false, order: 1, type: 'expense' },

  // Other
  { name: 'Other', icon: '📦', color: '#6b7280', parentId: undefined, isPrivate: false, order: 99, type: 'expense' },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary', icon: '💼', color: '#10b981', parentId: undefined, isPrivate: false, order: 0, type: 'income' },
  { name: 'Freelance', icon: '💻', color: '#3b82f6', parentId: undefined, isPrivate: false, order: 1, type: 'income' },
  { name: 'Business', icon: '🏢', color: '#8b5cf6', parentId: undefined, isPrivate: false, order: 2, type: 'income' },
  { name: 'Investment', icon: '📈', color: '#f97316', parentId: undefined, isPrivate: false, order: 3, type: 'income' },
  { name: 'Gift', icon: '🎁', color: '#ec4899', parentId: undefined, isPrivate: false, order: 4, type: 'income' },
  { name: 'Other', icon: '📦', color: '#6b7280', parentId: undefined, isPrivate: false, order: 99, type: 'income' },
];
