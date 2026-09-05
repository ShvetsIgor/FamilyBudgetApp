import {
  collection, doc, addDoc, deleteDoc, getDocs,
  updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { Currency } from '@/shared/types';

export interface RecurringIncomeItem {
  id: string;
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  dayOfMonth: number;
  isActive: boolean;
  nextDueDate: string; // YYYY-MM-DD
  createdAt: string;
}

function col(userId: string) {
  return collection(getDb(), 'recurringIncome', userId, 'items');
}

function toItem(id: string, data: Record<string, unknown>): RecurringIncomeItem {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? new Date().toISOString();
  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    amount: data.amount as number,
    currency: data.currency as Currency,
    categoryId: data.categoryId as string,
    dayOfMonth: data.dayOfMonth as number,
    isActive: (data.isActive as boolean) ?? true,
    nextDueDate: data.nextDueDate as string,
    createdAt: toISO(data.createdAt),
  };
}

export async function fetchRecurringIncome(userId: string): Promise<RecurringIncomeItem[]> {
  const snap = await getDocs(col(userId));
  return snap.docs.map((d) => toItem(d.id, d.data()));
}

export interface AddRecurringIncomeInput {
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  dayOfMonth: number;
  nextDueDate: string;
}

export async function addRecurringIncome(input: AddRecurringIncomeInput): Promise<RecurringIncomeItem> {
  const ref = await addDoc(col(input.userId), {
    ...input,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  return {
    id: ref.id,
    ...input,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * The month after `dueDate`, clamped to the anchor day (a 31st becomes the
 * 28th in February and stays the 31st in March, because the anchor is kept
 * separately rather than derived from the last due date).
 */
export function nextIncomeDueDate(dueDate: string, dayOfMonth: number): string {
  const [year, month] = dueDate.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const daysInNext = new Date(nextYear, nextMonth, 0).getDate();
  const day = Math.min(dayOfMonth, daysInNext);
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Every occurrence owed on or before `todayKey`, oldest first.
 *
 * Startup used to book only the OLDEST missed occurrence and advance the
 * template by exactly one month, so someone returning after a three-month
 * break had to relaunch the app three times to collect three salaries.
 */
export function dueIncomeOccurrences(
  nextDueDate: string,
  dayOfMonth: number,
  todayKey: string,
  maxOccurrences = 120,
): string[] {
  const due: string[] = [];
  let cursor = nextDueDate;
  while (cursor <= todayKey && due.length < maxOccurrences) {
    due.push(cursor);
    cursor = nextIncomeDueDate(cursor, dayOfMonth);
  }
  return due;
}

export async function advanceRecurringIncomeNextDue(userId: string, item: RecurringIncomeItem): Promise<string> {
  const nextDue = nextIncomeDueDate(item.nextDueDate, item.dayOfMonth);
  await updateDoc(doc(getDb(), 'recurringIncome', userId, 'items', item.id), { nextDueDate: nextDue });
  return nextDue;
}

/** Moves a template straight to the first occurrence after `todayKey`. */
export async function setRecurringIncomeNextDue(
  userId: string, id: string, nextDueDate: string,
): Promise<void> {
  await updateDoc(doc(getDb(), 'recurringIncome', userId, 'items', id), { nextDueDate });
}
