'use client';

import { useEffect, useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, parseISO, subMonths, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus, TrendingUp, PiggyBank, ArrowRight, MoreHorizontal } from 'lucide-react';
import {
  BarChart, Bar, XAxis, ResponsiveContainer, Cell,
  LineChart, Line, Tooltip,
} from 'recharts';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setIncome } from '@/features/income/store/incomeSlice';
import { setGoals } from '@/features/savings/store/savingsSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { fetchMonthIncome } from '@/features/income/services/incomeService';
import { fetchGoals } from '@/features/savings/services/savingsService';
import { fetchLastNMonths, type MonthStats } from '@/features/stats/services/statsService';
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
  const currency = useAppSelector((s) => s.ui.currency) as Currency;
  const { list: expenses, status: expStatus } = useAppSelector((s) => s.expenses);
  const { list: incomes, status: incStatus } = useAppSelector((s) => s.income);
  const { list: goals, status: goalsStatus } = useAppSelector((s) => s.savings);
  const expenseCategories = useAppSelector((s) => s.categories.expense);
  const t = useT();

  const [trendData, setTrendData] = useState<MonthStats[]>([]);
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

  const loadTrend = useCallback(async () => {
    if (!user || trendData.length > 0) return;
    const data = await fetchLastNMonths(user.id, 6);
    setTrendData(data);
  }, [user, trendData.length]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);
  useEffect(() => { loadIncome(); }, [loadIncome]);
  useEffect(() => { loadGoals(); }, [loadGoals]);
  useEffect(() => { loadTrend(); }, [loadTrend]);

  const monthExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthIncome = incomes.reduce((s, i) => s + i.amount, 0);
  const balance = monthIncome - monthExpenses;
  const savedPct = monthIncome > 0 ? Math.round(((monthIncome - monthExpenses) / monthIncome) * 100) : 0;

  const daysInMonth = new Date().getDate();
  const avgPerDay = daysInMonth > 0 ? monthExpenses / daysInMonth : 0;

  const recent5 = expenses.slice(0, 5);
  const recent8 = expenses.slice(0, 8);
  const activeGoals = goals.filter((g) => g.currentAmount < g.targetAmount).slice(0, 3);

  // Top spending categories for budget bars
  const topCategories = expenseCategories
    .map((cat) => ({
      cat,
      spent: expenses.filter((e) => e.categoryId === cat.id).reduce((s, e) => s + e.amount, 0),
    }))
    .filter((x) => x.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  const maxSpent = topCategories[0]?.spent ?? 1;

  // Trend chart data
  const chartData = trendData.map((m) => ({
    month: format(parseISO(m.month + '-01'), 'LLL', { locale: ru }),
    value: m.totalExpenses,
    isCurrent: m.month === currentMonth,
  }));

  // Sparkline for avg-day card (last 7 days expense pattern)
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = format(subMonths(new Date(), 0), 'yyyy-MM-') + String(new Date().getDate() - 6 + i).padStart(2, '0');
    const dayExp = expenses.filter((e) => e.date.startsWith(d.slice(0, 10)));
    return { v: dayExp.reduce((s, e) => s + e.amount, 0) };
  });

  const monthLabel = format(new Date(), 'LLLL yyyy', { locale: ru });

  return (
    <>
      {/* ─── MOBILE ─── */}
      <div className="lg:hidden flex flex-col items-center px-4 pt-8 gap-6 pb-8">
        {/* Month summary card */}
        <div className="w-full rounded-[22px] bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20 relative overflow-hidden">
          <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-white/10 pointer-events-none" />
          <p className="text-sm font-medium opacity-80 relative">{monthLabel}</p>
          <div className="mt-1 flex items-baseline gap-2 relative">
            <span className="text-3xl font-black tabular-nums">
              {balance > 0 ? '+' : balance < 0 ? '-' : ''}{formatAmount(Math.abs(balance), currency)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm relative">
            <div>
              <p className="opacity-70">{t('home.income')}</p>
              <p className="font-semibold tabular-nums">+{formatAmount(monthIncome, currency)}</p>
            </div>
            <div className="text-right">
              <p className="opacity-70">{t('home.expenses')}</p>
              <p className="font-semibold tabular-nums">-{formatAmount(monthExpenses, currency)}</p>
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
            <div className="rounded-[22px] border border-border bg-card divide-y divide-border overflow-hidden">
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
            <div className="rounded-[22px] border border-border bg-card p-8 text-center">
              <p className="text-sm text-muted-foreground">{t('home.noExpenses')}</p>
              <Link href="/expenses/new" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
                {t('home.addFirst')}
              </Link>
            </div>
          ) : (
            <div className="rounded-[22px] border border-border bg-card overflow-hidden divide-y divide-border">
              {recent5.map((e) => (
                <ExpenseCard key={e.id} expense={e} onClick={() => router.push(`/expenses/${e.id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── DESKTOP ─── */}
      <div className="hidden lg:flex flex-col gap-4">

        {/* Row 1: Hero balance (2/3) + Avg day (1/3) */}
        <div className="grid grid-cols-3 gap-4">

          {/* Hero balance card */}
          <div className="col-span-2 rounded-[22px] bg-primary text-primary-foreground p-6 relative overflow-hidden shadow-lg shadow-primary/20">
            <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/10 pointer-events-none" />
            <div className="absolute -bottom-12 -right-4 h-48 w-48 rounded-full bg-white/10 pointer-events-none" />
            <div className="relative">
              <p className="text-sm font-medium opacity-75">{t('home.remainingIn')} {monthLabel}</p>
              <p className="mt-1 text-5xl font-black tabular-nums tracking-tight">
                {formatAmount(Math.max(0, balance), currency)}
              </p>
              <div className="mt-5 flex items-center gap-8">
                <div>
                  <p className="text-xs uppercase tracking-widest opacity-60 font-semibold">{t('home.income')}</p>
                  <p className="text-lg font-bold tabular-nums">+{formatAmount(monthIncome, currency)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest opacity-60 font-semibold">{t('home.expenses')}</p>
                  <p className="text-lg font-bold tabular-nums">-{formatAmount(monthExpenses, currency)}</p>
                </div>
                {savedPct > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-semibold">{t('home.saved')}</p>
                    <p className="text-lg font-bold tabular-nums">{savedPct}%</p>
                  </div>
                )}
                <Link
                  href="/statistics"
                  className="ml-auto flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 text-sm font-semibold backdrop-blur-sm"
                >
                  {t('home.details')} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Avg per day card */}
          <div className="rounded-[22px] border border-border bg-card p-5 flex flex-col">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{t('home.avgDay')}</p>
            <p className="mt-2 text-3xl font-black tabular-nums text-foreground">
              {formatAmount(avgPerDay, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('home.thisMonth')}</p>
            <div className="mt-auto pt-4 h-16">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={last7}>
                  <Line
                    type="monotone"
                    dataKey="v"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Tooltip
                    contentStyle={{ display: 'none' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Row 2: Trend chart (2/3) + Upcoming bills (1/3) */}
        <div className="grid grid-cols-3 gap-4 items-start">

          {/* 6-month trend */}
          <div className="col-span-2 rounded-[22px] border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">{t('home.trend6m')}</h2>
              <div className="flex gap-1">
                {([['home.tabMonth', true], ['home.tabQuarter', false], ['home.tabYear', false]] as [string, boolean][]).map(([key, active]) => (
                  <button
                    key={key}
                    className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-36">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap="30%">
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.isCurrent ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                        />
                      ))}
                    </Bar>
                    <Tooltip
                      formatter={(v) => [formatAmount(Number(v ?? 0), currency), '']}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid hsl(var(--border))',
                        background: 'hsl(var(--card))',
                        color: 'hsl(var(--foreground))',
                        fontSize: '12px',
                      }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">{t('stats.noData')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Upcoming bills */}
          <div className="rounded-[22px] border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-bold text-foreground text-sm">{t('home.upcoming')}</h2>
              <Link href="/recurring" className="text-xs text-primary hover:underline flex items-center gap-1">
                {t('home.seeAll')} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <UpcomingBills withinDays={30} maxItems={4} compact />
          </div>
        </div>

        {/* Row 3: Budget categories (left) + Recent transactions (right) */}
        <div className="grid grid-cols-2 gap-4 items-start">

          {/* Budget categories */}
          <div className="rounded-[22px] border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">{t('home.budgetCategories')}</h2>
              <Link href="/statistics" className="text-xs text-primary hover:underline">
                {t('home.manage')}
              </Link>
            </div>
            {topCategories.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">{t('home.noExpenses')}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {topCategories.map(({ cat, spent }) => {
                  const pct = Math.min(100, (spent / maxSpent) * 100);
                  return (
                    <div key={cat.id} className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-sm font-medium truncate">{t.cat(cat.name)}</p>
                            <p className="text-sm font-semibold tabular-nums text-foreground shrink-0 ml-2">
                              {formatAmount(spent, currency)}
                            </p>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, backgroundColor: cat.color || 'hsl(var(--primary))' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent transactions table */}
          <div className="rounded-[22px] border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">{t('home.transactions')}</h2>
              <Link href="/expenses" className="text-xs text-primary hover:underline flex items-center gap-1">
                {t('home.seeAll')} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {recent8.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">{t('home.noExpenses')}</p>
                <Link href="/expenses/new" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                  {t('home.addFirst')}
                </Link>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 px-5 py-2 border-b border-border">
                  {['home.colWhere', 'home.colCategory', 'home.colAmount', 'home.colDate'].map((k) => (
                    <p key={k} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                      {t(k)}
                    </p>
                  ))}
                </div>
                <div className="divide-y divide-border">
                  {recent8.map((e) => {
                    const cat = expenseCategories.find((c) => c.id === e.categoryId);
                    return (
                      <button
                        key={e.id}
                        onClick={() => router.push(`/expenses/${e.id}`)}
                        className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center w-full px-5 py-3 hover:bg-muted/30 transition-colors text-left group"
                      >
                        {/* Where */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          {cat ? (
                            <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                          ) : (
                            <div className="h-8 w-8 rounded-xl bg-muted shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">
                              {e.store || (cat ? t.cat(cat.name) : '—')}
                            </p>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                              <span>{PAYMENT_ICONS[e.paymentMethod]}</span>
                              {e.splits.length > 0 && (
                                <span className="text-primary/70">split · {e.splits.length + 1}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        {/* Category pill */}
                        {cat ? (
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                            style={{ backgroundColor: cat.color + '22', color: cat.color }}
                          >
                            {t.cat(cat.name)}
                          </span>
                        ) : (
                          <span />
                        )}
                        {/* Amount */}
                        <p className="text-sm font-bold tabular-nums text-foreground text-right whitespace-nowrap">
                          -{formatAmount(e.amount, currency)}
                        </p>
                        {/* Date */}
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {format(parseISO(e.date), 'dd MMM')}
                          </p>
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
