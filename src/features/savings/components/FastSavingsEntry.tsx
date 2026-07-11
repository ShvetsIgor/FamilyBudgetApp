'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Calendar, MessageSquare, ChevronRight } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setGoals, updateGoalItem } from '@/features/savings/store/savingsSlice';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { addCategory as addCategoryRedux } from '@/features/categories/store/categoriesSlice';
import { fetchGoals } from '@/features/savings/services/savingsService';
import { getCurrencySymbol, formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { applyKey } from '@/features/expenses/hooks/useSplitEditor';
import { addContributionWithExpense } from '@/features/savings/services/savingsExpenseService';
import { recordSavedCard, buildEntryDateHint } from '@/features/chat/services/savedCardService';
import type { SavingsGoal } from '@/shared/types';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

export function FastSavingsEntry() {
  const router = useRouter();
  // Direct URL entry has no history to go back to — fall back to /savings
  const goBack = () => { if (window.history.length > 1) router.back(); else router.replace('/savings'); };
  const searchParams = useSearchParams();
  const preselectedGoalId = searchParams.get('goalId');
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: goals, status } = useAppSelector((s) => s.savings);
  const expenseCategories = useAppSelector((s) => s.categories.expense);
  const t = useT();
  const dfLocale = useDateFnsLocale();
  const symbol = getCurrencySymbol(currency);

  const [amount, setAmount] = useState('0');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(preselectedGoalId);
  const [saving, setSaving] = useState(false);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [dateStr, setDateStr] = useState(toDateInput(new Date()));
  const [showDate, setShowDate] = useState(false);

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
  const goalColor = selectedGoal?.color ?? '#E8442A';

  function tap(key: NumKey) {
    setAmount((cur) => applyKey(cur, String(key)));
  }

  async function handleSave() {
    if (!user || amountNum <= 0 || !selectedGoal || saving) return;
    setSaving(true);
    try {
      // Contribution + expense land in one atomic WriteBatch
      const { goal: updated, expense: exp, createdCategory } = await addContributionWithExpense({
        userId: user.id, goal: selectedGoal, amount: amountNum, date: new Date(dateStr),
        label: t('savings.expenseLabel'), note: comment.trim() || undefined,
        expenseCategories,
      });
      dispatch(updateGoalItem(updated));
      if (createdCategory) dispatch(addCategoryRedux(createdCategory));
      dispatch(prependExpense(exp));

      // Secondary chat-history write — must not undo the saved contribution
      // or block navigation (a retry would duplicate it).
      try {
        const sym = getCurrencySymbol(selectedGoal.currency);
        await recordSavedCard({
          userId: user.id,
          text: `${t('savings.chatLabel')} · ${selectedGoal.name} · ${sym} ${amountNum}`,
          icon: 'coin',
          color: goalColor,
          title: selectedGoal.name,
          hint: buildEntryDateHint(dateStr, t, dfLocale),
          amount: amountNum,
          currencySymbol: sym,
          expenseId: exp.id,
        });
      } catch (err) {
        console.error('chat card write failed (contribution already saved)', err);
      }

      goBack();
    } catch {
      // Only the FINANCIAL write reaches here — re-enable retry.
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:bg-black/50 lg:backdrop-blur-sm">
    <div className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={goBack} className="p-1.5 rounded-full hover:bg-muted transition-colors">
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
      <div className="flex-1 overflow-y-auto px-4 py-2 flex flex-col gap-1.5 min-h-0 [scrollbar-width:none]">
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
                className="flex items-center gap-3 pl-3 pr-4 py-3 text-left transition-colors flex-shrink-0"
                style={{
                  borderLeft: `4px solid ${sel ? goal.color : 'transparent'}`,
                  background: sel ? goal.color + '0e' : 'hsl(var(--card))',
                  boxShadow: '0 1px 2px rgba(61,44,31,.05)',
                }}
              >
                <div
                  className="h-9 w-9 rounded-[12px] flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: goal.color + '22' }}
                >
                  {goal.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-extrabold text-foreground truncate">{goal.name}</div>
                  <div className="mt-1 h-1 bg-muted overflow-hidden">
                    <div className="h-full transition-all" style={{ width: `${gPct}%`, background: goal.color }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                    {formatAmount(goal.currentAmount, currency)} / {formatAmount(goal.targetAmount, currency)}
                  </div>
                </div>
                {sel && (
                  <div className="h-5 w-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: goal.color }}>
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            );
          })
        )}

        {/* Date row */}
        <div className="rounded-[14px] overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}>
          <button
            onClick={() => { setShowDate((v) => !v); setShowComment(false); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all"
            style={{ background: showDate ? goalColor + '14' : 'hsl(var(--card))' }}
          >
            <div className="h-8 w-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: goalColor + '20' }}>
              <Calendar className="h-4 w-4" style={{ color: goalColor }} />
            </div>
            <span className="flex-1 text-left text-[13px] font-bold text-foreground">
              {(() => {
                const d = parseISO(dateStr);
                if (isToday(d)) return t('common.today');
                if (isYesterday(d)) return t('common.yesterday');
                return format(d, 'd MMMM yyyy', { locale: dfLocale });
              })()}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {showDate && (
            <div style={{ borderTop: `1px solid ${goalColor}22` }}>
              <MiniCalendar value={dateStr} onChange={(d) => { setDateStr(d); setShowDate(false); }} color={goalColor} />
            </div>
          )}
        </div>

        {/* Comment row */}
        <div className="rounded-[14px] overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}>
          <button
            onClick={() => { setShowComment((v) => !v); setShowDate(false); }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all"
            style={{ background: (showComment || comment) ? goalColor + '14' : 'hsl(var(--card))' }}
          >
            <div className="h-8 w-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: goalColor + '20' }}>
              <MessageSquare className="h-4 w-4" style={{ color: goalColor }} />
            </div>
            <span className="flex-1 text-left text-[13px] font-bold" style={{ color: comment ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
              {comment || t('expense.notePlaceholder')}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {showComment && (
            <div className="px-3.5 pb-3" style={{ borderTop: `1px solid ${goalColor}22` }}>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('expense.notePlaceholder')}
                autoFocus
                className="mt-2 block w-full px-3 py-2 rounded-xl text-sm bg-background border border-border outline-none focus:border-primary transition-colors"
              />
            </div>
          )}
        </div>
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
              color: k === '⌫' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
              boxShadow: '0 1px 2px rgba(61,44,31,.05)',
            }}
          >
            {k}
          </button>
        ))}
      </div>

      {/* ── Save button ── */}
      <div className="px-4 pt-1.5 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0 || !selectedGoal}
          className="w-full py-[14px] rounded-[16px] flex items-center justify-center gap-2 text-[15px] font-black text-white transition-opacity disabled:opacity-40 border-0"
          style={{ background: saving ? '#18A957' : goalColor }}
        >
          {saving ? (
            <span>✓ {t('common.saving')}</span>
          ) : selectedGoal ? (
            <span>{symbol} {amount} → {selectedGoal.name}</span>
          ) : (
            <span>{t('savings.selectGoal')}</span>
          )}
        </button>
      </div>

    </div>
    </div>
  );
}
