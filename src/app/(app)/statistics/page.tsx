'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { fetchMonthStats, fetchLastNMonths, type MonthStats } from '@/features/stats/services/statsService';
import { formatAmount } from '@/shared/utils/currency';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

type Range = 'month' | 'last' | '3m' | '6m';

const RANGES: { value: Range; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'last', label: 'Last month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
];

export default function StatisticsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);

  const [range, setRange] = useState<Range>('month');
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [history, setHistory] = useState<MonthStats[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (range === 'month') {
        const s = await fetchMonthStats(user.id, format(new Date(), 'yyyy-MM'));
        setStats(s);
        setHistory([]);
      } else if (range === 'last') {
        const s = await fetchMonthStats(user.id, format(subMonths(new Date(), 1), 'yyyy-MM'));
        setStats(s);
        setHistory([]);
      } else {
        const n = range === '3m' ? 3 : 6;
        const months = await fetchLastNMonths(user.id, n);
        const merged: MonthStats = {
          month: `${months[0].month} – ${months[months.length - 1].month}`,
          totalExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
          totalIncome: months.reduce((s, m) => s + m.totalIncome, 0),
          byCategory: months.reduce((acc, m) => {
            for (const [k, v] of Object.entries(m.byCategory)) {
              acc[k] = (acc[k] ?? 0) + v;
            }
            return acc;
          }, {} as Record<string, number>),
        };
        setStats(merged);
        setHistory(months);
      }
    } finally {
      setLoading(false);
    }
  }, [user, range]);

  useEffect(() => { load(); }, [load]);

  // Pie chart data — top categories
  const pieData = stats
    ? Object.entries(stats.byCategory)
        .map(([catId, amount]) => {
          const cat = categories.find((c) => c.id === catId);
          return { catId, name: cat?.name ?? 'Other', amount, color: cat?.color ?? '#6b7280', icon: cat?.icon ?? '📦' };
        })
        .filter((d) => d.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8)
    : [];

  // Bar chart data
  const barData = history.map((m) => ({
    name: m.month.slice(5), // 'MM'
    expenses: m.totalExpenses,
    income: m.totalIncome,
  }));

  const balance = (stats?.totalIncome ?? 0) - (stats?.totalExpenses ?? 0);

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
      <h1 className="text-xl font-bold">Statistics</h1>

      {/* Range selector */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
              range === r.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-2">
            <SummaryCard label="Expenses" value={formatAmount(stats?.totalExpenses ?? 0, currency)} color="text-destructive" />
            <SummaryCard label="Income" value={formatAmount(stats?.totalIncome ?? 0, currency)} color="text-emerald-500" />
            <SummaryCard label="Balance" value={formatAmount(Math.abs(balance), currency)} color={balance >= 0 ? 'text-emerald-500' : 'text-destructive'} prefix={balance >= 0 ? '+' : '-'} />
          </div>

          {/* Pie chart */}
          {pieData.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">By Category</h2>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="amount"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={50}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.catId} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatAmount(value, currency)}
                    contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex flex-col gap-2 mt-3">
                {pieData.map((d) => (
                  <div key={d.catId} className="flex items-center gap-2">
                    <CategoryIcon icon={d.icon} color={d.color} size="sm" />
                    <span className="flex-1 text-sm">{d.name}</span>
                    <span className="text-sm font-semibold tabular-nums">{formatAmount(d.amount, currency)}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                      {stats && stats.totalExpenses > 0
                        ? `${Math.round((d.amount / stats.totalExpenses) * 100)}%`
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bar chart — multi-month only */}
          {barData.length > 1 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-sm font-semibold mb-3">Monthly Comparison</h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={barData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={45} />
                  <Tooltip
                    formatter={(value: number) => formatAmount(value, currency)}
                    contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }}
                  />
                  <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Empty state */}
          {pieData.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-4xl mb-3">📊</p>
              <p className="font-medium">No data for this period</p>
              <p className="text-sm text-muted-foreground mt-1">Add expenses to see statistics</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, color, prefix = '' }: {
  label: string; value: string; color: string; prefix?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{prefix}{value}</p>
    </div>
  );
}
