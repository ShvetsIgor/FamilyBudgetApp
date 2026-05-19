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

export async function advanceRecurringIncomeNextDue(userId: string, item: RecurringIncomeItem): Promise<string> {
  const [year, month] = item.nextDueDate.split('-').map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const daysInNext = new Date(nextYear, nextMonth, 0).getDate();
  const day = Math.min(item.dayOfMonth, daysInNext);
  const nextDue = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  await updateDoc(doc(getDb(), 'recurringIncome', userId, 'items', item.id), { nextDueDate: nextDue });
  return nextDue;
}

export async function deleteRecurringIncome(userId: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'recurringIncome', userId, 'items', id));
}
