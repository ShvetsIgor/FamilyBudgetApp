import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { addMonths, addWeeks, addDays, addYears, parseISO } from 'date-fns';
import type { SerializableRecurringPayment, Currency, RecurringFrequency, RecurringType } from '@/shared/types';

function col(userId: string) {
  return collection(getDb(), 'recurringPayments', userId, 'items');
}

function toISO(v: unknown): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? new Date().toISOString();
}

function toSerializable(id: string, data: Record<string, unknown>): SerializableRecurringPayment {
  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    amount: data.amount as number,
    currency: data.currency as Currency,
    categoryId: data.categoryId as string,
    frequency: data.frequency as RecurringFrequency,
    startDate: toISO(data.startDate),
    endDate: data.endDate ? toISO(data.endDate) : undefined,
    nextDueDate: toISO(data.nextDueDate),
    type: data.type as RecurringType,
    reminderDays: (data.reminderDays as number) ?? 3,
    comment: data.comment as string | undefined,
    isActive: (data.isActive as boolean) ?? true,
  };
}

function nextDue(from: Date, frequency: RecurringFrequency): Date {
  switch (frequency) {
    case 'daily': return addDays(from, 1);
    case 'weekly': return addWeeks(from, 1);
    case 'monthly': return addMonths(from, 1);
    case 'yearly': return addYears(from, 1);
  }
}

// Advance date to the first occurrence >= today
function firstFutureOrToday(start: Date, frequency: RecurringFrequency): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let d = new Date(start);
  d.setHours(0, 0, 0, 0);
  while (d < today) d = nextDue(d, frequency);
  return d;
}

export async function fetchRecurring(userId: string): Promise<SerializableRecurringPayment[]> {
  const snap = await getDocs(query(col(userId), orderBy('nextDueDate')));
  return snap.docs.map((d) => toSerializable(d.id, d.data()));
}

export interface AddRecurringInput {
  userId: string;
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  frequency: RecurringFrequency;
  startDate: Date;
  type: RecurringType;
  typeLabel?: string;
  reminderDays: number;
  comment?: string;
}

export async function addRecurring(input: AddRecurringInput): Promise<SerializableRecurringPayment> {
  const { userId, startDate, comment, ...rest } = input;
  const nextDueDate = firstFutureOrToday(startDate, input.frequency);
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      comment,
      startDate: Timestamp.fromDate(startDate),
      nextDueDate: Timestamp.fromDate(nextDueDate),
      isActive: true,
      createdAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(col(userId), data);
  return toSerializable(ref.id, {
    ...data,
    startDate: Timestamp.fromDate(startDate),
    nextDueDate: Timestamp.fromDate(nextDueDate),
  });
}

export async function updateRecurring(
  userId: string,
  id: string,
  input: Omit<AddRecurringInput, 'userId'>
): Promise<{ nextDueDate: string }> {
  const { startDate, comment, ...rest } = input;
  const nextDueDate = firstFutureOrToday(startDate, input.frequency);
  const patch = Object.fromEntries(
    Object.entries({
      ...rest,
      comment,
      startDate: Timestamp.fromDate(startDate),
      nextDueDate: Timestamp.fromDate(nextDueDate),
    }).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', id), patch);
  return { nextDueDate: nextDueDate.toISOString() };
}

export async function deleteRecurring(userId: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'recurringPayments', userId, 'items', id));
}

export async function toggleRecurring(userId: string, id: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', id), { isActive });
}

export async function markAsPaid(
  userId: string,
  item: SerializableRecurringPayment,
): Promise<SerializableRecurringPayment> {
  const next = nextDue(parseISO(item.nextDueDate), item.frequency);
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', item.id), {
    nextDueDate: Timestamp.fromDate(next),
  });
  return { ...item, nextDueDate: next.toISOString() };
}

export async function advanceToNextFutureDue(
  userId: string,
  item: SerializableRecurringPayment,
): Promise<SerializableRecurringPayment> {
  const now = new Date();
  let next = parseISO(item.nextDueDate);
  while (next <= now) next = nextDue(next, item.frequency);
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', item.id), {
    nextDueDate: Timestamp.fromDate(next),
  });
  return { ...item, nextDueDate: next.toISOString() };
}
