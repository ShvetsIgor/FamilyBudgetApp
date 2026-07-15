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
    const currentNextDue =
      data.nextDueDate instanceof Timestamp
        ? toLocalDateKey(data.nextDueDate.toDate())
        : (data.nextDueDate as string | undefined) ?? deletedDueDate;

    // Distinguish a fixed-term template that auto-completed (endDate passed)
    // from a manual pause: the former is reactivated when its generated
    // expense is deleted, the latter stays untouched.
    const endDue =
      data.endDate instanceof Timestamp
        ? toLocalDateKey(data.endDate.toDate())
        : (data.endDate as string | undefined);
    const isInactive = (data.isActive as boolean) === false;
    const autoCompleted = isInactive && !!endDue && currentNextDue > endDue;
    if (isInactive && !autoCompleted) return;

    if (deletedDueDate >= currentNextDue) return;

    transaction.update(ref, {
      nextDueDate: deletedDueDate,
      ...(autoCompleted ? { isActive: true } : {}),
    });
    result = { ...toSerializableRecurring(snap.id, data, deletedDueDate), isActive: true };
  });

  return result;
}
