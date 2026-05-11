'use client';

import { useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Plus, TrendingUp, PiggyBank, ArrowRight, TrendingDown } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setIncome } from '@/features/income/store/incomeSlice';
import { setGoals } from '@/features/savings/store/savingsSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { fetchMonthIncome } from '@/features/income/services/incomeService';
import { fetchGoals } from '@/features/savings/services/savingsService';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { UpcomingBills } from '@/features/recurring/components/UpcomingBills';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import type { Currency, SerializableExpense } from '@/shared/types';

const PAYMENT_ICONS: Record<string, string> = { card: '💳', cash: '💵', other: '🔄' };

export default function HomePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: expenses, status: expStatus } = useAppSelector((s) => s.expenses);
  const { list: incomes, status: incStatus } = useAppSelector((s) => s.income);
  const { list: goals, status: goalsStatus } = useAppSelector((s) => s.savings);
  const expenseCategories = useAppSelector((s) => s.categories.expense);
  const t = useT();

  const currentMonth = format(new Date(), 'yyyy-MM');

  const loadExpenses = useCallback(async () => {
    if (!user || expStatus !== 'idle') return;
    dispatch(setExpenses(await fetchMonthExpenses(user.id, currentMonth)));
  }, [user, currentMonth, expStatus, dispatch]);

  const loadIncome = useCallback(async () => {
    if (!user || incStatus !== 'idle') return;
    dispatch(setIncome(await fetchMonthIncome(user.id, currentMonth)));
  }, [user, currentMonth, incStatus, dispatch]);

  const loadGoals = useCallback(async () => {
    if (!user || goalsStatus !== 'idle') return;
    dispatch(setGoals(await fetchGoals(user.id)));
  }, [user, goalsStatus, dispatch]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);
  useEffect(() => { loadIncome(); }, [loadIncome]);
  useEffect(() => { loadGoals(); }, [loadGoals]);

  const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const rawBalance = monthIncome - monthExpenses;
  const balance = Math.abs(rawBalance) < 0.005 ? 0 : rawBalance;
  const recent5 = expenses.slice(0, 5);
  const recent8 = expenses.slice(0, 8);
  const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount).slice(0, 3);

  return (
    <>
      {/* ─── MOBILE ─── */}
      <div className="lg:hidden flex flex-col items-center px-4 pt-8 gap-6 pb-8">
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

        {/* Quick add */}
        <div className="flex items-end gap-10">
          <div className="flex flex-col items-center gap-2">
            <Link href="/expenses?tab=income">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md active:scale-95 transition-transform">
                <TrendingUp className="h-6 w-6" />
              </div>
            </Link>
            <p className="text-xs text-muted-foreground">{t('home.income')}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Link href="/expenses/new">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 active:scale-95 transition-transform">
                <Plus className="h-9 w-9" />
              </div>
            </Link>
            <p className="text-sm text-muted-foreground">{t('home.expenses')}</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Link href="/savings">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-white shadow-md active:scale-95 transition-transform">
                <PiggyBank className="h-6 w-6" />
              </div>
            </Link>
            <p className="text-xs text-muted-foreground">{t('home.savingsGoals')}</p>
          </div>
        </div>

        <UpcomingBills withinDays={7} maxItems={3} compact />

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
                        <span>{g.icon}</span><span>{g.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatAmount(g.currentAmount, currency)} / {formatAmount(g.targetAmount, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="w-full">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground">{t('home.recent')}</h2>
            {expenses.length > 5 && (
              <Link href="/expenses" className="text-xs text-primary hover:underline">{t('home.seeAll')}</Link>
            )}
          </div>
          {recent5.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">{t('home.noExpenses')}</p>
              <Link href="/expenses/new" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                {t('home.addFirst')}
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
              {recent5.map((e) => (
                <ExpenseCard key={e.id} expense={e} onClick={() => router.push(`/expenses/${e.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── DESKTOP ─── */}
      <div className="hidden lg:flex flex-col gap-6">
        {/* Stat cards row */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label={t('home.balance')}
            value={`${balance > 0 ? '+' : balance < 0 ? '-' : ''}${formatAmount(Math.abs(balance), currency)}`}
            sub={format(new Date(), 'MMMM yyyy')}
            accent="primary"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            label={t('home.income')}
            value={`+${formatAmount(monthIncome, currency)}`}
            sub={t('home.thisMonth')}
            accent="emerald"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            label={t('home.expenses')}
            value={`-${formatAmount(monthExpenses, currency)}`}
            sub={t('home.thisMonth')}
            accent="rose"
            icon={<TrendingDown className="h-5 w-5" />}
          />
        </div>

        {/* Main 2-col grid */}
        <div className="grid grid-cols-3 gap-6 items-start">
          {/* Recent transactions — 2/3 width */}
          <div className="col-span-2 rounded-2xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-foreground">{t('home.recent')}</h2>
              <Link href="/expenses" className="flex items-center gap-1 text-xs text-primary hover:underline">
                {t('home.seeAll')} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {recent8.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-muted-foreground">{t('home.noExpenses')}</p>
                <Link href="/expenses/new" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                  {t('home.addFirst')}
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recent8.map((e) => (
                  <DesktopTransactionRow
                    key={e.id}
                    expense={e}
                    category={expenseCategories.find((c) => c.id === e.categoryId)}
                    currency={currency}
                    onClick={() => router.push(`/expenses/${e.id}`)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar — 1/3 width */}
          <div className="flex flex-col gap-4">
            <UpcomingBills withinDays={7} maxItems={5} compact />

            {activeGoals.length > 0 && (
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold">{t('home.savingsGoals')}</h2>
                  <Link href="/savings" className="text-xs text-primary hover:underline">{t('home.seeAll')}</Link>
                </div>
                <div className="divide-y divide-border">
                  {activeGoals.map((g) => {
                    const pct = Math.min(100, (g.currentAmount / g.targetAmount) * 100);
                    return (
                      <div key={g.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium flex items-center gap-1.5">
                            <span>{g.icon}</span><span className="truncate max-w-[120px]">{g.name}</span>
                          </span>
                          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                            {Math.round(pct)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                          {formatAmount(g.currentAmount, currency)} / {formatAmount(g.targetAmount, currency)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Desktop sub-components ───────────────────────────────────────────────────

function StatCard({ label, value, sub, accent, icon }: {
  label: string;
  value: string;
  sub: string;
  accent: 'primary' | 'emerald' | 'rose';
  icon: React.ReactNode;
}) {
  const bg = accent === 'primary' ? 'bg-primary/10 text-primary' : accent === 'emerald' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400';
  const val = accent === 'primary' ? 'text-foreground' : accent === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${val}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function DesktopTransactionRow({ expense, category, currency, onClick, t }: {
  expense: SerializableExpense;
  category: { icon: string; color: string; name: string } | undefined;
  currency: Currency;
  onClick: () => void;
  t: ReturnType<typeof useT>;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-4 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
    >
      {category ? (
        <CategoryIcon icon={category.icon} color={category.color} size="md" />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {expense.store || (category ? t.cat(category.name) : 'Expense')}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {category ? t.cat(category.name) : '—'}
        </p>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(parseISO(expense.date), 'dd MMM')}
        </span>
        <span className="text-sm w-5 text-center">{PAYMENT_ICONS[expense.paymentMethod]}</span>
        <span className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400 min-w-[80px] text-right">
          -{formatAmount(expense.amount, currency)}
        </span>
      </div>
    </button>
  );
}
