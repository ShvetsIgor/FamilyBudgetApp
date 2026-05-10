import type { Category } from '@/shared/types';

type DefaultCategory = Omit<Category, 'id' | 'userId'>;

// Colors from design system --cat-* tokens
const C = {
  food:          '#E07A5F',
  home:          '#81B29A',
  transport:     '#F2CC8F',
  health:        '#C97B84',
  shopping:      '#8AA9D6',
  entertainment: '#D4A574',
  education:     '#A8B89C',
  kids:          '#E9B384',
  savings:       '#81B29A',
  other:         '#8E7A66',
};

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  // Food
  { name: 'Food',        icon: '🍽️', color: C.food,          parentId: undefined,       isPrivate: false, order: 0, type: 'expense' },
  { name: 'Groceries',   icon: '🛒', color: C.food,          parentId: '__food__',      isPrivate: false, order: 0, type: 'expense' },
  { name: 'Restaurants', icon: '🍜', color: C.food,          parentId: '__food__',      isPrivate: false, order: 1, type: 'expense' },
  { name: 'Coffee',      icon: '☕', color: C.food,          parentId: '__food__',      isPrivate: false, order: 2, type: 'expense' },
  { name: 'Alcohol',     icon: '🍷', color: C.food,          parentId: '__food__',      isPrivate: false, order: 3, type: 'expense' },

  // Home
  { name: 'Home',        icon: '🏠', color: C.home,          parentId: undefined,       isPrivate: false, order: 1, type: 'expense' },
  { name: 'Rent',        icon: '🔑', color: C.home,          parentId: '__home__',      isPrivate: false, order: 0, type: 'expense' },
  { name: 'Utilities',   icon: '💡', color: C.home,          parentId: '__home__',      isPrivate: false, order: 1, type: 'expense' },
  { name: 'Household',   icon: '🧹', color: C.home,          parentId: '__home__',      isPrivate: false, order: 2, type: 'expense' },
  { name: 'Furniture',   icon: '🛋️', color: C.home,          parentId: '__home__',      isPrivate: false, order: 3, type: 'expense' },

  // Transport
  { name: 'Transport',     icon: '🚗', color: C.transport,   parentId: undefined,            isPrivate: false, order: 2, type: 'expense' },
  { name: 'Fuel',          icon: '⛽', color: C.transport,   parentId: '__transport__',      isPrivate: false, order: 0, type: 'expense' },
  { name: 'Public Transit',icon: '🚌', color: C.transport,   parentId: '__transport__',      isPrivate: false, order: 1, type: 'expense' },
  { name: 'Taxi / Uber',   icon: '🚕', color: C.transport,   parentId: '__transport__',      isPrivate: false, order: 2, type: 'expense' },
  { name: 'Parking',       icon: '🅿️', color: C.transport,   parentId: '__transport__',      isPrivate: false, order: 3, type: 'expense' },

  // Health
  { name: 'Health',    icon: '❤️', color: C.health,         parentId: undefined,       isPrivate: false, order: 3, type: 'expense' },
  { name: 'Medicine',  icon: '💊', color: C.health,         parentId: '__health__',    isPrivate: false, order: 0, type: 'expense' },
  { name: 'Doctor',    icon: '🩺', color: C.health,         parentId: '__health__',    isPrivate: false, order: 1, type: 'expense' },
  { name: 'Gym',       icon: '🏋️', color: C.health,         parentId: '__health__',    isPrivate: false, order: 2, type: 'expense' },

  // Shopping
  { name: 'Shopping',     icon: '🛍️', color: C.shopping,    parentId: undefined,          isPrivate: false, order: 4, type: 'expense' },
  { name: 'Clothes',      icon: '👕', color: C.shopping,    parentId: '__shopping__',     isPrivate: false, order: 0, type: 'expense' },
  { name: 'Electronics',  icon: '📱', color: C.shopping,    parentId: '__shopping__',     isPrivate: false, order: 1, type: 'expense' },
  { name: 'Cosmetics',    icon: '💄', color: C.shopping,    parentId: '__shopping__',     isPrivate: false, order: 2, type: 'expense' },

  // Entertainment
  { name: 'Entertainment', icon: '🎬', color: C.entertainment, parentId: undefined,              isPrivate: false, order: 5, type: 'expense' },
  { name: 'Subscriptions', icon: '📺', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 0, type: 'expense' },
  { name: 'Cinema',        icon: '🎥', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 1, type: 'expense' },
  { name: 'Games',         icon: '🎮', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 2, type: 'expense' },

  // Education
  { name: 'Education', icon: '📚', color: C.education,     parentId: undefined,          isPrivate: false, order: 6, type: 'expense' },
  { name: 'Courses',   icon: '🎓', color: C.education,     parentId: '__education__',    isPrivate: false, order: 0, type: 'expense' },
  { name: 'Books',     icon: '📖', color: C.education,     parentId: '__education__',    isPrivate: false, order: 1, type: 'expense' },

  // Kids
  { name: 'Kids',         icon: '👶', color: C.kids,       parentId: undefined,       isPrivate: false, order: 7, type: 'expense' },
  { name: 'Kindergarten', icon: '🏫', color: C.kids,       parentId: '__kids__',      isPrivate: false, order: 0, type: 'expense' },
  { name: 'Toys',         icon: '🧸', color: C.kids,       parentId: '__kids__',      isPrivate: false, order: 1, type: 'expense' },

  // Savings
  { name: 'Savings', icon: '🐷', color: C.savings,         parentId: undefined, isPrivate: false, order: 8,  type: 'expense' },

  // Other
  { name: 'Other',   icon: '📦', color: C.other,           parentId: undefined, isPrivate: false, order: 99, type: 'expense' },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Salary',     icon: '💼', color: C.home,          parentId: undefined, isPrivate: false, order: 0,  type: 'income' },
  { name: 'Freelance',  icon: '💻', color: C.shopping,      parentId: undefined, isPrivate: false, order: 1,  type: 'income' },
  { name: 'Business',   icon: '🏢', color: C.health,        parentId: undefined, isPrivate: false, order: 2,  type: 'income' },
  { name: 'Investment', icon: '📈', color: C.food,          parentId: undefined, isPrivate: false, order: 3,  type: 'income' },
  { name: 'Gift',       icon: '🎁', color: C.kids,          parentId: undefined, isPrivate: false, order: 4,  type: 'income' },
  { name: 'Other',      icon: '📦', color: C.other,         parentId: undefined, isPrivate: false, order: 99, type: 'income' },
];
