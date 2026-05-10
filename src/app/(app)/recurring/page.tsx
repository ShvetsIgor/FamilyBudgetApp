'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import {
  setRecurring, addRecurringItem, removeRecurringItem, toggleRecurringItem,
} from '@/features/recurring/store/recurringSlice';
import {
  fetchRecurring, addRecurring, deleteRecurring, toggleRecurring,
  type AddRecurringInput,
} from '@/features/recurring/services/recurringService';
import { CategoryPicker } from '@/features/categories/components/CategoryPicker';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import type { RecurringFrequency, RecurringType, SerializableRecurringPayment } from '@/shared/types';

const FREQ: { value: RecurringFrequency; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'daily', label: 'Daily' },
];

const TYPES: { value: RecurringType; label: string; icon: string }[] = [
  { value: 'subscription', label: 'Subscription', icon: '📺' },
  { value: 'rent', label: 'Rent', icon: '🏠' },
  { value: 'utility', label: 'Utility', icon: '💡' },
  { value: 'credit', label: 'Credit', icon: '💳' },
  { value: 'mortgage', label: 'Mortgage', icon: '🏦' },
  { value: 'custom', label: 'Custom', icon: '🔄' },
];

function daysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

export default function RecurringPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);
  const { list, status } = useAppSelector((s) => s.recurring);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchRecurring(user.id);
      dispatch(setRecurring(data));
    } finally {
      setLoading(false);
    }
  }, [user, dispatch]);

  useEffect(() => { if (status === 'idle') load(); }, [status, load]);

  async function handleAdd(data: Omit<AddRecurringInput, 'userId'>) {
    if (!user) return;
    const saved = await addRecurring({ ...data, userId: user.id });
    dispatch(addRecurringItem(saved));
    setShowForm(false);
  }

  async function handleDelete(item: SerializableRecurringPayment) {
    if (!user || !confirm(`Delete "${item.name}"?`)) return;
    await deleteRecurring(user.id, item.id);
    dispatch(removeRecurringItem(item.id));
  }

  async function handleToggle(item: SerializableRecurringPayment) {
    if (!user) return;
    const next = !item.isActive;
    await toggleRecurring(user.id, item.id, next);
    dispatch(toggleRecurringItem({ id: item.id, isActive: next }));
  }

  if (showForm) {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground">← Back</button>
          <h1 className="text-xl font-bold">New Recurring</h1>
        </div>
        <RecurringForm onSave={handleAdd} onCancel={() => setShowForm(false)} currency={currency} />
      </div>
    );
  }

  const monthlyTotal = list
    .filter((r) => r.isActive)
    .reduce((s, r) => {
      const m = r.frequency === 'monthly' ? 1 : r.frequency === 'yearly' ? 1 / 12 : r.frequency === 'weekly' ? 4.33 : 30;
      return s + r.amount * m;
    }, 0);

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Recurring</h1>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
        >
          + Add
        </button>
      </div>

      {/* Monthly summary */}
      {list.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Monthly total (active)</p>
          <p className="text-2xl font-bold tabular-nums mt-1 text-destructive">
            -{formatAmount(monthlyTotal, currency)}
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {/* Empty */}
      {!loading && list.length === 0 && (
        <div className="flex flex-col items-center py-12 text-center">
          <p className="text-4xl mb-3">🔄</p>
          <p className="font-medium">No recurring payments</p>
          <p className="text-sm text-muted-foreground mt-1">Add subscriptions, rent, utilities…</p>
        </div>
      )}

      {/* List */}
      {list.length > 0 && (
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {list.map((item) => {
            const cat = categories.find((c) => c.id === item.categoryId);
            const days = daysUntil(item.nextDueDate);
            const typeObj = TYPES.find((t) => t.value === item.type);
            return (
              <div key={item.id} className={`flex items-center gap-3 px-4 py-3 ${!item.isActive ? 'opacity-50' : ''}`}>
                {cat ? (
                  <CategoryIcon icon={cat.icon} color={cat.color} size="md" />
                ) : (
                  <span className="text-2xl">{typeObj?.icon ?? '🔄'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {FREQ.find((f) => f.value === item.frequency)?.label}
                    {' · '}
                    {days <= 0 ? (
                      <span className="text-destructive font-medium">Due today!</span>
                    ) : days <= 3 ? (
                      <span className="text-amber-500 font-medium">In {days}d</span>
                    ) : (
                      <span>Next: {format(parseISO(item.nextDueDate), 'MMM d')}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatAmount(item.amount, item.currency)}
                  </span>
                  <button
                    onClick={() => handleToggle(item)}
                    className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${item.isActive ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${item.isActive ? 'left-[18px]' : 'left-0.5'}`} />
                  </button>
                  <button onClick={() => handleDelete(item)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecurringForm({
  onSave, onCancel, currency,
}: { onSave: (d: Omit<AddRecurringInput, 'userId'>) => Promise<void>; onCancel: () => void; currency: string }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [type, setType] = useState<RecurringType>('subscription');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reminderDays, setReminderDays] = useState(3);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!name.trim()) { setError('Enter a name'); return; }
    if (!num || num <= 0) { setError('Enter a valid amount'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        amount: num,
        currency: currency as never,
        categoryId,
        frequency,
        startDate: new Date(startDate),
        type,
        reminderDays,
        comment: comment.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-8">
      {/* Name */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Netflix, Rent…"
          className="w-full bg-transparent text-sm font-medium outline-none"
        />
      </div>

      {/* Amount */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Amount ({currency})</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums text-destructive"
        />
      </div>

      {/* Type */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">Type</label>
        <div className="grid grid-cols-3 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs border transition-colors ${
                type === t.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Frequency */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">Frequency</label>
        <div className="grid grid-cols-2 gap-2">
          {FREQ.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFrequency(f.value)}
              className={`rounded-xl py-2 text-sm font-medium border transition-colors ${
                frequency === f.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">Category (optional)</label>
        <CategoryPicker type="expense" value={categoryId} onChange={setCategoryId} parentsOnly />
      </div>

      {/* Start date */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Start / Next due</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full bg-transparent text-sm font-medium outline-none"
        />
      </div>

      {/* Reminder */}
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
        <label className="text-sm font-medium">Remind me before</label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setReminderDays(Math.max(0, reminderDays - 1))}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground">−</button>
          <span className="w-12 text-center text-sm font-semibold">{reminderDays}d</span>
          <button type="button" onClick={() => setReminderDays(Math.min(14, reminderDays + 1))}
            className="h-8 w-8 rounded-lg border border-border text-muted-foreground">+</button>
        </div>
      </div>

      {/* Comment */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Comment</label>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional…"
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {error && <p className="text-xs text-destructive px-1">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground">
          Cancel
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
