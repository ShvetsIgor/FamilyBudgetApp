import type { Category } from '@/shared/types';

type DefaultCategory = Omit<Category, 'id' | 'userId'>;

const C = {
  groceries:     '#E07A5F',
  dining:        '#D4623A',
  entertainment: '#D4A574',
  home:          '#81B29A',
  car:           '#F2CC8F',
  transport:     '#C8B87A',
  travel:        '#6B9BC4',
  health:        '#C97B84',
  shopping:      '#8AA9D6',
  kids:          '#E9B384',
  gifts:         '#B8A9C9',
  digital:       '#7EC8C8',
  savings:       '#81B29A',
  other:         '#8E7A66',
  income:        '#6BAF92',
};

export const DEFAULT_EXPENSE_CATEGORIES: DefaultCategory[] = [
  // ── Groceries ──────────────────────────────────────────────────────────
  { name: 'Groceries',           icon: '🛒', color: C.groceries,     parentId: undefined,          isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Supermarket',         icon: '🏪', color: C.groceries,     parentId: '__groceries__',    isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Alcohol',             icon: '🍷', color: C.groceries,     parentId: '__groceries__',    isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Household Chemicals', icon: '🧴', color: C.groceries,     parentId: '__groceries__',    isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Home Essentials',     icon: '🧻', color: C.groceries,     parentId: '__groceries__',    isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.groceries,     parentId: '__groceries__',    isPrivate: false, order: 99, type: 'expense' },

  // ── Dining Out ─────────────────────────────────────────────────────────
  { name: 'Dining Out',          icon: '🍽️', color: C.dining,        parentId: undefined,          isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Restaurants',         icon: '🍜', color: C.dining,        parentId: '__dining_out__',   isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Coffee',              icon: '☕', color: C.dining,        parentId: '__dining_out__',   isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Delivery',            icon: '🛵', color: C.dining,        parentId: '__dining_out__',   isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Fast Food',           icon: '🍔', color: C.dining,        parentId: '__dining_out__',   isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Snacks & Ice Cream',  icon: '🍦', color: C.dining,        parentId: '__dining_out__',   isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.dining,        parentId: '__dining_out__',   isPrivate: false, order: 99, type: 'expense' },

  // ── Entertainment ──────────────────────────────────────────────────────
  { name: 'Entertainment',       icon: '🎬', color: C.entertainment, parentId: undefined,              isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Movies',              icon: '🎥', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Parks & Attractions', icon: '🎡', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Excursions',          icon: '🗺️', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Events',              icon: '🎪', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Hobbies',             icon: '🎨', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.entertainment, parentId: '__entertainment__',    isPrivate: false, order: 99, type: 'expense' },

  // ── Home & Bills ───────────────────────────────────────────────────────
  { name: 'Home & Bills',        icon: '🏠', color: C.home,          parentId: undefined,              isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Rent',                icon: '🔑', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Mortgage',            icon: '🏦', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Electricity',         icon: '⚡', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Water',               icon: '💧', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Internet',            icon: '📡', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Mobile',              icon: '📱', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 5,  type: 'expense' },
  { name: 'Arnona',              icon: '🏛️', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 6,  type: 'expense' },
  { name: 'Building Committee',  icon: '🏢', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 7,  type: 'expense' },
  { name: 'Furniture',           icon: '🛋️', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 8,  type: 'expense' },
  { name: 'Home Purchases',      icon: '🛒', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 9,  type: 'expense' },
  { name: 'Repairs',             icon: '🔧', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 10, type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.home,          parentId: '__home_&_bills__',     isPrivate: false, order: 99, type: 'expense' },

  // ── Car ────────────────────────────────────────────────────────────────
  { name: 'Car',                 icon: '🚗', color: C.car,           parentId: undefined,          isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Fuel',                icon: '⛽', color: C.car,           parentId: '__car__',          isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Insurance',           icon: '🛡️', color: C.car,           parentId: '__car__',          isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Maintenance',         icon: '🔩', color: C.car,           parentId: '__car__',          isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Parking',             icon: '🅿️', color: C.car,           parentId: '__car__',          isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Car Tax',             icon: '📋', color: C.car,           parentId: '__car__',          isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Car Wash',            icon: '🚿', color: C.car,           parentId: '__car__',          isPrivate: false, order: 5,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.car,           parentId: '__car__',          isPrivate: false, order: 99, type: 'expense' },

  // ── Transport ──────────────────────────────────────────────────────────
  { name: 'Transport',           icon: '🚌', color: C.transport,     parentId: undefined,          isPrivate: false, order: 5,  type: 'expense' },
  { name: 'Public Transport',    icon: '🚋', color: C.transport,     parentId: '__transport__',    isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Taxi',                icon: '🚕', color: C.transport,     parentId: '__transport__',    isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Train',               icon: '🚂', color: C.transport,     parentId: '__transport__',    isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Bus Pass',            icon: '🎫', color: C.transport,     parentId: '__transport__',    isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.transport,     parentId: '__transport__',    isPrivate: false, order: 99, type: 'expense' },

  // ── Travel ─────────────────────────────────────────────────────────────
  { name: 'Travel',              icon: '✈️', color: C.travel,        parentId: undefined,          isPrivate: false, order: 6,  type: 'expense' },
  { name: 'Flights',             icon: '🛫', color: C.travel,        parentId: '__travel__',       isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Hotels',              icon: '🏨', color: C.travel,        parentId: '__travel__',       isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Transport Abroad',    icon: '🚌', color: C.travel,        parentId: '__travel__',       isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Food Abroad',         icon: '🍱', color: C.travel,        parentId: '__travel__',       isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Shopping Abroad',     icon: '🛍️', color: C.travel,        parentId: '__travel__',       isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.travel,        parentId: '__travel__',       isPrivate: false, order: 99, type: 'expense' },

  // ── Health ─────────────────────────────────────────────────────────────
  { name: 'Health',              icon: '❤️', color: C.health,        parentId: undefined,          isPrivate: false, order: 7,  type: 'expense' },
  { name: 'Medicine',            icon: '💊', color: C.health,        parentId: '__health__',       isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Doctors',             icon: '🩺', color: C.health,        parentId: '__health__',       isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Dentist',             icon: '🦷', color: C.health,        parentId: '__health__',       isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Fitness',             icon: '🏋️', color: C.health,        parentId: '__health__',       isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Insurance',           icon: '🛡️', color: C.health,        parentId: '__health__',       isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.health,        parentId: '__health__',       isPrivate: false, order: 99, type: 'expense' },

  // ── Shopping ───────────────────────────────────────────────────────────
  { name: 'Shopping',            icon: '🛍️', color: C.shopping,      parentId: undefined,          isPrivate: false, order: 8,  type: 'expense' },
  { name: 'Clothes',             icon: '👕', color: C.shopping,      parentId: '__shopping__',     isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Electronics',         icon: '💻', color: C.shopping,      parentId: '__shopping__',     isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Cosmetics',           icon: '💄', color: C.shopping,      parentId: '__shopping__',     isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Online Shopping',     icon: '🖥️', color: C.shopping,      parentId: '__shopping__',     isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Home Goods',          icon: '🏺', color: C.shopping,      parentId: '__shopping__',     isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Accessories',         icon: '👜', color: C.shopping,      parentId: '__shopping__',     isPrivate: false, order: 5,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.shopping,      parentId: '__shopping__',     isPrivate: false, order: 99, type: 'expense' },

  // ── Kids ───────────────────────────────────────────────────────────────
  { name: 'Kids',                icon: '👶', color: C.kids,          parentId: undefined,          isPrivate: false, order: 9,  type: 'expense' },
  { name: 'Gifts',               icon: '🎁', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Activities',          icon: '🎠', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Tutoring',            icon: '📚', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 2,  type: 'expense' },
  { name: 'School',              icon: '🏫', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Pocket Money',        icon: '🪙', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Donations',           icon: '🤝', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 5,  type: 'expense' },
  { name: 'Toys',                icon: '🧸', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 6,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.kids,          parentId: '__kids__',         isPrivate: false, order: 99, type: 'expense' },

  // ── Gifts ──────────────────────────────────────────────────────────────
  { name: 'Gifts',               icon: '🎁', color: C.gifts,         parentId: undefined,          isPrivate: false, order: 10, type: 'expense' },
  { name: 'Birthdays',           icon: '🎂', color: C.gifts,         parentId: '__gifts__',        isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Holidays',            icon: '🎄', color: C.gifts,         parentId: '__gifts__',        isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Charity',             icon: '💝', color: C.gifts,         parentId: '__gifts__',        isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Donations',           icon: '🤝', color: C.gifts,         parentId: '__gifts__',        isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.gifts,         parentId: '__gifts__',        isPrivate: false, order: 99, type: 'expense' },

  // ── Online & Digital ───────────────────────────────────────────────────
  { name: 'Online & Digital',    icon: '🌐', color: C.digital,       parentId: undefined,                  isPrivate: false, order: 11, type: 'expense' },
  { name: 'Subscriptions',       icon: '📺', color: C.digital,       parentId: '__online_&_digital__',     isPrivate: false, order: 0,  type: 'expense' },
  { name: 'Games',               icon: '🎮', color: C.digital,       parentId: '__online_&_digital__',     isPrivate: false, order: 1,  type: 'expense' },
  { name: 'Music',               icon: '🎵', color: C.digital,       parentId: '__online_&_digital__',     isPrivate: false, order: 2,  type: 'expense' },
  { name: 'Movies & Streaming',  icon: '🎬', color: C.digital,       parentId: '__online_&_digital__',     isPrivate: false, order: 3,  type: 'expense' },
  { name: 'Apps & Software',     icon: '📲', color: C.digital,       parentId: '__online_&_digital__',     isPrivate: false, order: 4,  type: 'expense' },
  { name: 'Cloud Services',      icon: '☁️', color: C.digital,       parentId: '__online_&_digital__',     isPrivate: false, order: 5,  type: 'expense' },
  { name: 'Other',               icon: '📦', color: C.digital,       parentId: '__online_&_digital__',     isPrivate: false, order: 99, type: 'expense' },

  // ── Savings (special — auto-created, no subcategories) ─────────────────
  { name: 'Savings',             icon: '🐷', color: C.savings,       parentId: undefined, isPrivate: false, order: 98, type: 'expense' },
];

export const DEFAULT_INCOME_CATEGORIES: DefaultCategory[] = [
  { name: 'Income',       icon: '💰', color: C.income, parentId: undefined,      isPrivate: false, order: 0,  type: 'income' },
  { name: 'Salary',       icon: '💼', color: C.income, parentId: '__income__',   isPrivate: false, order: 0,  type: 'income' },
  { name: 'Freelance',    icon: '🖥️', color: C.income, parentId: '__income__',   isPrivate: false, order: 1,  type: 'income' },
  { name: 'Business',     icon: '🏢', color: C.income, parentId: '__income__',   isPrivate: false, order: 2,  type: 'income' },
  { name: 'Bonus',        icon: '🎯', color: C.income, parentId: '__income__',   isPrivate: false, order: 3,  type: 'income' },
  { name: 'Gifts',        icon: '🎁', color: C.income, parentId: '__income__',   isPrivate: false, order: 4,  type: 'income' },
  { name: 'Refunds',      icon: '↩️', color: C.income, parentId: '__income__',   isPrivate: false, order: 5,  type: 'income' },
  { name: 'Investments',  icon: '📈', color: C.income, parentId: '__income__',   isPrivate: false, order: 6,  type: 'income' },
  { name: 'Other',        icon: '📦', color: C.income, parentId: '__income__',   isPrivate: false, order: 99, type: 'income' },
];
