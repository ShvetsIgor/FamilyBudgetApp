'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, differenceInDays, differenceInMonths } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setGoals, addGoalItem, updateGoalItem, removeGoalItem } from '@/features/savings/store/savingsSlice';
import {
  fetchGoals, addContribution, deleteGoal,
} from '@/features/savings/services/savingsService';
import { formatAmount, blockInvalidAmountKeys } from '@/shared/utils/currency';
import { addExpense } from '@/features/expenses/services/expensesService';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { addCategory } from '@/features/categories/services/categoriesService';
import { addCategory as addCategoryRedux } from '@/features/categories/store/categoriesSlice';
import { buildSavingsExpenseComment } from '@/features/savings/utils/savingsExpenseComment';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import type { SavingsGoal } from '@/shared/types';

type Mode = 'list' | { goal: SavingsGoal; action: 'contribute' | 'detail' };

export default function SavingsPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list, status } = useAppSelector((s) => s.savings);
  const [mode, setMode] = useState<Mode>('list');
  const [loading, setLoading] = useState(false);
  const t = useT();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { dispatch(setGoals(await fetchGoals(user.id))); } finally { setLoading(false); }
  }, [user, dispatch]);

  useEffect(() => { if (status === 'idle') load(); }, [status, load]);

  async function handleContribute(goal: SavingsGoal, amount: number, note: string, recordAsExpense: boolean, expenseCategoryId: string) {
    if (!user) return;
    dispatch(updateGoalItem(await addContribution(user.id, goal, { amount, note: note || undefined })));

    if (recordAsExpense) {
      let catId = expenseCategoryId;
      if (!catId) {
        const created = await addCategory(user.id, { name: 'Savings', icon: '🐷', color: '#10b981', type: 'expense', isPrivate: false, order: 8 });
        dispatch(addCategoryRedux(created));
        catId = created.id;
      }
      dispatch(prependExpense(await addExpense({
        userId: user.id, amount, currency: goal.currency, categoryId: catId,
        date: new Date(), paymentMethod: 'card',
        comment: buildSavingsExpenseComment(t('savings.expenseLabel'), goal.name, note || undefined),
        tags: ['savings'], privacy: 'regular', splits: [], goalId: goal.id,
      })));
    }
    setMode('list');
  }

  async function handleDelete(goal: SavingsGoal) {
    if (!user || !confirm(t('savings.confirmDelete'))) return;
    await deleteGoal(user.id, goal.id);
    dispatch(removeGoalItem(goal.id));
    setMode('list');
  }

  const totalSaved = list.reduce((s, g) => s + g.currentAmount, 0);

  // ── Right panel content ──────────────────────────────────────────────────────
  function RightPanel() {
    if (typeof mode === 'object' && mode.action === 'contribute') return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t('savings.addContribution')}</h2>
          <button onClick={() => setMode('list')} className="text-muted-foreground text-xs hover:text-foreground">✕</button>
        </div>
        <ContributeForm
          goal={mode.goal} currency={currency}
          onSave={(amount, note, recordAsExpense, catId) => handleContribute(mode.goal, amount, note, recordAsExpense, catId)}
          onCancel={() => setMode('list')} t={t}
        />
      </div>
    );

    if (typeof mode === 'object' && mode.action === 'detail') {
      const goal = list.find((g) => g.id === mode.goal.id) ?? mode.goal;
      const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0);
      const remaining = goal.targetAmount - goal.currentAmount;
      const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
      const monthsLeft = goal.deadline ? differenceInMonths(parseISO(goal.deadline), new Date()) : null;
      const done = pct >= 100;

      return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">{goal.name}</h2>
            <button onClick={() => setMode('list')} className="text-muted-foreground text-xs hover:text-foreground">✕</button>
          </div>
          <div className="flex flex-col gap-4 p-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <div className="text-5xl">{goal.icon}</div>
              <p className="text-2xl font-bold">{pct.toFixed(0)}%</p>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
              </div>
              <div className="flex justify-between w-full text-sm">
                <span className="font-semibold tabular-nums" style={{ color: goal.color }}>{formatAmount(goal.currentAmount, goal.currency)}</span>
                <span className="text-muted-foreground tabular-nums">{formatAmount(goal.targetAmount, goal.currency)}</span>
              </div>
              {!done && <p className="text-sm text-muted-foreground">{formatAmount(remaining, goal.currency)} {t('savings.toGo')}</p>}
              {done && <p className="text-sm text-emerald-500 font-semibold">{t('savings.achieved')}</p>}
              {daysLeft !== null && !done && (
                <p className="text-xs text-muted-foreground">
                  {daysLeft > 0 ? `${daysLeft} ${t('savings.remaining')} · ${format(parseISO(goal.deadline!), 'MMM d, yyyy')}` : t('savings.remaining')}
                </p>
              )}
              {monthsLeft !== null && !done && monthsLeft > 0 && remaining > 0 && (
                <p className="text-xs text-muted-foreground">~{formatAmount(remaining / monthsLeft, goal.currency)}/{t('recurring.monthly').toLowerCase()}</p>
              )}
            </div>

            <button
              onClick={() => setMode({ goal, action: 'contribute' })}
              className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
            >
              {t('savings.addContribution')}
            </button>

            {goal.contributions.length > 0 && (
              <div className="rounded-xl border border-border overflow-hidden">
                <p className="px-4 pt-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('savings.history')}</p>
                <div className="divide-y divide-border max-h-[240px] overflow-y-auto">
                  {[...goal.contributions].reverse().map((c, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium">{formatAmount(c.amount, goal.currency)}</p>
                        {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                      </div>
                      <p className="text-xs text-muted-foreground">{format(parseISO(c.date), 'MMM d, yyyy')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => handleDelete(goal)}
              className="rounded-xl border border-destructive/40 bg-destructive/5 py-2.5 text-sm font-semibold text-destructive"
            >
              {t('savings.delete')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="hidden lg:flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center gap-3">
        <p className="text-3xl">🎯</p>
        <p className="text-sm text-muted-foreground">{t('savings.selectGoal')}</p>
        <button
          onClick={() => router.push('/savings/new')}
          className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          + {t('savings.add')}
        </button>
      </div>
    );
  }

  // ── List content ─────────────────────────────────────────────────────────────
  const listContent = (
    <>
      {list.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('savings.totalSaved')}</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-500">{formatAmount(totalSaved, currency)}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <p className="text-5xl mb-3">🎯</p>
          <p className="font-medium">{t('savings.noGoals')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('savings.noGoalsHint')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {list.map((goal) => {
          const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0);
          const done = pct >= 100;
          const isSelected = typeof mode === 'object' && mode.goal.id === goal.id;
          return (
            <button
              key={goal.id}
              onClick={() => setMode({ goal, action: 'detail' })}
              className={cn(
                'rounded-[20px] bg-card shadow text-left transition-colors',
                isSelected ? 'ring-2 ring-primary' : 'hover:bg-muted/30'
              )}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{goal.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatAmount(goal.currentAmount, goal.currency)} / {formatAmount(goal.targetAmount, goal.currency)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold tabular-nums" style={{ color: done ? '#10b981' : goal.color }}>{pct.toFixed(0)}%</p>
                    {done && <p className="text-xs text-emerald-500">{t('savings.done')}</p>}
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                </div>
                {goal.deadline && !done && (
                  <p className="text-xs text-muted-foreground mt-2">{format(parseISO(goal.deadline), 'MMM d, yyyy')}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="lg:hidden flex flex-col gap-4 px-4 pt-5 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('savings.title')}</h1>
          {mode === 'list' && (
            <button onClick={() => router.push('/savings/new')} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
              {t('savings.add')}
            </button>
          )}
          {mode !== 'list' && (
            <button onClick={() => setMode('list')} className="text-sm text-muted-foreground">{t('savings.back')}</button>
          )}
        </div>

        {mode === 'list' && listContent}

        {typeof mode === 'object' && mode.action === 'detail' && (() => {
          const goal = list.find((g) => g.id === (mode as { goal: SavingsGoal }).goal.id) ?? (mode as { goal: SavingsGoal }).goal;
          const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0);
          const remaining = goal.targetAmount - goal.currentAmount;
          const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
          const monthsLeft = goal.deadline ? differenceInMonths(parseISO(goal.deadline), new Date()) : null;
          const done = pct >= 100;
          return (
            <div className="flex flex-col gap-4">
              <div className="rounded-[20px] bg-card shadow p-6 flex flex-col items-center gap-3">
                <div className="text-5xl">{goal.icon}</div>
                <h2 className="text-xl font-bold">{goal.name}</h2>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
                </div>
                <div className="flex justify-between w-full text-sm">
                  <span className="font-semibold tabular-nums" style={{ color: goal.color }}>{formatAmount(goal.currentAmount, goal.currency)}</span>
                  <span className="text-muted-foreground tabular-nums">{formatAmount(goal.targetAmount, goal.currency)}</span>
                </div>
                <p className="text-2xl font-bold">{pct.toFixed(0)}%</p>
                {!done && <p className="text-sm text-muted-foreground">{formatAmount(remaining, goal.currency)} {t('savings.toGo')}</p>}
                {done && <p className="text-sm text-emerald-500 font-semibold">{t('savings.achieved')}</p>}
                {daysLeft !== null && !done && (
                  <p className="text-xs text-muted-foreground">
                    {daysLeft > 0 ? `${daysLeft} ${t('savings.remaining')} · ${format(parseISO(goal.deadline!), 'MMM d, yyyy')}` : t('savings.remaining')}
                  </p>
                )}
                {monthsLeft !== null && !done && monthsLeft > 0 && remaining > 0 && (
                  <p className="text-xs text-muted-foreground">~{formatAmount(remaining / monthsLeft, goal.currency)}/{t('recurring.monthly').toLowerCase()}</p>
                )}
              </div>
              <button
                onClick={() => router.push(`/savings/contribute?goalId=${goal.id}`)}
                className="rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
              >
                {t('savings.addContribution')}
              </button>
              {goal.contributions.length > 0 && (
                <div className="rounded-[20px] bg-card shadow overflow-hidden">
                  <p className="px-4 pt-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('savings.history')}</p>
                  <div className="divide-y divide-border">
                    {[...goal.contributions].reverse().map((c, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">{formatAmount(c.amount, goal.currency)}</p>
                          {c.note && <p className="text-xs text-muted-foreground">{c.note}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground">{format(parseISO(c.date), 'MMM d, yyyy')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button onClick={() => handleDelete(goal)} className="rounded-2xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-semibold text-destructive">
                {t('savings.delete')}
              </button>
            </div>
          );
        })()}
      </div>

      {/* ── DESKTOP — 2-col ── */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start pb-6">
        <div className="col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('savings.title')}</h1>
            <button onClick={() => router.push('/savings/new')} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
              {t('savings.add')}
            </button>
          </div>
          {listContent}
        </div>
        <div className="sticky top-6">
          <RightPanel />
        </div>
      </div>
    </>
  );
}

// ── ContributeForm (desktop right panel) ─────────────────────────────────────

function ContributeForm({ goal, currency, onSave, onCancel, t }: {
  goal: SavingsGoal;
  currency: string;
  onSave: (amount: number, note: string, recordAsExpense: boolean, categoryId: string) => Promise<void>;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  const categories = useAppSelector((s) => s.categories.expense);
  const savingsCat = categories.find((c) => c.name === 'Savings' && !c.archived);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recordAsExpense, setRecordAsExpense] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError(t('common.error')); return; }
    setError(''); setSaving(true);
    try { await onSave(num, note, recordAsExpense, savingsCat?.id ?? ''); } finally { setSaving(false); }
  }

  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-8 lg:px-4 lg:pt-2">
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <span className="text-3xl">{goal.icon}</span>
        <div>
          <p className="font-semibold">{goal.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatAmount(goal.currentAmount, goal.currency)} {t('savings.saved')} · {formatAmount(remaining, goal.currency)} {t('savings.toGo')}
          </p>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">{t('savings.contribute')} ({currency})</label>
        <input autoFocus type="number" min="0" step="0.01" placeholder="0.00" value={amount}
          onChange={(e) => setAmount(e.target.value)} onKeyDown={blockInvalidAmountKeys}
          className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums text-emerald-500" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">{t('savings.note')}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('savings.contributePlaceholder')}
          className="w-full bg-transparent text-sm outline-none" />
      </div>
      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{t('savings.recordAsExpense')}</p>
          <p className="text-xs text-muted-foreground">🐷 {t('savings.savingsCategory')} · {t('savings.showsInStats')}</p>
        </div>
        <button type="button" onClick={() => setRecordAsExpense(!recordAsExpense)}
          className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${recordAsExpense ? 'bg-primary' : 'bg-muted'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${recordAsExpense ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>
      {error && <p className="text-xs text-destructive px-1">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground">
          {t('savings.cancel')}
        </button>
        <button type="submit" disabled={saving} className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? t('savings.adding') : t('savings.add2')}
        </button>
      </div>
    </form>
  );
}
