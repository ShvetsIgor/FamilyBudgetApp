'use client';

import { useCallback } from 'react';
import { parseISO } from 'date-fns';
import { useAppDispatch, useAppSelector } from '@/store/store';
import {
  removeRecurringItem, toggleRecurringItem, updateRecurringItem,
} from '@/features/recurring/store/recurringSlice';
import {
  advanceToNextFutureDue, completeRecurring, deleteRecurring, markAsPaid,
  toggleRecurring, updateRecurringAmount,
} from '@/features/recurring/services/recurringService';
import { addExpense } from '@/features/expenses/services/expensesService';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { resolveExpensePrivacy } from '@/features/expenses/utils/expensePrivacy';
import { haptic } from '@/shared/utils/haptics';
import { useT } from '@/shared/hooks/useT';
import type { SerializableRecurringPayment } from '@/shared/types';

/**
 * The write side of a recurring template — shared by the list and the detail
 * screen so a payment is booked by exactly one piece of code.
 *
 * Each action resolves to `true` when it went through, so a caller can react
 * (the detail screen navigates back after a delete). Failures are logged and
 * resolve to `false`; the caller's state is left untouched.
 */
export function useRecurringActions() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const categories = useAppSelector((s) => s.categories.expense);
  const t = useT();

  /** Books the pending occurrence as a real expense and moves the due date on. */
  const markPaid = useCallback(async (
    item: SerializableRecurringPayment,
    amountOverride?: number,
  ): Promise<boolean> => {
    if (!user) return false;
    const amount = amountOverride ?? item.amount;
    if (amount <= 0) return false;
    try {
      if (item.categoryId) {
        const exp = await addExpense({
          userId: user.id, amount, currency: item.currency,
          categoryId: item.categoryId, date: parseISO(item.nextDueDate),
          paymentMethod: 'card', splits: [], tags: ['recurring'],
          privacy: resolveExpensePrivacy({ categories, categoryId: item.categoryId }),
          store: item.name,
          comment: item.comment || undefined,
          recurringId: item.id,
        });
        dispatch(prependExpense(exp));
      }
      // «Сумма изменилась»: the new price sticks to the template from now on
      if (amount !== item.amount) await updateRecurringAmount(user.id, item.id, amount);
      dispatch(updateRecurringItem(await markAsPaid(user.id, { ...item, amount })));
      haptic('success');
      return true;
    } catch (e) {
      console.error('markPaid error:', e);
      return false;
    }
  }, [user, categories, dispatch]);

  /** Skip a missed occurrence without creating an expense. */
  const skip = useCallback(async (item: SerializableRecurringPayment): Promise<boolean> => {
    if (!user) return false;
    try {
      dispatch(updateRecurringItem(await advanceToNextFutureDue(user.id, item)));
      return true;
    } catch (e) {
      console.error('skip error:', e);
      return false;
    }
  }, [user, dispatch]);

  const toggle = useCallback(async (item: SerializableRecurringPayment): Promise<boolean> => {
    if (!user) return false;
    const next = !item.isActive;
    try {
      await toggleRecurring(user.id, item.id, next);
      dispatch(toggleRecurringItem({ id: item.id, isActive: next }));
      return true;
    } catch (e) {
      console.error('toggle error:', e);
      return false;
    }
  }, [user, dispatch]);

  const remove = useCallback(async (item: SerializableRecurringPayment): Promise<boolean> => {
    if (!user || !confirm(`${t('recurring.confirmDelete')} "${item.name}"?`)) return false;
    try {
      await deleteRecurring(user.id, item.id);
      dispatch(removeRecurringItem(item.id));
      return true;
    } catch (e) {
      console.error('remove error:', e);
      return false;
    }
  }, [user, dispatch, t]);

  /** «Я отменил подписку» — nothing more is due; the template stays as «Завершено». */
  const finish = useCallback(async (item: SerializableRecurringPayment): Promise<boolean> => {
    if (!user || !confirm(t('recurring.confirmFinish'))) return false;
    try {
      const { endDate } = await completeRecurring(user.id, item.id);
      dispatch(updateRecurringItem({ ...item, endDate, isActive: false }));
      return true;
    } catch (e) {
      console.error('finish error:', e);
      return false;
    }
  }, [user, dispatch, t]);

  return { markPaid, skip, toggle, remove, finish };
}
