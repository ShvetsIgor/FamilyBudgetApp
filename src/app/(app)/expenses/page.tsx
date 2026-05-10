'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses, prependExpense } from '@/features/expenses/store/expensesSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { formatAmount } from '@/shared/utils/currency';
import type { SerializableExpense } from '@/shared/types';

function groupByDate(expenses: SerializableExpense[]): [string, SerializableExpense[]][] {
  const map = new Map<string, SerializableExpense[]>();
  for (const e of expenses) {
    const day = e.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(e);
  }
  return Array.from(map.entries());
}

function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d');
}

export default function ExpensesPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list, status } = useAppSelector((s) => s.expenses);
  const [loading, setLoading] = useState(false);

  const currentMonth = format(new Date(), 'yyyy-MM');

  const load = useCallback(async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const expenses = await fetchMonthExpenses(user.id, currentMonth);
      dispatch(setExpenses(expenses));
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, dispatch]);

  useEffect(() => {
    if (status === 'idle') load();
  }, [status, load]);

  const groups = groupByDate(list);
  const monthTotal = list.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col">
      {/* Month header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold text-destructive">
            -{formatAmount(monthTotal, currency)}
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && list.length === 0 && (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {/* Empty */}
      {!loading && list.length === 0 && (
        <div className="flex flex-col items-center py-16 px-8 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No expenses this month</p>
          <p className="text-sm text-muted-foreground mt-1">Tap + to add your first expense</p>
        </div>
      )}

      {/* Groups */}
      <div className="flex flex-col gap-2 pb-4">
        {groups.map(([day, expenses]) => {
          const dayTotal = expenses.reduce((s, e) => s + e.amount, 0);
          return (
            <div key={day} className="rounded-2xl bg-card border border-border overflow-hidden mx-4">
              {/* Day header */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {dateLabel(day)}
                </span>
                <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                  -{formatAmount(dayTotal, currency)}
                </span>
              </div>

              {/* Expense rows */}
              <div className="divide-y divide-border">
                {expenses.map((e) => (
                  <ExpenseCard
                    key={e.id}
                    expense={e}
                    onClick={() => router.push(`/expenses/${e.id}`)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
