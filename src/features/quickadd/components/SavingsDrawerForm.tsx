'use client';

import { useState, useEffect, useRef } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { closeQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { updateGoalItem } from '@/features/savings/store/savingsSlice';
import { addContribution } from '@/features/savings/services/savingsService';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { addCategory as addCategoryRedux } from '@/features/categories/store/categoriesSlice';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { addSavingsExpenseForContribution } from '@/features/savings/services/savingsExpenseService';
import { recordSavedCard } from '@/features/chat/services/savedCardService';
import { normalizeName } from '@/shared/utils/normalizeName';

const AMOUNT_PRESETS = [500, 1000, 5000, 10000];

export function SavingsDrawerForm({ accent }: { accent: string }) {
  const dispatch = useAppDispatch();
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const goals = useAppSelector((s) => s.savings.list);
  const expenseCategories = useAppSelector((s) => s.categories.expense);
  const symbol = getCurrencySymbol(currency);

  const [goalId, setGoalId] = useState(goals[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const amountRef = useRef<HTMLInputElement>(null);

  const selected = goals.find((g) => g.id === goalId) ?? goals[0];

  useEffect(() => { amountRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const amountNum = parseFloat(amount) || 0;
  const progress = selected ? Math.min(1, selected.currentAmount / (selected.targetAmount || 1)) : 0;
  const afterProgress = selected
    ? Math.min(1, (selected.currentAmount + amountNum) / (selected.targetAmount || 1))
    : 0;

  async function handleSave() {
    if (!user || !selected || amountNum <= 0 || saving) return;
    setSaving(true);
    try {
      const updated = await addContribution(user.id, selected, {
        amount: amountNum,
        note: normalizeName(comment) || undefined,
      });
      dispatch(updateGoalItem(updated));
      // Mirror the mobile flow: the contribution also becomes an expense,
      // so month totals match no matter where the user saved from
      const { expense, createdCategory } = await addSavingsExpenseForContribution({
        userId: user.id, goal: selected, amount: amountNum, date: new Date(),
        label: t('savings.expenseLabel'), note: normalizeName(comment) || undefined,
        expenseCategories,
      });
      if (createdCategory) dispatch(addCategoryRedux(createdCategory));
      dispatch(prependExpense(expense));
      const goalSym = getCurrencySymbol(selected.currency);
      await recordSavedCard({
        userId: user.id,
        text: `${t('savings.chatLabel')} · ${selected.name} · ${goalSym} ${amountNum}`,
        icon: 'coin',
        color: selected.color ?? '#E8442A',
        title: selected.name,
        amount: amountNum,
        currencySymbol: goalSym,
        expenseId: expense.id,
      });
      dispatch(closeQuickAdd());
    } catch {
      setSaving(false);
    }
  }

  if (goals.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="text-4xl">🎯</span>
        <div className="text-sm font-bold text-foreground">{t('quickadd.noGoals')}</div>
        <div className="text-xs text-muted-foreground">{t('quickadd.createGoalHint')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 [scrollbar-width:none]">

        {/* ── Goal picker ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">{t('savings.goalLabel')}</span>
            {selected && (
              <span className="text-[11px] font-bold" style={{ color: selected.color }}>
                {t('quickadd.percentDone', { p: Math.round(progress * 100) })}
              </span>
            )}
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {goals.map((g) => {
              const sel = g.id === goalId;
              const prog = Math.min(1, g.currentAmount / (g.targetAmount || 1));
              return (
                <button
                  key={g.id}
                  onClick={() => setGoalId(g.id)}
                  className="rounded-[12px] p-2.5 flex flex-col gap-1.5 transition-all border-0 text-left overflow-hidden relative"
                  style={{
                    background: sel ? g.color : 'hsl(var(--card))',
                    boxShadow: sel ? `0 3px 10px ${g.color}55` : '0 1px 3px rgba(61,44,31,.06)',
                  }}
                >
                  <span className="text-lg leading-none">{g.icon}</span>
                  <span className="text-[9px] font-extrabold leading-tight line-clamp-2"
                    style={{ color: sel ? '#fff' : 'hsl(var(--foreground))' }}>
                    {g.name}
                  </span>
                  {/* progress bar */}
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: sel ? 'rgba(255,255,255,0.3)' : g.color + '22' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${prog * 100}%`, background: sel ? '#fff' : g.color }} />
                  </div>
                  <span className="text-[8px] font-bold" style={{ color: sel ? 'rgba(255,255,255,0.7)' : 'hsl(var(--muted-foreground))' }}>
                    {Math.round(prog * 100)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Amount input ── */}
        <div
          className="bg-card rounded-[14px] px-4 py-3 flex items-center gap-3 border-2 transition-all"
          style={{ borderColor: selected?.color ?? accent }}
          onClick={() => amountRef.current?.focus()}
        >
          <span className="text-xl font-bold text-muted-foreground">{symbol}</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 bg-transparent text-[32px] font-black text-foreground outline-none tabular-nums placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs font-bold text-muted-foreground/50 uppercase">{currency}</span>
        </div>

        {/* ── Amount presets ── */}
        <div className="flex gap-2">
          {AMOUNT_PRESETS.map((p) => {
            const color = selected?.color ?? accent;
            return (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className="flex-1 py-2 rounded-xl text-[11px] font-extrabold transition-all border"
                style={{
                  background: amount === String(p) ? color + '18' : 'hsl(var(--card))',
                  borderColor: amount === String(p) ? color : 'hsl(var(--border))',
                  color: amount === String(p) ? color : 'hsl(var(--muted-foreground))',
                }}
              >
                {p >= 1000 ? `${p / 1000}${t('common.thousandSuffix')}` : p}
              </button>
            );
          })}
        </div>

        {/* ── Impact preview ── */}
        {selected && (
          <div
            className="rounded-[14px] px-4 py-3 flex flex-col gap-2.5"
            style={{ background: (selected.color) + '12', border: `1px solid ${selected.color}30` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-foreground">{t('quickadd.goalProgress')}</span>
              <span className="text-[11px] font-bold" style={{ color: selected.color }}>
                {symbol}{selected.currentAmount.toLocaleString()} → {symbol}{(selected.currentAmount + amountNum).toLocaleString()}
              </span>
            </div>
            {/* Two-layer progress bar */}
            <div className="relative w-full h-3 rounded-full overflow-hidden" style={{ background: selected.color + '22' }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-300"
                style={{ width: `${afterProgress * 100}%`, background: selected.color + '55' }}
              />
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all"
                style={{ width: `${progress * 100}%`, background: selected.color }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{t('savings.goalLabel')}: {symbol}{selected.targetAmount.toLocaleString()}</span>
              <span>{t('quickadd.left')}: {symbol}{Math.max(0, selected.targetAmount - selected.currentAmount - amountNum).toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* ── Note ── */}
        <div className="bg-card rounded-[14px] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(61,44,31,.06)' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">{t('quickadd.note')}</span>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('quickadd.optionalPlaceholder')}
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      </div>

      {/* ── Save bar ── */}
      <div className="flex-shrink-0 border-t border-border px-5 py-4 flex items-center gap-3 bg-background">
        <button
          onClick={() => dispatch(closeQuickAdd())}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors border border-border"
        >
          {t('savings.numpadCancel')} <kbd className="ml-1 text-[9px] font-mono opacity-50">Esc</kbd>
        </button>
        <button
          onClick={handleSave}
          disabled={saving || amountNum <= 0 || !selected}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
          style={{
            background: selected?.color ?? accent,
            boxShadow: `0 8px 20px ${(selected?.color ?? accent)}55`,
          }}
        >
          <span>{selected?.icon ?? '🎯'}</span>
          <span>{saving ? t('savings.numpadSaving') : t('savings.numpadSave', { symbol, total: amount || '0' })}</span>
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono">⌘↵</kbd>
        </button>
      </div>
    </div>
  );
}
