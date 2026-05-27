import { doc, getDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { getDb } from '@/shared/lib/firebase';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import type { SerializableExpense, SerializableRecurringPayment, RecurringType, RecurringFrequency, Currency } from '@/shared/types';

function recurringDoc(userId: string, recurringId: string) {
  return doc(getDb(), 'recurringPayments', userId, 'items', recurringId);
}

function toSerializableRecurring(
  id: string,
  data: Record<string, unknown>,
  nextDueDate: string,
): SerializableRecurringPayment {
  const toISO = (value: unknown) =>
    value instanceof Timestamp ? value.toDate().toISOString() : (value as string) ?? new Date().toISOString();

  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    amount: data.amount as number,
    currency: data.currency as Currency,
    categoryId: data.categoryId as string,
    frequency: data.frequency as RecurringFrequency,
    startDate: toISO(data.startDate),
    endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : (data.endDate as string | undefined),
    nextDueDate,
    type: data.type as RecurringType,
    typeLabel: data.typeLabel as string | undefined,
    reminderDays: (data.reminderDays as number) ?? 0,
    comment: data.comment as string | undefined,
    isActive: (data.isActive as boolean) ?? true,
  };
}

export async function restoreRecurringDueFromDeletedExpense(
  userId: string,
  expense: SerializableExpense,
): Promise<SerializableRecurringPayment | null> {
  if (!expense.recurringId || !expense.isRecurring) {
    return null;
  }

  const ref = recurringDoc(userId, expense.recurringId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }

  const data = snap.data() as Record<string, unknown>;
  if ((data.isActive as boolean) === false) {
    return null;
  }

  const deletedDueDate = format(new Date(expense.date), 'yyyy-MM-dd');
  const currentNextDue =
    data.nextDueDate instanceof Timestamp
      ? format(data.nextDueDate.toDate(), 'yyyy-MM-dd')
      : (data.nextDueDate as string | undefined) ?? deletedDueDate;

  if (deletedDueDate >= currentNextDue) {
    return null;
  }

  await updateDoc(ref, { nextDueDate: deletedDueDate });
  return toSerializableRecurring(snap.id, data, deletedDueDate);
}
