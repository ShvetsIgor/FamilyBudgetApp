import { doc, runTransaction, Timestamp } from 'firebase/firestore';
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
  if (!expense.recurringId || !expense.isRecurring) return null;

  const ref = recurringDoc(userId, expense.recurringId);
  const deletedDueDate = toLocalDateKey(expense.date);
  let result: SerializableRecurringPayment | null = null;

  await runTransaction(getDb(), async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;

    const data = snap.data() as Record<string, unknown>;
    if ((data.isActive as boolean) === false) return;

    const currentNextDue =
      data.nextDueDate instanceof Timestamp
        ? toLocalDateKey(data.nextDueDate.toDate())
        : (data.nextDueDate as string | undefined) ?? deletedDueDate;

    if (deletedDueDate >= currentNextDue) return;

    transaction.update(ref, { nextDueDate: deletedDueDate });
    result = toSerializableRecurring(snap.id, data, deletedDueDate);
  });

  return result;
}
