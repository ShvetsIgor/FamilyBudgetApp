import { Timestamp } from 'firebase/firestore';

export type Currency = 'ILS' | 'USD' | 'CAD' | 'RUB';
export type Privacy = 'regular' | 'secret';
export type PaymentMethod = 'cash' | 'card' | 'other';
export type Theme = 'light' | 'dark';
export type Language = 'en' | 'ru' | 'he';
export type AccountType = 'personal' | 'family';
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type RecurringType =
  | 'subscription'
  | 'rent'
  | 'credit'
  | 'mortgage'
  | 'utility'
  | 'custom';
export type CategoryType = 'expense' | 'income';
export type InviteStatus = 'pending' | 'accepted' | 'rejected';

// ─── User ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  currency: Currency;
  language: Language;
  theme: Theme;
  accountType: AccountType;
  familyId?: string;
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

export interface Category {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  parentId?: string;
  isPrivate: boolean;
  order: number;
  type: CategoryType;
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
  subcategoryId?: string;
  date: Timestamp;
  paymentMethod: PaymentMethod;
  store?: string;
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
  reminderDays: number;
  comment?: string;
  isActive: boolean;
}

// ─── Savings ─────────────────────────────────────────────────────────────────

export interface SavingsContribution {
  amount: number;
  date: Timestamp;
  note?: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: Currency;
  monthlyContribution?: number;
  deadline?: Timestamp;
  isFamily: boolean;
  participantIds: string[];
  contributions: SavingsContribution[];
  createdAt: Timestamp;
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
