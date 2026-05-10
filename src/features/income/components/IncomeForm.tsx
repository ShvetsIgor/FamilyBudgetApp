'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { CategoryPicker } from '@/features/categories/components/CategoryPicker';
import type { AddIncomeInput } from '../services/incomeService';

type IncomeMethod = 'cash' | 'card' | 'bank' | 'other';

const METHODS: { value: IncomeMethod; label: string; icon: string }[] = [
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'other', label: 'Other', icon: '🔄' },
];

interface Props {
  onSave: (data: Omit<AddIncomeInput, 'userId'>) => Promise<void>;
  onCancel: () => void;
}

export function IncomeForm({ onSave, onCancel }: Props) {
  const currency = useAppSelector((s) => s.ui.currency);
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [method, setMethod] = useState<IncomeMethod>('card');
  const [comment, setComment] = useState('');
  const [privacy, setPrivacy] = useState<'regular' | 'secret'>('regular');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError('Enter a valid amount'); return; }
    if (!categoryId) { setError('Select a category'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        amount: num,
        currency,
        categoryId,
        date: new Date(date),
        method,
        comment: comment.trim() || undefined,
        privacy,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      {/* Amount */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-muted-foreground">{currency}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-transparent text-2xl font-bold outline-none tabular-nums text-emerald-500"
            autoFocus
          />
        </div>
      </div>

      {/* Category */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <label className="text-xs text-muted-foreground">Category</label>
        </div>
        <CategoryPicker
          type="income"
          value={categoryId}
          onChange={setCategoryId}
        />
      </div>

      {/* Date */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-transparent text-sm font-medium outline-none"
        />
      </div>

      {/* Method */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">Method</label>
        <div className="flex gap-2">
          {METHODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMethod(m.value)}
              className={`flex-1 flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium transition-colors border ${
                method === m.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground'
              }`}
            >
              <span>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">Comment</label>
        <input
          type="text"
          placeholder="Optional note…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {/* Privacy */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <span className="text-sm font-medium">Secret</span>
        <button
          type="button"
          onClick={() => setPrivacy(privacy === 'secret' ? 'regular' : 'secret')}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            privacy === 'secret' ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            privacy === 'secret' ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive px-1">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Income'}
        </button>
      </div>
    </form>
  );
}
