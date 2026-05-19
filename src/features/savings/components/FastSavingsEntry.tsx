'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Calendar, MessageSquare, ChevronRight } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setGoals, updateGoalItem } from '@/features/savings/store/savingsSlice';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { addCategory as addCategoryRedux } from '@/features/categories/store/categoriesSlice';
import { addContribution, fetchGoals } from '@/features/savings/services/savingsService';
import { addExpense } from '@/features/expenses/services/expensesService';
import { addCategory } from '@/features/categories/services/categoriesService';
import { getCurrencySymbol, formatAmount } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import type { SavingsGoal } from '@/shared/types';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

function applyKey(cur: string, key: NumKey): string {
  if (key === 'C') return '0';
  if (key === '⌫') { const s = cur.slice(0, -1); return s === '' ? '0' : s; }
  if (cur === '0') return String(key);
  return cur + String(key);
}

export function FastSavingsEntry() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedGoalId = searchParams.get('goalId');
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: goals, status } = useAppSelector((s) => s.savings);
  const expenseCategories = useAppSelector((s) => s.categories.expense);
  const t = useT();
  const symbol = getCurrencySymbol(currency);

  const [amount, setAmount] = useState('0');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(preselectedGoalId);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    dispatch(setGoals(await fetchGoals(user.id)));
  }, [user, dispatch]);

  useEffect(() => {
    if (status === 'idle') load();
  }, [status, load]);

  useEffect(() => {
    if (goals.length > 0 && !selectedGoalId) {
      setSelectedGoalId(goals[0].id);
    }
  }, [goals, selectedGoalId]);

  const selectedGoal = goals.find((g) => g.id === selectedGoalId);
  const amountNum = parseFloat(amount) || 0;
  const goalColor = selectedGoal?.color ?? '#10b981';

  function tap(key: NumKey) {
    setAmount((cur) => applyKey(cur, key));
  }

  async function handleSave() {
    if (!user || amountNum <= 0 || !selectedGoal || saving) return;
    setSaving(true);
    try {
      const updated = await addContribution(user.id, selectedGoal, { amount: amountNum });
      dispatch(updateGoalItem(updated));

      // Record as expense in Savings category
      let catId = expenseCategories.find((c) => c.name === 'Savings' && !c.parentId)?.id ?? '';
      if (!catId) {
        const created = await addCategory(user.id, {
          name: 'Savings', icon: '🐷', color: '#10b981', type: 'expense',
          isPrivate: false, order: 8, parentId: undefined,
        });
        dispatch(addCategoryRedux(created));
        catId = created.id;
      }
      dispatch(prependExpense(await addExpense({
        userId: user.id, amount: amountNum, currency: selectedGoal.currency,
        categoryId: catId, date: new Date(), paymentMethod: 'other',
        comment: `Savings: ${selectedGoal.name}`, tags: ['savings'],
        privacy: 'regular', splits: [], goalId: selectedGoal.id,
      })));

      router.back();
    } catch {
      setSaving(false);
    }
  }

  if (!user) return null;

  const pct = selectedGoal
    ? Math.min(100, (selectedGoal.currentAmount / selectedGoal.targetAmount) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:bg-black/50 lg:backdrop-blur-sm">
    <div className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          {t('savings.addContribution')}
        </div>
        <div className="w-8" />
      </div>

      {/* ── Amount display ── */}
      <div
        className="mx-4 px-4 py-1.5 rounded-[18px] flex items-baseline justify-between flex-shrink-0 border-[1.5px]"
        style={{ background: goalColor + '14', borderColor: goalColor + '55' }}
      >
        <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
          {t('savings.amount')}
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-muted-foreground">{symbol}</span>
          <span className="text-[32px] font-black text-foreground tracking-[-0.03em] leading-none tabular-nums">
            {amount}
          </span>
        </div>
      </div>

      {/* ── Goals list ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-2 min-h-0 [scrollbar-width:none]">
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-muted-foreground text-sm">
            <span className="text-4xl">🐷</span>
            <span>{t('savings.noGoals')}</span>
          </div>
        ) : (
          goals.map((goal) => {
            const sel = goal.id === selectedGoalId;
            const gPct = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
            return (
              <button
                key={goal.id}
                onClick={() => setSelectedGoalId(goal.id)}
                className="rounded-[16px] p-3.5 flex items-center gap-3 text-left transition-all border-[1.5px] flex-shrink-0"
                style={{
                  background: sel ? goal.color + '14' : 'hsl(var(--card))',
                  borderColor: sel ? goal.color : 'transparent',
                  boxShadow: '0 1px 3px rgba(61,44,31,.05)',
                }}
              >
                <div
                  className="h-10 w-10 rounded-[12px] flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: goal.color + '22' }}
                >
                  {goal.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-foreground mb-1">{goal.name}</div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${gPct}%`, background: goal.color }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                    {formatAmount(goal.currentAmount, currency)} / {formatAmount(goal.targetAmount, currency)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* ── Numpad ── */}
      <div className="px-3 pt-0.5 grid grid-cols-3 flex-shrink-0" style={{ gridAutoRows: '40px', gap: '4px' }}>
        {NUMPAD_KEYS.map((k) => (
          <button
            key={String(k)}
            onClick={() => tap(k)}
            className="bg-card rounded-xl font-extrabold transition-colors active:bg-muted border-0"
            style={{
              fontSize: typeof k === 'number' ? 20 : 16,
              color: k === '⌫' || k === 'C' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
              boxShadow: '0 1px 2px rgba(61,44,31,.05)',
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* ── Save bar ── */}
      <div className="px-4 pt-1.5 pb-safe flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0 || !selectedGoal}
          className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-white transition-opacity disabled:opacity-50 border-0"
          style={{
            background: goalColor,
            boxShadow: `0 12px 24px ${goalColor}60`,
          }}
        >
          <span className="text-lg leading-none">🐷</span>
          <span>
            {saving
              ? t('common.saving')
              : selectedGoal
              ? `${t('savings.contribute')} ${symbol}\u202F${amount} → ${selectedGoal.name}`
              : t('savings.selectGoal')}
          </span>
        </button>
      </div>
    </div>
    </div>
  );
}
