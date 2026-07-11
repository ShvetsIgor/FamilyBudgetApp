'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { mergeExpenses } from '@/features/expenses/store/expensesSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { setBudgetMode, setBudgetDailyLimit, setBudgetMonthlyLimit, setBudgetSnapshot } from '@/features/ui/store/uiSlice';
import type { BudgetMode } from '@/features/ui/store/uiSlice';
import { formatAmount, blockInvalidAmountKeys } from '@/shared/utils/currency';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { useT } from '@/shared/hooks/useT';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { doc, updateDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';

export default function BudgetPage() {
  const dispatch = useAppDispatch();
  const t = useT();
  const dfLocale = useDateFnsLocale();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const mode = useAppSelector((s) => s.ui.budgetMode);
  const dailyLimit = useAppSelector((s) => s.ui.budgetDailyLimit);
  const monthlyLimit = useAppSelector((s) => s.ui.budgetMonthlyLimit);
  const sym = getCurrencySymbol(currency);

  const now = new Date();
  const monthStr = toLocalMonthKey(now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;

  // Direct navigation / refresh must not depend on /home having loaded the
  // month first: fetch the current month here too (merge dedupes by id).
  useEffect(() => {
    if (!user?.id) return;
    fetchMonthExpenses(user.id, toLocalMonthKey(new Date()))
      .then((list) => dispatch(mergeExpenses(list)))
      .catch(() => {});
  }, [user?.id, dispatch]);

  const monthSpent = useAppSelector((s) =>
    s.expenses.list.filter((e) => toLocalMonthKey(e.date) === monthStr).reduce((acc, e) => acc + e.amount, 0)
  );
  const monthIncome = useAppSelector((s) =>
    s.income.list.filter((i) => toLocalMonthKey(i.date) === monthStr).reduce((acc, i) => acc + i.amount, 0)
  );

  const autoDaily = monthIncome > 0
    ? Math.max(0, Math.round((monthIncome - monthSpent) / remainingDays))
    : 0;

  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const expCategories = useAppSelector((s) => s.categories.expense);
  const allExpensesList = useAppSelector((s) => s.expenses.list);

  // Per-category envelopes for the current month; split rows count toward
  // their own categories, the remainder toward the main one
  const envelopes = useMemo(() => {
    const spent: Record<string, number> = {};
    for (const e of allExpensesList) {
      if (toLocalMonthKey(e.date) !== monthStr) continue;
      if (e.splits?.length) {
        let splitsSum = 0;
        for (const sp of e.splits) {
          spent[sp.categoryId] = (spent[sp.categoryId] ?? 0) + sp.amount;
          splitsSum += sp.amount;
        }
        const rem = e.amount - splitsSum;
        if (rem > 0.009) spent[e.categoryId] = (spent[e.categoryId] ?? 0) + rem;
      } else {
        spent[e.categoryId] = (spent[e.categoryId] ?? 0) + e.amount;
      }
    }
    return Object.entries(budgetLimits)
      .filter(([, limit]) => limit > 0)
      .map(([catId, limit]) => {
        const cat = expCategories.find((c) => c.id === catId);
        return {
          catId, limit,
          spent: spent[catId] ?? 0,
          name: cat?.name ?? '—',
          icon: cat?.icon ?? 'box',
          color: cat?.color ?? '#8AA9D6',
        };
      })
      .sort((a, b) => b.spent / b.limit - a.spent / a.limit);
  }, [allExpensesList, budgetLimits, expCategories, monthStr]);

  const [localMode, setLocalMode] = useState<BudgetMode>(mode);
  const [localDaily, setLocalDaily] = useState(dailyLimit > 0 ? String(dailyLimit) : '');
  const [localMonthly, setLocalMonthly] = useState(monthlyLimit > 0 ? String(monthlyLimit) : '');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  async function handleSave() {
    setSaveError(false);
    const snapshot = {
      mode: localMode,
      dailyLimit: Number(localDaily) || 0,
      monthlyLimit: Number(localMonthly) || 0,
    };
    dispatch(setBudgetMode(localMode));
    if (localMode === 'daily') dispatch(setBudgetDailyLimit(snapshot.dailyLimit));
    if (localMode === 'monthly') dispatch(setBudgetMonthlyLimit(snapshot.monthlyLimit));
    // Settings are stamped onto the current month: past months keep the
    // snapshot that was active then, future months inherit this one
    dispatch(setBudgetSnapshot({ month: monthStr, snapshot }));
    if (user) {
      const patch: Record<string, unknown> = { budgetMode: localMode };
      if (localMode === 'daily') patch.budgetDailyLimit = snapshot.dailyLimit;
      if (localMode === 'monthly') patch.budgetMonthlyLimit = snapshot.monthlyLimit;
      patch[`budgetByMonth.${monthStr}`] = snapshot;
      try {
        await updateDoc(doc(getDb(), 'users', user.id), patch);
      } catch {
        // Local state is already updated; surface the failed remote sync instead of faking success
        setSaveError(true);
        return;
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const effectiveBudget = localMode === 'monthly' ? Number(localMonthly) || 0
    : localMode === 'daily' ? (Number(localDaily) || 0) * daysInMonth
    : monthIncome;
  const pct = effectiveBudget > 0 ? Math.min(100, Math.round((monthSpent / effectiveBudget) * 100)) : 0;

  const modes: { key: BudgetMode; label: string; desc: string }[] = [
    { key: 'auto',    label: t('chat.budget.settings.auto'),    desc: t('chat.budget.settings.autoDesc') },
    { key: 'daily',   label: t('chat.budget.settings.daily'),   desc: t('chat.budget.settings.dailyDesc') },
    { key: 'monthly', label: t('chat.budget.settings.monthly'), desc: t('chat.budget.settings.monthlyDesc') },
  ];

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      <div className="lg:col-span-2 flex flex-col">

        {/* Architectural header */}
        <div className="px-4 pt-6 pb-4 lg:px-0 lg:pt-0" style={{ borderBottom: '2px solid hsl(var(--foreground))', background: 'hsl(var(--card))' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
            {format(new Date(monthStr + '-01'), 'LLLL yyyy', { locale: dfLocale })}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {monthSpent > 0 ? `-${formatAmount(monthSpent, currency)}` : formatAmount(0, currency)}
            </div>
            {effectiveBudget > 0 && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
                  {t('expenses.budget')}
                </p>
                <p style={{ fontSize: 16, fontWeight: 800 }}>
                  {formatAmount(effectiveBudget, currency)}
                </p>
              </div>
            )}
          </div>
          {effectiveBudget > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 3, background: 'hsl(var(--muted))' }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: pct > 85 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <p style={{ marginTop: 4, fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                {pct}% · {t('expenses.budgetLeft')} {formatAmount(Math.max(0, effectiveBudget - monthSpent), currency)}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 px-4 pt-4 pb-8 lg:px-0">

          {/* Mode selector */}
          <div className="flex flex-col">
            {modes.map(({ key, label, desc }) => {
              const active = localMode === key;
              return (
                <button
                  key={key}
                  onClick={() => setLocalMode(key)}
                  className="flex items-center gap-4 pl-3 pr-4 py-3.5 text-left transition-colors"
                  style={{
                    borderLeft: `4px solid ${active ? 'hsl(var(--primary))' : 'transparent'}`,
                    borderBottom: '1px solid hsl(var(--border) / 0.3)',
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold leading-snug" style={{ color: active ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))' }}>
                      {desc}
                    </p>
                  </div>
                  {active && key === 'auto' && autoDaily > 0 && (
                    <span style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'hsl(var(--primary))' }}>
                      {sym}{autoDaily.toLocaleString()}{t('budget.perDayShort')}
                    </span>
                  )}
                  {!active && (
                    <div className="h-5 w-5 rounded-full border-2 border-border" />
                  )}
                  {active && (
                    <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: 'hsl(var(--primary))' }}>
                      <div className="h-2 w-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Limit input */}
          {localMode === 'daily' && (
            <div className="border-b border-border/30 pb-4">
              <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
                {t('chat.budget.settings.daily')} ({sym})
              </p>
              <input
                type="number" min="0" step="1"
                placeholder="0"
                value={localDaily}
                onChange={(e) => setLocalDaily(e.target.value)}
                onKeyDown={blockInvalidAmountKeys}
                className="w-full bg-transparent outline-none"
                style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}
                autoFocus
              />
              {Number(localDaily) > 0 && (
                <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
                  ≈ {formatAmount(Number(localDaily) * daysInMonth, currency)} {t('budget.perMonth')}
                </p>
              )}
            </div>
          )}

          {localMode === 'monthly' && (
            <div className="border-b border-border/30 pb-4">
              <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
                {t('chat.budget.settings.monthly')} ({sym})
              </p>
              <input
                type="number" min="0" step="1"
                placeholder="0"
                value={localMonthly}
                onChange={(e) => setLocalMonthly(e.target.value)}
                onKeyDown={blockInvalidAmountKeys}
                className="w-full bg-transparent outline-none"
                style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}
                autoFocus
              />
              {Number(localMonthly) > 0 && (
                <p style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>
                  ≈ {formatAmount(Math.round(Number(localMonthly) / daysInMonth), currency)} {t('budget.perDay')}
                </p>
              )}
            </div>
          )}

          {localMode === 'auto' && (
            <div className="border-b border-border/30 pb-4">
              <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
                {t('budget.autoCalc')}
              </p>
              {monthIncome > 0 ? (
                <div className="flex flex-col gap-1">
                  <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                    {t('budget.autoFormula', { income: formatAmount(monthIncome, currency), spent: formatAmount(monthSpent, currency), days: remainingDays })}
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--foreground))' }}>
                    = {sym}{autoDaily.toLocaleString()} {t('budget.perDay')}
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                  {t('budget.noIncome')}
                </p>
              )}
            </div>
          )}

          {/* Category envelopes */}
          <div className="border-b border-border/30 pb-4">
            <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--muted-foreground))', marginBottom: 10 }}>
              {t('budget.envelopes')}
            </p>
            {envelopes.length === 0 ? (
              <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{t('budget.envelopesHint')}</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {envelopes.map((env) => {
                  const pct = Math.min(100, (env.spent / env.limit) * 100);
                  const over = env.spent > env.limit;
                  return (
                    <div key={env.catId}>
                      <div className="flex items-center gap-2 mb-1">
                        <StickerIcon icon={env.icon} color={env.color} className="h-4 w-4 shrink-0" />
                        <span className="flex-1 text-[13px] font-semibold truncate">{t.cat(env.name)}</span>
                        <span className="text-[12px] font-bold tabular-nums" style={{ color: over ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}>
                          {formatAmount(env.spent, currency)} / {formatAmount(env.limit, currency)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? 'hsl(var(--destructive))' : env.color, transition: 'width .3s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full rounded-2xl py-3.5 text-[15px] font-[700] transition-opacity active:opacity-70"
            style={{ background: saved ? '#18A957' : 'hsl(var(--primary))', color: '#fff' }}
          >
            {saved ? `✓ ${t('home.saved')}` : t('chat.budget.settings.save')}
          </button>
          {saveError && (
            <p style={{ fontSize: 12, color: 'hsl(var(--destructive))', textAlign: 'center' }}>
              {t('budget.saveError')}
            </p>
          )}

        </div>
      </div>
    </div>
  );
}
