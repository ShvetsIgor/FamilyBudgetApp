'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setBudgetMode, setBudgetDailyLimit, setBudgetMonthlyLimit } from '@/features/ui/store/uiSlice';
import type { BudgetMode } from '@/features/ui/store/uiSlice';
import { formatAmount, blockInvalidAmountKeys } from '@/shared/utils/currency';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { useT } from '@/shared/hooks/useT';
import { doc, updateDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';

export default function BudgetPage() {
  const dispatch = useAppDispatch();
  const t = useT();
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

  const monthSpent = useAppSelector((s) =>
    s.expenses.list.filter((e) => e.date.startsWith(monthStr)).reduce((acc, e) => acc + e.amount, 0)
  );
  const monthIncome = useAppSelector((s) =>
    s.income.list.filter((i) => i.date.startsWith(monthStr)).reduce((acc, i) => acc + i.amount, 0)
  );

  const autoDaily = monthIncome > 0
    ? Math.max(0, Math.round((monthIncome - monthSpent) / remainingDays))
    : 0;

  const [localMode, setLocalMode] = useState<BudgetMode>(mode);
  const [localDaily, setLocalDaily] = useState(dailyLimit > 0 ? String(dailyLimit) : '');
  const [localMonthly, setLocalMonthly] = useState(monthlyLimit > 0 ? String(monthlyLimit) : '');
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    dispatch(setBudgetMode(localMode));
    if (localMode === 'daily') dispatch(setBudgetDailyLimit(Number(localDaily) || 0));
    if (localMode === 'monthly') dispatch(setBudgetMonthlyLimit(Number(localMonthly) || 0));
    if (user) {
      const patch: Record<string, unknown> = { budgetMode: localMode };
      if (localMode === 'daily') patch.budgetDailyLimit = Number(localDaily) || 0;
      if (localMode === 'monthly') patch.budgetMonthlyLimit = Number(localMonthly) || 0;
      await updateDoc(doc(getDb(), 'users', user.id), patch).catch(() => {});
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
            {format(new Date(monthStr + '-01'), 'LLLL yyyy', { locale: ru })}
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
                      {sym}{autoDaily.toLocaleString()}/д
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
                  ≈ {formatAmount(Number(localDaily) * daysInMonth, currency)} / мес
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
                  ≈ {formatAmount(Math.round(Number(localMonthly) / daysInMonth), currency)} / день
                </p>
              )}
            </div>
          )}

          {localMode === 'auto' && (
            <div className="border-b border-border/30 pb-4">
              <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
                Авторасчёт
              </p>
              {monthIncome > 0 ? (
                <div className="flex flex-col gap-1">
                  <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                    ({formatAmount(monthIncome, currency)} доход − {formatAmount(monthSpent, currency)} потрачено) ÷ {remainingDays} дн.
                  </p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--foreground))' }}>
                    = {sym}{autoDaily.toLocaleString()} / день
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
                  Нет дохода за этот месяц. Добавьте доход на вкладке Доходы — и бюджет посчитается автоматически.
                </p>
              )}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            className="w-full rounded-2xl py-3.5 text-[15px] font-[700] transition-opacity active:opacity-70"
            style={{ background: saved ? '#18A957' : 'hsl(var(--primary))', color: '#fff' }}
          >
            {saved ? '✓ Сохранено' : t('chat.budget.settings.save')}
          </button>

        </div>
      </div>
    </div>
  );
}
