import {
  collection, doc, addDoc, updateDoc, deleteDoc, deleteField,
  getDocs, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { parseISO } from 'date-fns';
import { nextOccurrence, isScheduleCompleted } from '../utils/schedule';
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
    typeLabel: data.typeLabel as string | undefined,
    reminderDays: (data.reminderDays as number) ?? 3,
    comment: data.comment as string | undefined,
    isActive: (data.isActive as boolean) ?? true,
  };
}

// Advance date to the first occurrence >= today
function firstFutureOrToday(start: Date, frequency: RecurringFrequency): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let d = new Date(start);
  d.setHours(0, 0, 0, 0);
  while (d < today) d = nextOccurrence(d, frequency);
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
  /** Last scheduled payment date (credits/installments); open-ended when absent. */
  endDate?: Date;
  type: RecurringType;
  typeLabel?: string;
  reminderDays: number;
  comment?: string;
}

export async function addRecurring(input: AddRecurringInput): Promise<SerializableRecurringPayment> {
  const { userId, startDate, endDate, comment, ...rest } = input;
  const nextDueDate = firstFutureOrToday(startDate, input.frequency);
  // A term that is already fully in the past starts out completed
  const isActive = !isScheduleCompleted(nextDueDate.toISOString(), endDate?.toISOString());
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      comment,
      startDate: Timestamp.fromDate(startDate),
      endDate: endDate ? Timestamp.fromDate(endDate) : undefined,
      nextDueDate: Timestamp.fromDate(nextDueDate),
      isActive,
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
): Promise<{ nextDueDate: string; isActive?: false }> {
  const { startDate, endDate, comment, ...rest } = input;
  const nextDueDate = firstFutureOrToday(startDate, input.frequency);
  const completed = isScheduleCompleted(nextDueDate.toISOString(), endDate?.toISOString());
  const patch = Object.fromEntries(
    Object.entries({
      ...rest,
      comment,
      startDate: Timestamp.fromDate(startDate),
      // Clearing the term must actually remove the field, not silently keep it
      endDate: endDate ? Timestamp.fromDate(endDate) : deleteField(),
      nextDueDate: Timestamp.fromDate(nextDueDate),
      // Only force-deactivate an exhausted schedule; a manual pause stays as is
      ...(completed ? { isActive: false } : {}),
    }).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', id), patch);
  return { nextDueDate: nextDueDate.toISOString(), ...(completed ? { isActive: false as const } : {}) };
}

export async function deleteRecurring(userId: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'recurringPayments', userId, 'items', id));
}

export async function toggleRecurring(userId: string, id: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', id), { isActive });
}

/** «Сумма изменилась» at pay time: the price is different from now on. */
export async function updateRecurringAmount(userId: string, id: string, amount: number): Promise<void> {
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', id), { amount });
}

/**
 * Terminates a payment ("я отменил подписку"): nothing more is due, including
 * a payment pending today. The template stays in the list as «Завершено».
 */
export async function completeRecurring(userId: string, id: string): Promise<{ endDate: string }> {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', id), {
    endDate: Timestamp.fromDate(end),
    isActive: false,
  });
  return { endDate: end.toISOString() };
}

export async function markAsPaid(
  userId: string,
  item: SerializableRecurringPayment,
): Promise<SerializableRecurringPayment> {
  const next = nextOccurrence(parseISO(item.nextDueDate), item.frequency);
  // Last payment of a fixed term: the schedule is done, deactivate the template
  const completed = isScheduleCompleted(next.toISOString(), item.endDate);
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', item.id), {
    nextDueDate: Timestamp.fromDate(next),
    ...(completed ? { isActive: false } : {}),
  });
  return { ...item, nextDueDate: next.toISOString(), isActive: item.isActive && !completed };
}

export async function advanceToNextFutureDue(
  userId: string,
  item: SerializableRecurringPayment,
): Promise<SerializableRecurringPayment> {
  const now = new Date();
  let next = parseISO(item.nextDueDate);
  while (next <= now) next = nextOccurrence(next, item.frequency);
  const completed = isScheduleCompleted(next.toISOString(), item.endDate);
  await updateDoc(doc(getDb(), 'recurringPayments', userId, 'items', item.id), {
    nextDueDate: Timestamp.fromDate(next),
    ...(completed ? { isActive: false } : {}),
  });
  return { ...item, nextDueDate: next.toISOString(), isActive: item.isActive && !completed };
}
