'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subMonths } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { fetchMonthStats, fetchLastNMonths, type MonthStats } from '@/features/stats/services/statsService';
import { saveBudget } from '@/features/budget/services/budgetService';
import { setBudgetLimit } from '@/features/budget/store/budgetSlice';
import { formatAmount, blockInvalidAmountKeys } from '@/shared/utils/currency';
import { aggregateTopCategories } from '@/features/categories/utils/statsAggregation';
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

  // Stats aggregate by categoryId only — folders are UI-only and must not affect domain/analytics layer
  const parentPieData = stats
    ? aggregateTopCategories([stats], categories, 8).map((item) => ({
        catId: item.catId,
        name: t.cat(item.name),
        amount: item.total,
        color: item.color,
        icon: item.icon,
      }))
    : [];

  const pieData = parentPieData;

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
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <CategoryIcon icon={d.icon} color={d.color} size="sm" />
              <span className="min-w-0 flex-1 basis-[48%] text-sm leading-tight line-clamp-2 [overflow-wrap:anywhere]">{d.name}</span>
              <span className="text-sm font-semibold tabular-nums shrink-0">{formatAmount(d.amount, currency)}</span>
              {showBudget && (
                <button
                  onClick={() => isEditing ? setEditingCatId(null) : openBudgetEdit(d.catId)}
                  className={cn(
                    'max-w-full shrink-0 text-xs px-2 py-0.5 rounded-full transition-colors',
                    overBudget ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {overBudget ? `−${formatAmount(d.amount - limit, currency)}` : limit > 0 ? `/ ${formatAmount(limit, currency)}` : t('stats.addLimit')}
                </button>
              )}
            </div>
            {limit > 0 && !isEditing && (
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', pct >= 100 ? 'bg-destructive' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <span className={cn('text-[10px] font-bold w-8 text-right shrink-0 tabular-nums', pct >= 100 ? 'text-destructive' : pct >= 80 ? 'text-amber-500' : 'text-muted-foreground')}>
                  {pct.toFixed(0)}%
                </span>
              </div>
            )}
            {isEditing && (
              <div className="grid grid-cols-2 gap-2 mt-1.5 sm:flex sm:items-center">
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder={t('stats.limitPlaceholder')}
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  onKeyDown={blockInvalidAmountKeys}
                  className="col-span-2 min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 sm:flex-1 sm:py-1.5"
                />
                <button
                  onClick={() => handleSaveBudget(d.catId)}
                  disabled={savingBudget}
                  className="min-w-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:py-1.5"
                >
                  {savingBudget ? '…' : t('stats.save')}
                </button>
                <button onClick={() => setEditingCatId(null)} className="min-w-0 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground sm:py-1.5">
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
    <div className="rounded-[22px] border border-border bg-card p-4 hover:scale-[1.005] transition-transform" style={{ boxShadow: '0 2px 8px rgba(61,44,31,.04)' }}>
      <h2 className="text-sm font-bold mb-3">{t('analytics.trend')}</h2>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={barData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={45} />
          <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))' }} />
          <Bar dataKey="expenses" name={t('stats.expenses')} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="income" name={t('stats.income')} fill="#10b981" radius={[4, 4, 0, 0]} />
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
              <div className="rounded-[22px] border border-border bg-card p-4" style={{ boxShadow: '0 2px 8px rgba(61,44,31,.04)' }}>
                <h2 className="text-sm font-bold mb-3">{t('stats.byCategory')}</h2>
                <ResponsiveContainer width="100%" height={210}>
                  <PieChart>
                    <Pie data={pieData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={88} innerRadius={62} paddingAngle={2}>
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
                <div className="rounded-[22px] border border-border bg-card p-5 hover:scale-[1.005] transition-transform" style={{ boxShadow: '0 2px 8px rgba(61,44,31,.04)' }}>
                  <h2 className="text-sm font-bold mb-3">{t('stats.byCategory')}</h2>
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie data={pieData} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={68} paddingAngle={2}>
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
    <div className="rounded-[18px] border border-border bg-card p-3 flex flex-col gap-1 hover:scale-[1.02] transition-transform cursor-default" style={{ boxShadow: '0 1px 4px rgba(61,44,31,.05)' }}>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[.06em]">{label}</p>
      <p className={`text-base font-black tabular-nums leading-tight ${color}`}>{prefix}{value}</p>
    </div>
  );
}
