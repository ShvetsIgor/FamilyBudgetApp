'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subMonths, parseISO, getDay } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { fetchLastNMonths, type MonthStats } from '@/features/stats/services/statsService';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { formatAmount } from '@/shared/utils/currency';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AnalyticsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);

  const [months, setMonths] = useState<MonthStats[]>([]);
  const [dowData, setDowData] = useState<{ name: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const stats = await fetchLastNMonths(user.id, 6);
      setMonths(stats);

      // Fetch last 2 months of actual expenses for day-of-week analysis
      const [m0, m1] = await Promise.all([
        fetchMonthExpenses(user.id, format(new Date(), 'yyyy-MM')),
        fetchMonthExpenses(user.id, format(subMonths(new Date(), 1), 'yyyy-MM')),
      ]);
      const all = [...m0, ...m1];
      const byDow = Array(7).fill(0);
      for (const e of all) {
        const d = getDay(parseISO(e.date));
        byDow[d] += e.amount;
      }
      setDowData(DOW.map((name, i) => ({ name, amount: Math.round(byDow[i]) })));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Trend bar data
  const trendData = months.map((m) => ({
    name: m.month.slice(5),
    expenses: m.totalExpenses,
    income: m.totalIncome,
  }));

  // Top categories across all months
  const catTotals: Record<string, number> = {};
  for (const m of months) {
    for (const [id, amt] of Object.entries(m.byCategory)) {
      catTotals[id] = (catTotals[id] ?? 0) + amt;
    }
  }
  const topCats = Object.entries(catTotals)
    .map(([id, total]) => {
      const cat = categories.find((c) => c.id === id);
      return { id, total, cat };
    })
    .filter((d) => d.total > 0 && d.cat)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  const totalSpend = topCats.reduce((s, c) => s + c.total, 0);

  // Month-over-month change
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const momChange = thisMonth && lastMonth && lastMonth.totalExpenses > 0
    ? ((thisMonth.totalExpenses - lastMonth.totalExpenses) / lastMonth.totalExpenses) * 100
    : null;

  // Average monthly spend
  const nonZero = months.filter((m) => m.totalExpenses > 0);
  const avgMonthly = nonZero.length
    ? nonZero.reduce((s, m) => s + m.totalExpenses, 0) / nonZero.length
    : 0;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
      <h1 className="text-xl font-bold">Analytics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg / month</p>
          <p className="text-lg font-bold tabular-nums mt-1">{formatAmount(avgMonthly, currency)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">vs last month</p>
          {momChange !== null ? (
            <p className={`text-lg font-bold mt-1 ${momChange > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
              {momChange > 0 ? '+' : ''}{momChange.toFixed(1)}%
            </p>
          ) : (
            <p className="text-lg font-bold mt-1 text-muted-foreground">—</p>
          )}
        </div>
      </div>

      {/* 6-month trend */}
      {trendData.some((d) => d.expenses > 0 || d.income > 0) && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">6-Month Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trendData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={45} />
              <Tooltip
                formatter={(value) => formatAmount(value as number, currency)}
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top categories */}
      {topCats.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Top Categories (6 months)</h2>
          <div className="flex flex-col gap-3">
            {topCats.map(({ id, total, cat }) => {
              const pct = totalSpend > 0 ? (total / totalSpend) * 100 : 0;
              return (
                <div key={id}>
                  <div className="flex items-center gap-2 mb-1">
                    <CategoryIcon icon={cat!.icon} color={cat!.color} size="sm" />
                    <span className="flex-1 text-sm">{cat!.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatAmount(total, currency)}</span>
                    <span className="text-xs text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: cat!.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day of week */}
      {dowData.some((d) => d.amount > 0) && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Spending by Day of Week</h2>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={dowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={45} />
              <Tooltip
                formatter={(value) => formatAmount(value as number, currency)}
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }}
              />
              <Bar dataKey="amount" name="Spent" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {topCats.length === 0 && !loading && (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-4xl mb-3">📈</p>
          <p className="font-medium">Not enough data yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add expenses to see analytics</p>
        </div>
      )}
    </div>
  );
}
