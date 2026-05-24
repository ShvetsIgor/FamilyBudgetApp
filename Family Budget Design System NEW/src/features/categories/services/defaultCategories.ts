import type { Category } from '@/shared/types';

type DefaultCategory = Omit<Category, 'id' | 'userId'>;

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  // Food
  { name: 'Food', icon: '🍽️', color: '#f97316', parentId: undefined, isPrivate: false, order: 0, type: 'expense' },
  { name: 'Groceries', icon: '🛒', color: '#fb923c', parentId: '__food__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Restaurants', icon: '🍜', color: '#f59e0b', parentId: '__food__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Coffee', icon: '☕', color: '#d97706', parentId: '__food__', isPrivate: false, order: 2, type: 'expense' },
  { name: 'Alcohol', icon: '🍷', color: '#b45309', parentId: '__food__', isPrivate: false, order: 3, type: 'expense' },

  // Home
  { name: 'Home', icon: '🏠', color: '#3b82f6', parentId: undefined, isPrivate: false, order: 1, type: 'expense' },
  { name: 'Rent', icon: '🔑', color: '#2563eb', parentId: '__home__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Utilities', icon: '💡', color: '#60a5fa', parentId: '__home__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Household', icon: '🧹', color: '#93c5fd', parentId: '__home__', isPrivate: false, order: 2, type: 'expense' },
  { name: 'Furniture', icon: '🛋️', color: '#1d4ed8', parentId: '__home__', isPrivate: false, order: 3, type: 'expense' },

  // Transport
  { name: 'Transport', icon: '🚗', color: '#8b5cf6', parentId: undefined, isPrivate: false, order: 2, type: 'expense' },
  { name: 'Fuel', icon: '⛽', color: '#7c3aed', parentId: '__transport__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Public Transit', icon: '🚌', color: '#a78bfa', parentId: '__transport__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Taxi / Uber', icon: '🚕', color: '#6d28d9', parentId: '__transport__', isPrivate: false, order: 2, type: 'expense' },
  { name: 'Parking', icon: '🅿️', color: '#c4b5fd', parentId: '__transport__', isPrivate: false, order: 3, type: 'expense' },

  // Health
  { name: 'Health', icon: '❤️', color: '#ec4899', parentId: undefined, isPrivate: false, order: 3, type: 'expense' },
  { name: 'Medicine', icon: '💊', color: '#db2777', parentId: '__health__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Doctor', icon: '🩺', color: '#f472b6', parentId: '__health__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Gym', icon: '🏋️', color: '#be185d', parentId: '__health__', isPrivate: false, order: 2, type: 'expense' },

  // Shopping
  { name: 'Shopping', icon: '🛍️', color: '#06b6d4', parentId: undefined, isPrivate: false, order: 4, type: 'expense' },
  { name: 'Clothes', icon: '👕', color: '#0891b2', parentId: '__shopping__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Electronics', icon: '📱', color: '#67e8f9', parentId: '__shopping__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Cosmetics', icon: '💄', color: '#0e7490', parentId: '__shopping__', isPrivate: false, order: 2, type: 'expense' },

  // Entertainment
  { name: 'Entertainment', icon: '🎬', color: '#eab308', parentId: undefined, isPrivate: false, order: 5, type: 'expense' },
  { name: 'Subscriptions', icon: '📺', color: '#ca8a04', parentId: '__entertainment__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Cinema', icon: '🎥', color: '#fde047', parentId: '__entertainment__', isPrivate: false, order: 1, type: 'expense' },
  { name: 'Games', icon: '🎮', color: '#a16207', parentId: '__entertainment__', isPrivate: false, order: 2, type: 'expense' },

  // Education
  { name: 'Education', icon: '📚', color: '#10b981', parentId: undefined, isPrivate: false, order: 6, type: 'expense' },
  { name: 'Courses', icon: '🎓', color: '#059669', parentId: '__education__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Books', icon: '📖', color: '#34d399', parentId: '__education__', isPrivate: false, order: 1, type: 'expense' },

  // Kids
  { name: 'Kids', icon: '👶', color: '#f59e0b', parentId: undefined, isPrivate: false, order: 7, type: 'expense' },
  { name: 'Kindergarten', icon: '🏫', color: '#d97706', parentId: '__kids__', isPrivate: false, order: 0, type: 'expense' },
  { name: 'Toys', icon: '🧸', color: '#fcd34d', parentId: '__kids__', isPrivate: false, order: 1, type: 'expense' },

  // Savings
  { name: 'Savings', icon: '🐷', color: '#10b981', parentId: undefined, isPrivate: false, order: 8, type: 'expense' },

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
