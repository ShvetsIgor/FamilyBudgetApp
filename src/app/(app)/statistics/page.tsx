'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { fetchMonthStats, fetchLastNMonths, type MonthStats } from '@/features/stats/services/statsService';
import { saveBudget } from '@/features/budget/services/budgetService';
import { setBudgetLimit } from '@/features/budget/store/budgetSlice';
import { formatAmount, blockInvalidAmountKeys } from '@/shared/utils/currency';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

type Range = 'month' | 'last' | '3m' | '6m';

export default function StatisticsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);
  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const t = useT();

  const RANGES: { value: Range; label: string }[] = [
    { value: 'month', label: t('stats.currentMonth') },
    { value: 'last', label: t('stats.lastMonth') },
    { value: '3m', label: t('stats.threeMonths') },
    { value: '6m', label: t('stats.year') },
  ];

  const [range, setRange] = useState<Range>('month');
  const [stats, setStats] = useState<MonthStats | null>(null);
  const [history, setHistory] = useState<MonthStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (range === 'month') {
        setStats(await fetchMonthStats(user.id, format(new Date(), 'yyyy-MM')));
        setHistory([]);
      } else if (range === 'last') {
        setStats(await fetchMonthStats(user.id, format(subMonths(new Date(), 1), 'yyyy-MM')));
        setHistory([]);
      } else {
        const n = range === '3m' ? 3 : 6;
        const months = await fetchLastNMonths(user.id, n);
        setStats({
          month: `${months[0].month} – ${months[months.length - 1].month}`,
          totalExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
          totalIncome: months.reduce((s, m) => s + m.totalIncome, 0),
          byCategory: months.reduce((acc, m) => {
            for (const [k, v] of Object.entries(m.byCategory)) acc[k] = (acc[k] ?? 0) + v;
            return acc;
          }, {} as Record<string, number>),
        });
        setHistory(months);
      }
    } finally { setLoading(false); }
  }, [user, range]);

  useEffect(() => { load(); }, [load]);

  const pieData = stats
    ? (() => {
        const agg = new Map<string, number>();
        for (const [catId, amount] of Object.entries(stats.byCategory)) {
          const cat = categories.find((c) => c.id === catId);
          const resolvedId = cat?.parentId ?? catId;
          agg.set(resolvedId, (agg.get(resolvedId) ?? 0) + amount);
        }
        return Array.from(agg.entries())
          .map(([catId, amount]) => {
            const cat = categories.find((c) => c.id === catId);
            return { catId, name: t.cat(cat?.name ?? 'Other'), amount, color: cat?.color ?? '#6b7280', icon: cat?.icon ?? '📦' };
          })
          .filter((d) => d.amount > 0)
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 8);
      })()
    : [];

  const barData = history.map((m) => ({
    name: m.month.slice(5),
    expenses: m.totalExpenses,
    income: m.totalIncome,
  }));

  const rawBalance = (stats?.totalIncome ?? 0) - (stats?.totalExpenses ?? 0);
  const balance = Math.abs(rawBalance) < 0.005 ? 0 : rawBalance;
  const showBudget = range === 'month' || range === 'last';

  async function handleSaveBudget(catId: string) {
    if (!user) return;
    const limit = parseFloat(limitInput) || 0;
    setSavingBudget(true);
    try {
      await saveBudget(user.id, catId, limit);
      dispatch(setBudgetLimit({ categoryId: catId, limit }));
      setEditingCatId(null);
      setLimitInput('');
    } finally { setSavingBudget(false); }
  }

  function openBudgetEdit(catId: string) {
    setEditingCatId(catId);
    setLimitInput(budgetLimits[catId]?.toString() ?? '');
  }

  const summaryCards = (
    <div className="grid grid-cols-3 gap-2">
      <SummaryCard label={t('stats.expenses')} value={formatAmount(stats?.totalExpenses ?? 0, currency)} color="text-destructive" />
      <SummaryCard label={t('stats.income')} value={formatAmount(stats?.totalIncome ?? 0, currency)} color="text-emerald-500" />
      <SummaryCard label={t('stats.balance')} value={formatAmount(Math.abs(balance), currency)} color={balance >= 0 ? 'text-emerald-500' : 'text-destructive'} prefix={balance > 0 ? '+' : balance < 0 ? '-' : ''} />
    </div>
  );

  const categoryList = (
    <div className="flex flex-col gap-3">
      {pieData.map((d) => {
        const limit = showBudget ? (budgetLimits[d.catId] ?? 0) : 0;
        const pct = limit > 0 ? Math.min(100, (d.amount / limit) * 100) : 0;
        const overBudget = limit > 0 && d.amount > limit;
        const isEditing = editingCatId === d.catId;
        return (
          <div key={d.catId}>
            <div className="flex items-center gap-2 mb-1">
              <CategoryIcon icon={d.icon} color={d.color} size="sm" />
              <span className="flex-1 text-sm">{d.name}</span>
              <span className="text-sm font-semibold tabular-nums">{formatAmount(d.amount, currency)}</span>
              {showBudget && (
                <button
                  onClick={() => isEditing ? setEditingCatId(null) : openBudgetEdit(d.catId)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full transition-colors',
                    overBudget ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {overBudget ? t('stats.over') : limit > 0 ? `/ ${formatAmount(limit, currency)}` : t('stats.addLimit')}
                </button>
              )}
            </div>
            {limit > 0 && !isEditing && (
              <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-1">
                <div
                  className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            {isEditing && (
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Monthly limit (0 to remove)"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  onKeyDown={blockInvalidAmountKeys}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => handleSaveBudget(d.catId)}
                  disabled={savingBudget}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {savingBudget ? '…' : t('stats.save')}
                </button>
                <button onClick={() => setEditingCatId(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground">
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        );
      })}
      {showBudget && pieData.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1">{t('stats.editHint')}</p>
      )}
    </div>
  );

  const barChart = barData.length > 1 && (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">{t('analytics.trend')}</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={barData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={45} />
          <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
          <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8 lg:px-0 lg:pt-0">
      <h1 className="text-xl font-bold lg:hidden">{t('stats.title')}</h1>

      {/* Range selector — pills (mobile) / tabs (desktop) */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className="shrink-0 rounded-full px-4 py-2 text-[13px] font-extrabold transition-all border-0"
            style={{
              background: range === r.value ? 'hsl(var(--primary))' : 'hsl(var(--card))',
              color: range === r.value ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
              boxShadow: range === r.value ? '0 6px 14px hsl(var(--primary) / .3)' : '0 2px 4px rgba(61,44,31,.06)',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="hidden lg:flex rounded-xl bg-muted p-1 gap-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${range === r.value ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
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
          {/* ── MOBILE layout ── */}
          <div className="lg:hidden flex flex-col gap-4">
            {summaryCards}
            {pieData.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold mb-3">{t('stats.byCategory')}</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                      {pieData.map((entry) => <Cell key={entry.catId} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3">{categoryList}</div>
              </div>
            )}
            {barChart}
            {pieData.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-medium">{t('stats.noData')}</p>
              </div>
            )}
          </div>

          {/* ── DESKTOP layout ── */}
          <div className="hidden lg:flex flex-col gap-4">
            {summaryCards}
            {pieData.length === 0 && (
              <div className="flex flex-col items-center py-16 text-center">
                <p className="text-4xl mb-3">📊</p>
                <p className="font-medium">{t('stats.noData')}</p>
              </div>
            )}
            {pieData.length > 0 && (
              <div className="grid grid-cols-2 gap-4 items-start">
                {/* Left: pie + category list */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h2 className="text-sm font-semibold mb-3">{t('stats.byCategory')}</h2>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55}>
                        {pieData.map((entry) => <Cell key={entry.catId} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4">{categoryList}</div>
                </div>

                {/* Right: bar chart (if available) or category totals */}
                <div className="flex flex-col gap-4">
                  {barChart || (
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <h2 className="text-sm font-semibold mb-4">{t('stats.byCategory')}</h2>
                      <div className="flex flex-col gap-3">
                        {pieData.map((d) => {
                          const pct = stats && stats.totalExpenses > 0 ? (d.amount / stats.totalExpenses) * 100 : 0;
                          return (
                            <div key={d.catId} className="flex items-center gap-3">
                              <CategoryIcon icon={d.icon} color={d.color} size="sm" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm truncate">{d.name}</span>
                                  <span className="text-sm font-semibold tabular-nums ml-2">{formatAmount(d.amount, currency)}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground w-9 text-right shrink-0">{pct.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
