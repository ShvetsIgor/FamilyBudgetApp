'use client';

import { useEffect, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { useT } from '@/shared/hooks/useT';
import { formatAmount } from '@/shared/utils/currency';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { fetchFamilyAnalytics, type FamilyAnalyticsData } from '@/features/family/services/familyBudgetService';
import { formatCurrencyTotals } from '@/features/family/utils/familyCurrency';
import { buildMemberColorMap } from '@/features/family/utils/memberColors';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

/**
 * Family analytics for the given period (months). Aggregates every
 * member's shared (non-secret) expenses/incomes — same visibility as the
 * Family list views, so secret entries never leak into totals.
 */
export function FamilyAnalyticsView({ period }: { period: number }) {
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const members = useAppSelector((s) => s.family.members);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);

  const [data, setData] = useState<FamilyAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || members.length === 0) return;
    const monthKeys = Array.from({ length: period }, (_, i) =>
      format(subMonths(new Date(), period - 1 - i), 'yyyy-MM'));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fetch starts here; this app has no server loader, everything comes from Firestore on the client
    setLoading(true);
    fetchFamilyAnalytics(members, monthKeys, user.id, categories, currency)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user, members, period, categories, currency]);

  if (loading || !data) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  const memberColorMap = buildMemberColorMap(members);
  const hasTrend = data.byMonth.some((d) => d.expenses > 0 || d.income > 0);
  const maxMember = Math.max(...data.byMember.map((m) => m.total), 1);
  const tooltipStyle = { borderRadius: 12, border: '1px solid hsl(var(--border))' };
  const card = 'rounded-[22px] border border-border bg-card p-4';
  // Multiple currencies can't be summed into one number — show each
  // separately in the stat cards; the comparative breakdowns below are in
  // the primary currency only.
  const isMixed = data.otherCurrencies.length > 0;
  const spentLabel = isMixed
    ? formatCurrencyTotals(data.spentByCurrency, { fallback: data.primaryCurrency })
    : formatAmount(data.totalSpent, data.primaryCurrency);
  const incomeLabel = isMixed
    ? formatCurrencyTotals(data.incomeByCurrency, { fallback: data.primaryCurrency })
    : formatAmount(data.totalIncome, data.primaryCurrency);
  const statFontClass = isMixed ? 'text-[17px]' : 'text-[24px]';

  return (
    <div className="flex flex-col gap-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className={card} style={{ boxShadow: '0 2px 8px rgba(61,44,31,.06)' }}>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[.08em]">{t('analytics.familySpent')}</p>
          <p className={`${statFontClass} font-black tabular-nums mt-1 leading-tight tracking-tight`}>{spentLabel}</p>
        </div>
        <div className={card} style={{ boxShadow: '0 2px 8px rgba(61,44,31,.06)' }}>
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[.08em]">{t('analytics.familyIncome')}</p>
          <p className={`${statFontClass} font-black tabular-nums mt-1 leading-tight tracking-tight text-emerald-500`}>{incomeLabel}</p>
        </div>
      </div>

      {/* Mixed-currency note: breakdowns below are shown in the primary currency */}
      {isMixed && (
        <p className="text-[11px] text-muted-foreground -mt-1 px-1">
          {t('analytics.mixedCurrencyNote', { currency: data.primaryCurrency })}
        </p>
      )}

      {/* Trend */}
      {hasTrend && (
        <div className={card} style={{ boxShadow: '0 2px 8px rgba(61,44,31,.04)' }}>
          <h2 className="text-sm font-bold mb-3">{t('analytics.trend')}</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.byMonth}>
              <defs>
                <linearGradient id="famIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="famExpenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={45} />
              <Tooltip formatter={(value) => formatAmount(value as number, data.primaryCurrency)} contentStyle={tooltipStyle} />
              <Area dataKey="income" name={t('stats.income')} stroke="#10b981" strokeWidth={2} fill="url(#famIncomeGrad)" dot={false} />
              <Area dataKey="expenses" name={t('stats.expenses')} stroke="#ef4444" strokeWidth={2} fill="url(#famExpenseGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* By member */}
      {data.totalSpent > 0 && (
        <div className={card} style={{ boxShadow: '0 2px 8px rgba(61,44,31,.04)' }}>
          <h2 className="text-sm font-bold mb-3">{t('analytics.byMember')}</h2>
          <div className="flex flex-col gap-2.5">
            {data.byMember.map((m) => {
              const pct = data.totalSpent > 0 ? (m.total / data.totalSpent) * 100 : 0;
              const color = memberColorMap[m.memberId] ?? 'hsl(var(--primary))';
              const isMe = m.memberId === user?.id;
              return (
                <div key={m.memberId}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-7 w-7 flex shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white" style={{ backgroundColor: color }}>
                      {(m.memberName || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 text-[13px] font-semibold truncate">{isMe ? t('expenses.you') : m.memberName}</span>
                    <span className="text-[13px] font-black tabular-nums">{formatAmount(m.total, data.primaryCurrency)}</span>
                    <span className="text-[11px] font-bold text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top family categories */}
      {data.topCategories.length > 0 && (
        <div className={card} style={{ boxShadow: '0 2px 8px rgba(61,44,31,.04)' }}>
          <h2 className="text-sm font-bold mb-3">{t('analytics.topCategories')}</h2>
          <div className="flex flex-col gap-2.5">
            {data.topCategories.map(({ key, name, icon, color, total }) => {
              const pct = data.totalSpent > 0 ? (total / data.totalSpent) * 100 : 0;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="h-7 w-7 flex shrink-0 items-center justify-center rounded-[10px]" style={{ backgroundColor: `${color}20` }}>
                      <StickerIcon icon={icon} color={color} className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-[13px] font-semibold truncate">{t.cat(name)}</span>
                    <span className="text-[13px] font-black tabular-nums">{formatAmount(total, data.primaryCurrency)}</span>
                    <span className="text-[11px] font-bold text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!hasTrend && data.totalSpent === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-4xl mb-3">👨‍👩‍👧</p>
          <p className="font-medium">{t('analytics.noData')}</p>
        </div>
      )}
    </div>
  );
}
