'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays, differenceInMonths } from 'date-fns';
import { useAppSelector, useAppDispatch, store } from '@/store/store';
import { setGoals, addGoalItem, updateGoalItem, removeGoalItem } from '@/features/savings/store/savingsSlice';
import {
  fetchGoals, addGoal, addContribution, deleteGoal,
  type AddGoalInput,
} from '@/features/savings/services/savingsService';
import { formatAmount } from '@/shared/utils/currency';
import { addExpense } from '@/features/expenses/services/expensesService';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import type { SavingsGoal, Currency } from '@/shared/types';

const GOAL_ICONS = ['🎯', '🏠', '🚗', '✈️', '💻', '📱', '👶', '💍', '🎓', '🏖️', '💰', '🛋️'];
const GOAL_COLORS = ['#6366f1', '#f97316', '#10b981', '#3b82f6', '#ec4899', '#eab308', '#8b5cf6', '#06b6d4'];

type Mode = 'list' | 'add' | { goal: SavingsGoal; action: 'contribute' | 'detail' };

export default function SavingsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list, status } = useAppSelector((s) => s.savings);
  const [mode, setMode] = useState<Mode>('list');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchGoals(user.id);
      dispatch(setGoals(data));
    } finally {
      setLoading(false);
    }
  }, [user, dispatch]);

  useEffect(() => { if (status === 'idle') load(); }, [status, load]);

  async function handleAddGoal(data: Omit<AddGoalInput, 'userId'>) {
    if (!user) return;
    const saved = await addGoal({ ...data, userId: user.id });
    dispatch(addGoalItem(saved));
    setMode('list');
  }

  async function handleContribute(
    goal: SavingsGoal,
    amount: number,
    note: string,
    recordAsExpense: boolean,
    expenseCategoryId: string,
  ) {
    if (!user) return;
    const updated = await addContribution(user.id, goal, { amount, note: note || undefined });
    dispatch(updateGoalItem(updated));

    if (recordAsExpense) {
      const allExpCats = (store.getState() as { categories: { expense: { id: string; name: string }[] } }).categories.expense;
      const catId = expenseCategoryId
        || allExpCats.find((c) => c.name === 'Savings')?.id
        || allExpCats.find((c) => c.name === 'Other')?.id
        || allExpCats[0]?.id
        || '';
      const expense = await addExpense({
        userId: user.id,
        amount,
        currency: goal.currency,
        categoryId: catId,
        date: new Date(),
        paymentMethod: 'other',
        comment: `Savings: ${goal.name}${note ? ' · ' + note : ''}`,
        tags: ['savings'],
        privacy: 'regular',
        splits: [],
      });
      dispatch(prependExpense(expense));
    }

    setMode('list');
  }

  async function handleDelete(goal: SavingsGoal) {
    if (!user || !confirm(`Delete "${goal.name}"?`)) return;
    await deleteGoal(user.id, goal.id);
    dispatch(removeGoalItem(goal.id));
    setMode('list');
  }

  // — Add form —
  if (mode === 'add') {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <button onClick={() => setMode('list')} className="text-sm text-muted-foreground">← Back</button>
          <h1 className="text-xl font-bold">New Goal</h1>
        </div>
        <GoalForm currency={currency} onSave={handleAddGoal} onCancel={() => setMode('list')} />
      </div>
    );
  }

  // — Contribute form —
  if (typeof mode === 'object' && mode.action === 'contribute') {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <button onClick={() => setMode('list')} className="text-sm text-muted-foreground">← Back</button>
          <h1 className="text-xl font-bold">Add Contribution</h1>
        </div>
        <ContributeForm
          goal={mode.goal}
          currency={currency}
          onSave={(amount, note, recordAsExpense, catId) =>
            handleContribute(mode.goal, amount, note, recordAsExpense, catId)
          }
          onCancel={() => setMode('list')}
        />
      </div>
    );
  }

  // — Detail —
  if (typeof mode === 'object' && mode.action === 'detail') {
    const goal = list.find((g) => g.id === mode.goal.id) ?? mode.goal;
    const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0);
    const remaining = goal.targetAmount - goal.currentAmount;
    const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
    const monthsLeft = goal.deadline ? differenceInMonths(parseISO(goal.deadline), new Date()) : null;
    const done = pct >= 100;

    return (
      <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode('list')} className="text-sm text-muted-foreground">← Back</button>
        </div>

        {/* Goal card */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-3">
          <div className="text-5xl">{goal.icon}</div>
          <h2 className="text-xl font-bold">{goal.name}</h2>
          <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
          </div>
          <div className="flex justify-between w-full text-sm">
            <span className="font-semibold tabular-nums" style={{ color: goal.color }}>
              {formatAmount(goal.currentAmount, goal.currency)}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {formatAmount(goal.targetAmount, goal.currency)}
            </span>
          </div>
          <p className="text-2xl font-bold">{pct.toFixed(0)}%</p>
          {!done && <p className="text-sm text-muted-foreground">{formatAmount(remaining, goal.currency)} to go</p>}
          {done && <p className="text-sm text-emerald-500 font-semibold">🎉 Goal reached!</p>}
          {daysLeft !== null && !done && (
            <p className="text-xs text-muted-foreground">
              {daysLeft > 0 ? `${daysLeft} days left · ${format(parseISO(goal.deadline!), 'MMM d, yyyy')}` : 'Deadline passed'}
            </p>
          )}
          {monthsLeft !== null && !done && monthsLeft > 0 && remaining > 0 && (
            <p className="text-xs text-muted-foreground">
              Need ~{formatAmount(remaining / monthsLeft, goal.currency)}/month
            </p>
          )}
        </div>

        <button
          onClick={() => setMode({ goal, action: 'contribute' })}
          className="rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
        >
          + Add Contribution
        </button>

        {/* History */}
        {goal.contributions.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <p className="px-4 pt-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</p>
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

        <button
          onClick={() => handleDelete(goal)}
          className="rounded-2xl border border-destructive/40 bg-destructive/5 py-3 text-sm font-semibold text-destructive"
        >
          Delete Goal
        </button>
      </div>
    );
  }

  // — List —
  const totalSaved = list.reduce((s, g) => s + g.currentAmount, 0);

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Savings Goals</h1>
        <button
          onClick={() => setMode('add')}
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          + Add
        </button>
      </div>

      {list.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total saved</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-emerald-500">
            {formatAmount(totalSaved, currency)}
          </p>
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
          <p className="font-medium">No savings goals yet</p>
          <p className="text-sm text-muted-foreground mt-1">Set a goal and track your progress</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {list.map((goal) => {
          const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0);
          const done = pct >= 100;
          return (
            <button
              key={goal.id}
              onClick={() => setMode({ goal, action: 'detail' })}
              className="rounded-2xl border border-border bg-card p-4 text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{goal.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{goal.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAmount(goal.currentAmount, goal.currency)} / {formatAmount(goal.targetAmount, goal.currency)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-lg font-bold" style={{ color: done ? '#10b981' : goal.color }}>
                    {pct.toFixed(0)}%
                  </p>
                  {done && <p className="text-xs text-emerald-500">Done!</p>}
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
              </div>
              {goal.deadline && !done && (
                <p className="text-xs text-muted-foreground mt-2">
                  Due {format(parseISO(goal.deadline), 'MMM d, yyyy')}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GoalForm({ currency, onSave, onCancel }: {
  currency: string;
  onSave: (d: Omit<AddGoalInput, 'userId'>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🎯');
  const [color, setColor] = useState('#6366f1');
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Enter a name'); return; }
    const num = parseFloat(target);
    if (!num || num <= 0) { setError('Enter a target amount'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        icon,
        color,
        targetAmount: num,
        currency: currency as Currency,
        monthlyContribution: monthly ? parseFloat(monthly) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-8">
      {/* Name */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Goal name</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          placeholder="New car, Vacation…"
          className="w-full bg-transparent text-sm font-medium outline-none" />
      </div>

      {/* Icon picker */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">Icon</label>
        <div className="flex flex-wrap gap-2">
          {GOAL_ICONS.map((i) => (
            <button key={i} type="button" onClick={() => setIcon(i)}
              className={`h-10 w-10 rounded-xl text-xl transition-colors ${icon === i ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted'}`}>
              {i}
            </button>
          ))}
        </div>
      </div>

      {/* Color picker */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">Color</label>
        <div className="flex gap-2">
          {GOAL_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-2 ring-border' : ''}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      {/* Target */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Target amount ({currency})</label>
        <input type="number" min="0" step="0.01" placeholder="0.00" value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums text-emerald-500" />
      </div>

      {/* Monthly plan */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Monthly contribution plan ({currency}, optional)</label>
        <input type="number" min="0" step="0.01" placeholder="0.00" value={monthly}
          onChange={(e) => setMonthly(e.target.value)}
          className="w-full bg-transparent text-sm font-medium outline-none tabular-nums" />
      </div>

      {/* Deadline */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Deadline (optional)</label>
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="w-full bg-transparent text-sm font-medium outline-none" />
      </div>

      {error && <p className="text-xs text-destructive px-1">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? 'Saving…' : 'Create Goal'}
        </button>
      </div>
    </form>
  );
}

function ContributeForm({ goal, currency, onSave, onCancel }: {
  goal: SavingsGoal;
  currency: string;
  onSave: (amount: number, note: string, recordAsExpense: boolean, categoryId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const categories = useAppSelector((s) => s.categories.expense);
  const savingsCat = categories.find((c) => c.name === 'Savings' && !c.parentId);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recordAsExpense, setRecordAsExpense] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError('Enter a valid amount'); return; }
    setError('');
    setSaving(true);
    try { await onSave(num, note, recordAsExpense, savingsCat?.id ?? ''); } finally { setSaving(false); }
  }

  const remaining = goal.targetAmount - goal.currentAmount;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-8">
      {/* Goal info */}
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <span className="text-3xl">{goal.icon}</span>
        <div>
          <p className="font-semibold">{goal.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatAmount(goal.currentAmount, goal.currency)} saved · {formatAmount(remaining, goal.currency)} to go
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Amount ({currency})</label>
        <input autoFocus type="number" min="0" step="0.01" placeholder="0.00" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums text-emerald-500" />
      </div>

      {/* Note */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Note (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Monthly deposit…"
          className="w-full bg-transparent text-sm outline-none" />
      </div>

      {/* Record as expense toggle */}
      <div className="rounded-2xl border border-border bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Record as expense</p>
          <p className="text-xs text-muted-foreground">
            Category: 🐷 Savings · shows in stats
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRecordAsExpense(!recordAsExpense)}
          className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${recordAsExpense ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${recordAsExpense ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive px-1">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </form>
  );
}
