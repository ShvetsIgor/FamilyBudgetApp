'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, TrendingUp } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { UpcomingBills } from '@/features/recurring/components/UpcomingBills';
import { formatAmount, getCurrencySymbol } from '@/shared/utils/currency';

export default function HomePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const symbol = getCurrencySymbol(currency);
  const { list: expenses, status } = useAppSelector((s) => s.expenses);

  const currentMonth = format(new Date(), 'yyyy-MM');

  const load = useCallback(async () => {
    if (!user || status !== 'idle') return;
    const data = await fetchMonthExpenses(user.id, currentMonth);
    dispatch(setExpenses(data));
  }, [user, currentMonth, status, dispatch]);

  useEffect(() => { load(); }, [load]);

  const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const recent = expenses.slice(0, 5);

  return (
    <div className="flex flex-col items-center px-4 pt-8 gap-6">
      {/* Month summary card */}
      <div className="w-full rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <p className="text-sm font-medium opacity-80">{format(new Date(), 'MMMM yyyy')}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          -{formatAmount(monthExpenses, currency)}
        </p>
        <div className="mt-4 flex justify-between text-sm">
          <div>
            <p className="opacity-70">Expenses</p>
            <p className="font-semibold tabular-nums">{symbol}{monthExpenses.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <p className="opacity-70">Transactions</p>
            <p className="font-semibold">{expenses.length}</p>
          </div>
        </div>
      </div>

      {/* Quick add buttons */}
      <div className="flex items-end gap-10">
        <div className="flex flex-col items-center gap-2">
          <Link href="/expenses?tab=income">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md active:scale-95 transition-transform">
              <TrendingUp className="h-6 w-6" />
            </div>
          </Link>
          <p className="text-xs text-muted-foreground">Income</p>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Link href="/expenses/new">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 active:scale-95 transition-transform">
              <Plus className="h-9 w-9" />
            </div>
          </Link>
          <p className="text-sm text-muted-foreground">Expense</p>
        </div>

        <div className="w-14" />
      </div>

      {/* Upcoming bills */}
      <UpcomingBills withinDays={7} maxItems={3} compact />

      {/* Recent expenses */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent</h2>
          {expenses.length > 5 && (
            <Link href="/expenses" className="text-xs text-primary hover:underline">
              See all
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No expenses yet</p>
            <Link href="/expenses/new" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              Add your first expense →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
            {recent.map((e) => (
              <ExpenseCard key={e.id} expense={e} onClick={() => router.push(`/expenses/${e.id}`)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
