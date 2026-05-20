import { Timestamp } from 'firebase/firestore';

export type Currency = 'ILS' | 'USD' | 'CAD' | 'RUB';
export type Privacy = 'regular' | 'secret';
export type PaymentMethod = 'cash' | 'card' | 'other';
export type Theme = 'light' | 'dark';
export type Language = 'en' | 'ru';
export type AccountType = 'personal' | 'family';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurringType =
  | 'subscription'
  | 'rent'
  | 'credit'
  | 'mortgage'
  | 'utility'
  | 'installment'
  | 'custom';
export type CategoryType = 'expense' | 'income';
export type InviteStatus = 'pending' | 'accepted' | 'rejected';

// ─── User ───────────────────────────────────────────────────────────────────

export type WeekStart = 'monday' | 'sunday';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  currency: Currency;
  language: Language;
  theme: Theme;
  weekStart?: WeekStart;
  accountType: AccountType;
  familyId?: string;
  onboarded?: boolean;
  createdAt: Timestamp;
}

// ─── Family ──────────────────────────────────────────────────────────────────

export interface Family {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  createdAt: Timestamp;
}

export interface FamilyInvite {
  id: string;
  familyId: string;
  fromUserId: string;
  toEmail: string;
  status: InviteStatus;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// ─── Category ────────────────────────────────────────────────────────────────

export interface CategoryFolder {
  id: string;
  userId: string;
  name: string;
  icon?: string;
  color?: string;
  type: CategoryType;
  order: number;
}

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  folderId?: string | null;
  /** @deprecated Use folderId. Kept only for legacy Firestore docs during migration. */
  parentId?: string;
  isPrivate: boolean;
  order: number;
  type: CategoryType;
  archived?: boolean;        // soft delete for used categories
}

// ─── Expense ─────────────────────────────────────────────────────────────────

export interface SplitItem {
  categoryId: string;
  amount: number;
}

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  /** @deprecated Legacy field from old subcategory model. Read-only for backward compat. */
  subcategoryId?: string;
  date: Timestamp;
  paymentMethod: PaymentMethod;
  store?: string;
  storeId?: string;
  storeGroup?: string;
  tags: string[];
  comment?: string;
  photoUrl?: string;
  privacy: Privacy;
  splits: SplitItem[];
  isRecurring: boolean;
  recurringId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Income ──────────────────────────────────────────────────────────────────

export interface Income {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  date: Timestamp;
  method: PaymentMethod | 'bank';
  comment?: string;
  tags: string[];
  privacy: Privacy;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SerializableIncome {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  date: string;
  method: PaymentMethod | 'bank';
  comment?: string;
  tags: string[];
  privacy: Privacy;
  createdAt: string;
  updatedAt: string;
}

// ─── Recurring ───────────────────────────────────────────────────────────────

export interface RecurringPayment {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: Timestamp;
  endDate?: Timestamp;
  nextDueDate: Timestamp;
  type: RecurringType;
  typeLabel?: string;
  reminderDays: number;
  comment?: string;
  isActive: boolean;
}

export interface SerializableRecurringPayment {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: string;
  endDate?: string;
  nextDueDate: string;
  type: RecurringType;
  typeLabel?: string;
  reminderDays: number;
  comment?: string;
  isActive: boolean;
}

// ─── Savings ─────────────────────────────────────────────────────────────────

export interface SavingsContribution {
  amount: number;
  date: string; // ISO string
  note?: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  monthlyContribution?: number;
  deadline?: string; // ISO string
  contributions: SavingsContribution[];
  createdAt: string; // ISO string
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface MonthlyStats {
  userId: string;
  month: string; // 'YYYY-MM'
  totalExpenses: number;
  totalIncome: number;
  byCategory: Record<string, number>;
  updatedAt: Timestamp;
}

// ─── Serializable versions for Redux (dates as ISO strings) ──────────────────

export interface SerializableExpense {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  subcategoryId?: string;
  date: string; // ISO string
  paymentMethod: PaymentMethod;
  store?: string;
  storeId?: string;
  storeGroup?: string;
  tags: string[];
  comment?: string;
  photoUrl?: string;
  privacy: Privacy;
  splits: SplitItem[];
  isRecurring: boolean;
  recurringId?: string;
  goalId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Store Profiles ───────────────────────────────────────────────────────────

export interface StoreSubcategoryUsage {
  subcategoryId: string;
  parentId?: string;   // legacy, kept for backward compat
  folderId?: string;   // new — folder the subcategory belongs to
  usageCount: number;
  lastUsed: string; // ISO date YYYY-MM-DD
}

export interface StoreProfile {
  id: string; // storeId
  name: string;
  storeGroup?: string;
  probableSubcategories: StoreSubcategoryUsage[];
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export type DateRange =
  | 'current-month'
  | 'last-month'
  | '3-months'
  | 'year'
  | 'custom';

export interface CustomDateRange {
  from: Date;
  to: Date;
}
