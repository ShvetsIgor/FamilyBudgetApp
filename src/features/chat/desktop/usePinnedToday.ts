'use client';
import { useAppSelector } from '@/store/store';

export function usePinnedToday() {
  const expenses = useAppSelector((s) => s.expenses.list ?? []);
  const currency = useAppSelector((s) => s.ui.currency);
  const dailyLimit = useAppSelector((s) => s.ui.budgetDailyLimit);
  const today = new Date().toDateString();
  const todayExpenses = expenses.filter(
    (expense) => expense.currency === currency && new Date(expense.date).toDateString() === today,
  );
  const spent = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const left = dailyLimit > 0 ? dailyLimit - spent : null;
  const pct = dailyLimit > 0 ? Math.min(100, Math.round((spent / dailyLimit) * 100)) : null;
  return { spent, left, pct, dailyLimit, todayExpenses };
}
