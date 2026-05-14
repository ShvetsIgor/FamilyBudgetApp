'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, subMonths, parseISO, getDay, startOfWeek, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppSelector } from '@/store/store';
import { fetchLastNMonths, type MonthStats } from '@/features/stats/services/statsService';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Period = 3 | 6 | 9 | 12;

interface DowPoint {
  name: string;
  shortDate: string;
  isoDate: string;
  amount: number;
}

export default function AnalyticsPage() {
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const weekStart = useAppSelector((s) => s.ui.weekStart);
  const categories = useAppSelector((s) => s.categories.expense);
  const [period, setPeriod] = useState<Period>(6);
  const [months, setMonths] = useState<MonthStats[]>([]);
  const [dowData, setDowData] = useState<DowPoint[]>([]);
  const t = useT();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const stats = await fetchLastNMonths(user.id, period);
      setMonths(stats);

      // Fetch expenses for current + last month (for DOW current-week data)
      const [m0, m1] = await Promise.all([
        fetchMonthExpenses(user.id, format(new Date(), 'yyyy-MM')),
        fetchMonthExpenses(user.id, format(subMonths(new Date(), 1), 'yyyy-MM')),
      ]);
      const allExpenses = [...m0, ...m1];

      // Build current week: 7 days starting from weekStart
      const today = new Date();
      const weekStartDay = weekStart === 'monday' ? 1 : 0;
      const weekBegin = startOfWeek(today, { weekStartsOn: weekStartDay as 0 | 1 });

      const points: DowPoint[] = Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekBegin, i);
        const isoDate = format(day, 'yyyy-MM-dd');
        const dayTotal = allExpenses
          .filter((e) => e.date.startsWith(isoDate))
          .reduce((s, e) => s + e.amount, 0);
        return {
          name: format(day, 'EEE', { locale: ru }),
          shortDate: format(day, 'd MMM', { locale: ru }),
          isoDate,
          amount: Math.round(dayTotal),
        };
      });
      setDowData(points);
    } finally { setLoading(false); }
  }, [user, period, weekStart]);

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

  const daysInMonth = new Date().getDate();
  const avgDaily = daysInMonth > 0 ? (thisMonth?.totalExpenses ?? 0) / daysInMonth : 0;

  // Period selector (shared)
  const periodSelector = (
    <div className="flex gap-2 flex-wrap">
      {([3, 6, 9, 12] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => setPeriod(p)}
          className="rounded-full px-3.5 py-1.5 text-[13px] font-extrabold transition-all border-0"
          style={{
            background: period === p ? 'hsl(var(--primary))' : 'hsl(var(--card))',
            color: period === p ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
            boxShadow: period === p ? '0 4px 12px hsl(var(--primary) / .3)' : '0 1px 3px rgba(61,44,31,.06)',
          }}
        >
          {p} {t('analytics.months')}
        </button>
      ))}
    </div>
  );

  const mobileHeroCard = (
    <div className="rounded-[22px] bg-card p-5" style={{ boxShadow: '0 2px 6px rgba(61,44,31,.04)' }}>
      <p className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">{t('analytics.avgDay')}</p>
      <p className="text-[36px] font-black tabular-nums text-foreground mt-1 leading-none tracking-[-0.025em]">
        {formatAmount(avgDaily, currency)}
      </p>
      {momChange !== null && (
        <p className={`text-[13px] font-bold mt-2 ${momChange > 0 ? 'text-destructive' : 'text-emerald-500'}`}>
          {momChange > 0 ? '↑' : '↓'} {Math.abs(momChange).toFixed(0)}% {t('analytics.vsLastMonth')}
        </p>
      )}
    </div>
  );

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

  // Custom DOW tooltip for recharts
  const DowTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    const point = dowData.find((d) => d.name === label);
    return (
      <div style={{ ...tooltipStyle, background: 'hsl(var(--card))', padding: '8px 12px', fontSize: 12 }}>
        <p style={{ fontWeight: 700 }}>{label}{point ? ` · ${point.shortDate}` : ''}</p>
        <p style={{ color: 'hsl(var(--primary))' }}>{formatAmount(payload[0].value, currency)}</p>
      </div>
    );
  };

  const dowChart = (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">{t('analytics.byDow')}</h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={dowData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={45} />
          <Tooltip content={<DowTooltip />} />
          <Bar dataKey="amount" name="Spent" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (topCats.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8 lg:px-0 lg:pt-0">
        <h1 className="text-xl font-bold lg:hidden">{t('analytics.title')}</h1>
        {periodSelector}
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

      {periodSelector}

      {statCards}

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden flex flex-col gap-4">
        {mobileHeroCard}
        {/* Trend: custom bars */}
        {hasTrendData && (() => {
          const maxV = Math.max(...trendData.map((d) => d.expenses), 1);
          return (
            <div>
              <p className="text-[17px] font-extrabold text-foreground mb-2.5">{t('analytics.trend')}</p>
              <div className="rounded-[22px] bg-card px-4 py-5" style={{ boxShadow: '0 2px 6px rgba(61,44,31,.04)' }}>
                <div className="flex items-flex-end gap-2.5" style={{ height: 130, alignItems: 'flex-end' }}>
                  {trendData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div
                        className="w-full rounded-[10px_10px_6px_6px]"
                        style={{ height: Math.max(6, (d.expenses / maxV) * 110), background: i === trendData.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / .3)' }}
                      />
                      <span className="text-[10px] font-bold text-muted-foreground">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
        {/* DOW: current week bars with dates */}
        {(() => {
          const maxV = Math.max(...dowData.map((d) => d.amount), 1);
          const peakDay = hasDowData ? dowData.reduce((best, d) => d.amount > best.amount ? d : best, dowData[0]) : null;
          return (
            <div>
              <p className="text-[17px] font-extrabold text-foreground mb-2.5">{t('analytics.byDow')}</p>
              <div className="rounded-[22px] bg-card px-4 py-5" style={{ boxShadow: '0 2px 6px rgba(61,44,31,.04)' }}>
                <div className="flex items-flex-end gap-2" style={{ height: 100, alignItems: 'flex-end' }}>
                  {dowData.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-[8px_8px_4px_4px]"
                        style={{ height: Math.max(4, (d.amount / maxV) * 80), background: '#81B29A' }}
                      />
                      <span className="text-[9px] font-extrabold text-muted-foreground leading-none">{d.name}</span>
                      <span className="text-[8px] text-muted-foreground/60 leading-none">{format(parseISO(d.isoDate), 'd')}</span>
                    </div>
                  ))}
                </div>
                {peakDay && hasDowData && (
                  <p className="text-[12px] font-semibold text-muted-foreground text-center mt-3">
                    Пик трат — {peakDay.name} ({peakDay.shortDate})
                  </p>
                )}
              </div>
            </div>
          );
        })()}
        {/* Top category */}
        {topCats[0] && (() => {
          const top = topCats[0];
          const pct = totalSpend > 0 ? (top.total / totalSpend) * 100 : 0;
          return (
            <div>
              <p className="text-[17px] font-extrabold text-foreground mb-2.5">{t('analytics.topCategories')}</p>
              <div className="rounded-[22px] bg-card px-4 py-4 flex items-center gap-3.5" style={{ boxShadow: '0 2px 6px rgba(61,44,31,.04)' }}>
                <div className="h-[52px] w-[52px] rounded-[18px] flex items-center justify-center shrink-0" style={{ background: (top.cat?.color ?? '#E07A5F') + '22' }}>
                  <span style={{ fontSize: 28 }}>{top.cat?.icon ?? '📦'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold text-foreground">{t.cat(top.cat?.name ?? '')}</p>
                  <p className="text-xs font-semibold text-muted-foreground mt-0.5">{pct.toFixed(0)}% от трат</p>
                </div>
                <p className="text-[18px] font-black tabular-nums text-foreground">{formatAmount(top.total, currency)}</p>
              </div>
            </div>
          );
        })()}
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
