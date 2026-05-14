'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subMonths, parseISO, getDay } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { fetchLastNMonths, type MonthStats } from '@/features/stats/services/statsService';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

// Mon-first order: indices into JS getDay() (0=Sun,1=Mon,...,6=Sat)
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export default function AnalyticsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);
  const [months, setMonths] = useState<MonthStats[]>([]);
  const [dowData, setDowData] = useState<{ name: string; amount: number }[]>([]);
  const t = useT();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const stats = await fetchLastNMonths(user.id, 6);
      setMonths(stats);
      const [m0, m1] = await Promise.all([
        fetchMonthExpenses(user.id, format(new Date(), 'yyyy-MM')),
        fetchMonthExpenses(user.id, format(subMonths(new Date(), 1), 'yyyy-MM')),
      ]);
      const byDow = Array(7).fill(0);
      for (const e of [...m0, ...m1]) byDow[getDay(parseISO(e.date))] += e.amount;
      setDowData(DOW_ORDER.map((dayIdx, i) => ({ name: DOW_NAMES[i], amount: Math.round(byDow[dayIdx]) })));
    } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const trendData = months.map((m) => ({ name: m.month.slice(5), expenses: m.totalExpenses, income: m.totalIncome }));

  const catTotals: Record<string, number> = {};
  for (const m of months) {
    for (const [id, amt] of Object.entries(m.byCategory)) {
      const cat = categories.find((c) => c.id === id);
      const resolvedId = cat?.parentId ?? id;
      catTotals[resolvedId] = (catTotals[resolvedId] ?? 0) + amt;
    }
  }
  const topCats = Object.entries(catTotals)
    .map(([id, total]) => ({ id, total, cat: categories.find((c) => c.id === id) }))
    .filter((d) => d.total > 0 && d.cat)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const totalSpend = topCats.reduce((s, c) => s + c.total, 0);
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const momChange = thisMonth && lastMonth && lastMonth.totalExpenses > 0
    ? ((thisMonth.totalExpenses - lastMonth.totalExpenses) / lastMonth.totalExpenses) * 100
    : null;
  const nonZero = months.filter((m) => m.totalExpenses > 0);
  const avgMonthly = nonZero.length ? nonZero.reduce((s, m) => s + m.totalExpenses, 0) / nonZero.length : 0;
  const bestMonth = months.length ? months.reduce((best, m) => m.totalIncome - m.totalExpenses > (best.totalIncome - best.totalExpenses) ? m : best, months[0]) : null;

  const hasTrendData = trendData.some((d) => d.expenses > 0 || d.income > 0);
  const hasDowData = dowData.some((d) => d.amount > 0);

  const tooltipStyle = { borderRadius: 12, border: '1px solid hsl(var(--border))' };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  const statCards = (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">{t('analytics.avgMonth')}</p>
        <p className="text-lg font-bold tabular-nums mt-1">{formatAmount(avgMonthly, currency)}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">{t('analytics.vsLastMonth')}</p>
        {momChange !== null ? (
          <p className={`text-lg font-bold mt-1 ${momChange > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
            {momChange > 0 ? '+' : ''}{momChange.toFixed(1)}%
          </p>
        ) : (
          <p className="text-lg font-bold mt-1 text-muted-foreground">—</p>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">{t('analytics.totalSpend6m')}</p>
        <p className="text-lg font-bold tabular-nums mt-1">{formatAmount(totalSpend, currency)}</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">{t('analytics.bestMonth')}</p>
        <p className="text-lg font-bold mt-1 text-emerald-500">{bestMonth ? bestMonth.month.slice(5) : '—'}</p>
      </div>
    </div>
  );

  const trendChart = hasTrendData && (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">{t('analytics.trend')}</h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={trendData} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={45} />
          <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={tooltipStyle} />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const topCatsCard = topCats.length > 0 && (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">{t('analytics.topCategories')}</h2>
      <div className="flex flex-col gap-3">
        {topCats.map(({ id, total, cat }) => {
          const pct = totalSpend > 0 ? (total / totalSpend) * 100 : 0;
          return (
            <div key={id}>
              <div className="flex items-center gap-2 mb-1">
                <CategoryIcon icon={cat!.icon} color={cat!.color} size="sm" />
                <span className="flex-1 text-sm">{t.cat(cat!.name)}</span>
                <span className="text-sm font-semibold tabular-nums">{formatAmount(total, currency)}</span>
                <span className="text-xs text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat!.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const dowChart = hasDowData && (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">{t('analytics.byDow')}</h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={dowData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={45} />
          <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={tooltipStyle} />
          <Bar dataKey="amount" name="Spent" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (topCats.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 lg:px-0 lg:pt-0">
        <h1 className="text-xl font-bold lg:hidden">{t('analytics.title')}</h1>
        {statCards}
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-4xl mb-3">📈</p>
          <p className="font-medium">{t('analytics.noData')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('analytics.addMore')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8 lg:px-0 lg:pt-0">
      <h1 className="text-xl font-bold lg:hidden">{t('analytics.title')}</h1>

      {statCards}

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden flex flex-col gap-4">
        {trendChart}
        {topCatsCard}
        {dowChart}
      </div>

      {/* ── DESKTOP layout ── */}
      <div className="hidden lg:flex flex-col gap-4">
        {(hasTrendData || topCats.length > 0) && (
          <div className="grid grid-cols-3 gap-4 items-start">
            <div className="col-span-2 flex flex-col gap-4">
              {trendChart}
              {dowChart}
            </div>
            <div>{topCatsCard}</div>
          </div>
        )}
      </div>
    </div>
  );
}
