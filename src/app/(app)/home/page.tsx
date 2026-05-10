'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Plus, TrendingUp, PiggyBank } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setIncome } from '@/features/income/store/incomeSlice';
import { setGoals } from '@/features/savings/store/savingsSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { fetchMonthIncome } from '@/features/income/services/incomeService';
import { fetchGoals } from '@/features/savings/services/savingsService';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { UpcomingBills } from '@/features/recurring/components/UpcomingBills';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';

export default function HomePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: expenses, status: expStatus } = useAppSelector((s) => s.expenses);
  const { list: incomes, status: incStatus } = useAppSelector((s) => s.income);
  const { list: goals, status: goalsStatus } = useAppSelector((s) => s.savings);
  const t = useT();

  const currentMonth = format(new Date(), 'yyyy-MM');

  const loadExpenses = useCallback(async () => {
    if (!user || expStatus !== 'idle') return;
    const data = await fetchMonthExpenses(user.id, currentMonth);
    dispatch(setExpenses(data));
  }, [user, currentMonth, expStatus, dispatch]);

  const loadIncome = useCallback(async () => {
    if (!user || incStatus !== 'idle') return;
    const data = await fetchMonthIncome(user.id, currentMonth);
    dispatch(setIncome(data));
  }, [user, currentMonth, incStatus, dispatch]);

  const loadGoals = useCallback(async () => {
    if (!user || goalsStatus !== 'idle') return;
    const data = await fetchGoals(user.id);
    dispatch(setGoals(data));
  }, [user, goalsStatus, dispatch]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);
  useEffect(() => { loadIncome(); }, [loadIncome]);
  useEffect(() => { loadGoals(); }, [loadGoals]);

  const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const rawBalance = monthIncome - monthExpenses;
  const balance = Math.abs(rawBalance) < 0.005 ? 0 : rawBalance;
  const recent = expenses.slice(0, 5);

  const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount).slice(0, 3);

  return (
    <div className="flex flex-col items-center px-4 pt-8 gap-6 pb-8">
      {/* Month summary card */}
      <div className="w-full rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <p className="text-sm font-medium opacity-80">{format(new Date(), 'MMMM yyyy')}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">
            {balance > 0 ? '+' : balance < 0 ? '-' : ''}{formatAmount(Math.abs(balance), currency)}
          </span>
          <span className="text-sm opacity-70">{t('home.balance')}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="opacity-70">{t('home.income')}</p>
            <p className="font-semibold tabular-nums text-emerald-300">
              {monthIncome > 0 ? '+' : ''}{formatAmount(monthIncome, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="opacity-70">{t('home.expenses')}</p>
            <p className="font-semibold tabular-nums">
              {monthExpenses > 0 ? '-' : ''}{formatAmount(monthExpenses, currency)}
            </p>
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

        <div className="flex flex-col items-center gap-2">
          <Link href="/savings">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-md active:scale-95 transition-transform">
              <PiggyBank className="h-6 w-6" />
            </div>
          </Link>
          <p className="text-xs text-muted-foreground">Savings</p>
        </div>
      </div>

      {/* Upcoming bills */}
      <UpcomingBills withinDays={7} maxItems={3} compact />

      {/* Savings goals mini-progress */}
      {activeGoals.length > 0 && (
        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t('home.savingsGoals')}</h2>
            <Link href="/savings" className="text-xs text-primary hover:underline">{t('home.seeAll')}</Link>
          </div>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {activeGoals.map((g) => {
              const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
              return (
                <div key={g.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      <span>{g.icon}</span>
                      <span>{g.name}</span>
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatAmount(g.currentAmount, currency)} / {formatAmount(g.targetAmount, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent expenses */}
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('home.recent')}</h2>
          {expenses.length > 5 && (
            <Link href="/expenses" className="text-xs text-primary hover:underline">
              {t('home.seeAll')}
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{t('home.noExpenses')}</p>
            <Link href="/expenses/new" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
              {t('home.addFirst')}
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
