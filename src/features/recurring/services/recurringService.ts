import {
  collection, doc, addDoc, updateDoc, deleteDoc, deleteField,
  getDoc, getDocs, query, orderBy, serverTimestamp, Timestamp, writeBatch, runTransaction,
} from 'firebase/firestore';
import { readEntryPrivacy } from '@/shared/services/entryPrivacy';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import { getDb } from '@/shared/lib/firebase';
import { parseISO } from 'date-fns';
import { nextOccurrence, isScheduleCompleted, resolveUpdatedDueDate } from '../utils/schedule';
import { queueAddExpense, type AddExpenseInput } from '@/features/expenses/services/expensesService';
import type {
  SerializableRecurringPayment, SerializableExpense,
  Currency, RecurringFrequency, RecurringType,
} from '@/shared/types';

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

/** One template by id — the detail screen opened directly by URL has no list in Redux yet. */
export async function fetchRecurringById(
  userId: string,
  id: string,
): Promise<SerializableRecurringPayment | null> {
  const snap = await getDoc(doc(getDb(), 'recurringPayments', userId, 'items', id));
  return snap.exists() ? toSerializable(snap.id, snap.data()) : null;
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

/**
 * Creates a template and, when its start date is today or earlier, its first
 * occurrence — in ONE batch, so saving costs a single round trip.
 *
 * The old flow was three sequential writes (create → expense+stats → advance
 * the due date), which on a phone connection took seconds and looked hung;
 * it also needed a compensating delete when the expense write failed. Here the
 * template is written with the already-advanced due date, so either everything
 * lands or nothing does.
 */
export async function addRecurringWithFirstOccurrence(
  input: AddRecurringInput,
  buildExpense: (recurringId: string, dueDate: Date) => AddExpenseInput,
): Promise<{ recurring: SerializableRecurringPayment; expense: SerializableExpense | null }> {
  const { userId, startDate, endDate, comment, ...rest } = input;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // The occurrence to book is the START date itself when it is today or
  // earlier — «first payment was last Sunday» means that payment happened.
  // (Deciding this from the ADVANCED due date silently skipped it, because
  // advancing a past start jumps straight into the future.)
  const startDay = new Date(startDate);
  startDay.setHours(0, 0, 0, 0);
  const backfillFirst = startDay <= today;

  // Next due is the first occurrence that is still ahead; when the booked one
  // IS today, the template already owes the following one.
  let nextDueDate = firstFutureOrToday(startDate, input.frequency);
  const bookedDay = new Date(nextDueDate);
  bookedDay.setHours(0, 0, 0, 0);
  if (backfillFirst && bookedDay.getTime() === startDay.getTime()) {
    nextDueDate = nextOccurrence(nextDueDate, input.frequency);
  }
  const isActive = !isScheduleCompleted(nextDueDate.toISOString(), endDate?.toISOString());

  const ref = doc(col(userId));
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
    }).filter(([, v]) => v !== undefined),
  );

  const batch = writeBatch(getDb());
  batch.set(ref, data);
  const expense = backfillFirst ? queueAddExpense(batch, buildExpense(ref.id, startDate)) : null;
  await batch.commit();

  return {
    recurring: toSerializable(ref.id, {
      ...data,
      startDate: Timestamp.fromDate(startDate),
      nextDueDate: Timestamp.fromDate(nextDueDate),
    }),
    expense,
  };
}

export async function updateRecurring(
  userId: string,
  id: string,
  input: Omit<AddRecurringInput, 'userId'>,
  /**
   * Where the schedule currently stands. Editing a name must not rewind the
   * calendar: `payRecurringOccurrence` advances `nextDueDate` past the payment that was
   * just booked, and recomputing it from `startDate` would walk right back
   * onto that same date — offering «Оплачено» again and booking the payment
   * twice. Only a change to the start date or the frequency re-derives it.
   */
  current?: { startDate: string; frequency: RecurringFrequency; nextDueDate: string },
): Promise<{ nextDueDate: string; isActive?: false }> {
  const { startDate, endDate, comment, ...rest } = input;
  const nextDueDate = resolveUpdatedDueDate(
    { startDate, frequency: input.frequency },
    current,
    firstFutureOrToday,
  );
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

/** The due date is the concurrency guard; an old screen cannot book it twice. */
export async function payRecurringOccurrence(userId: string, item: SerializableRecurringPayment, amountOverride?: number) {
  return runTransaction(getDb(), async tx => {
    const ref = doc(getDb(), 'recurringPayments', userId, 'items', item.id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('recurring-not-found');
    const current = toSerializable(snap.id, snap.data());
    if (toLocalDateKey(current.nextDueDate) !== toLocalDateKey(item.nextDueDate)) return { recurring: current, expense: null };
    if (!current.isActive) throw new Error('recurring-inactive');
    // Templates saved before a category became mandatory have none. Booking
    // needs a real one, and advancing without an expense would lose the payment.
    if (!current.categoryId) throw new Error('recurring-category-required');
    const amount = amountOverride ?? current.amount;
    const expenseId = `recurring-${item.id}-${toLocalDateKey(current.nextDueDate)}`;
    const existing = await tx.get(doc(getDb(), 'expenses', userId, 'items', expenseId));
    const privacy = await readEntryPrivacy(tx, userId, 'expense', [current.categoryId]);
    const next = nextOccurrence(parseISO(current.nextDueDate), current.frequency);
    const isActive = !isScheduleCompleted(next.toISOString(), current.endDate);
    const expense = existing.exists() ? null : queueAddExpense(tx, {
      userId, amount, currency: current.currency, categoryId: current.categoryId,
      date: parseISO(current.nextDueDate), paymentMethod: 'card', splits: [], tags: ['recurring'],
      privacy, store: current.name, comment: current.comment, recurringId: item.id,
    }, expenseId);
    tx.update(ref, { nextDueDate: Timestamp.fromDate(next), isActive, amount });
    return { recurring: { ...current, amount, nextDueDate: next.toISOString(), isActive }, expense };
  });
}
