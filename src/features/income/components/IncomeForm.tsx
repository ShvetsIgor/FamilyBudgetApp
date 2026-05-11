'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { CategoryPicker } from '@/features/categories/components/CategoryPicker';
import { blockInvalidAmountKeys, parseLocalDate } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import type { AddIncomeInput } from '../services/incomeService';
import type { SerializableIncome } from '@/shared/types';

type IncomeMethod = 'cash' | 'card' | 'bank' | 'other';

interface Props {
  initialIncome?: SerializableIncome;
  onSave: (data: Omit<AddIncomeInput, 'userId'>) => Promise<void>;
  onCancel: () => void;
}

export function IncomeForm({ initialIncome, onSave, onCancel }: Props) {
  const currency = useAppSelector((s) => s.ui.currency);
  const t = useT();
  const isEdit = !!initialIncome;

  const METHODS: { value: IncomeMethod; label: string; icon: string }[] = [
    { value: 'card', label: t('income.card'), icon: '💳' },
    { value: 'cash', label: t('income.cash'), icon: '💵' },
    { value: 'bank', label: t('income.bank'), icon: '🏦' },
    { value: 'other', label: t('income.other'), icon: '🔄' },
  ];

  const [amount, setAmount] = useState(initialIncome?.amount.toString() ?? '');
  const [categoryId, setCategoryId] = useState(initialIncome?.categoryId ?? '');
  const [date, setDate] = useState(
    initialIncome ? format(parseISO(initialIncome.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [method, setMethod] = useState<IncomeMethod>((initialIncome?.method as IncomeMethod) ?? 'card');
  const [comment, setComment] = useState(initialIncome?.comment ?? '');
  const [privacy, setPrivacy] = useState<'regular' | 'secret'>(initialIncome?.privacy ?? 'regular');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!num || num <= 0) { setError(t('common.error')); return; }
    if (!categoryId) { setError(t('common.error')); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        amount: num,
        currency,
        categoryId,
        date: parseLocalDate(date),
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
        <label className="text-xs text-muted-foreground mb-1 block">{t('income.amount')}</label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-muted-foreground">{currency}</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={blockInvalidAmountKeys}
            className="flex-1 bg-transparent text-2xl font-bold outline-none tabular-nums text-emerald-500"
            autoFocus
          />
        </div>
      </div>

      {/* Category */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">{t('income.category')}</label>
        <CategoryPicker type="income" childrenOnly value={categoryId} onChange={setCategoryId} />
      </div>

      {/* Date */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">{t('income.date')}</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-transparent text-sm font-medium outline-none"
        />
      </div>

      {/* Method */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">{t('income.method')}</label>
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
        <label className="text-xs text-muted-foreground mb-1 block">{t('income.comment')}</label>
        <input
          type="text"
          placeholder={t('income.commentPlaceholder')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>

      {/* Privacy */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
        <span className="text-sm font-medium">{t('income.secret')}</span>
        <button
          type="button"
          onClick={() => setPrivacy(privacy === 'secret' ? 'regular' : 'secret')}
          className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
            privacy === 'secret' ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            privacy === 'secret' ? 'left-[22px]' : 'left-0.5'
          }`} />
        </button>
      </div>

      {error && <p className="text-xs text-destructive px-1">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground"
        >
          {t('income.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? t('income.saving') : isEdit ? t('income.saveChanges') : t('income.save')}
        </button>
      </div>
    </form>
  );
}
