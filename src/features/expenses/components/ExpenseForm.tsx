'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { addExpense } from '@/features/expenses/services/expensesService';
import { CategoryPicker } from '@/features/categories/components/CategoryPicker';
import { SplitEditor } from './SplitEditor';
import { calculateSplit } from '@/features/expenses/utils/splitAlgorithm';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import type { Privacy, PaymentMethod, SplitItem } from '@/shared/types';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'card', label: '💳 Card' },
  { value: 'cash', label: '💵 Cash' },
  { value: 'other', label: '🔄 Other' },
];

export function ExpenseForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const symbol = getCurrencySymbol(currency);

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [splits, setSplits] = useState<SplitItem[]>([]);
  const [splitOpen, setSplitOpen] = useState(false);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [store, setStore] = useState('');
  const [comment, setComment] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('regular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const numAmount = parseFloat(amount) || 0;
  const { isValid: splitValid } = calculateSplit(numAmount, splits);
  const canSave = numAmount > 0 && categoryId && splitValid;

  // Reset splits when category changes
  function handleCategoryChange(id: string) {
    setCategoryId(id);
    setSplits([]);
    setSplitOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setLoading(true);
    setError('');

    try {
      const validSplits = splits.filter((s) => s.categoryId && s.amount > 0);
      const expense = await addExpense({
        userId: user!.id,
        amount: numAmount,
        currency,
        categoryId,
        date: new Date(date),
        paymentMethod,
        store: store || undefined,
        tags: [],
        comment: comment || undefined,
        privacy,
        splits: validSplits,
      });
      dispatch(prependExpense(expense));
      router.replace('/expenses');
    } catch (err) {
      console.error(err);
      setError('Failed to save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pt-4 pb-8">

      {/* ── Amount ── */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Amount · {currency}
        </label>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-3xl font-bold text-muted-foreground">{symbol}</span>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      {/* ── Category ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Category</label>
        <CategoryPicker
          type="expense"
          value={categoryId || undefined}
          onChange={handleCategoryChange}
          placeholder="Select category"
          parentsOnly
        />
      </div>

      {/* ── Split (right after category, only when both amount + category set) ── */}
      {numAmount > 0 && categoryId && (
        <SplitEditor
          total={numAmount}
          currency={currency}
          parentCategoryId={categoryId}
          splits={splits}
          onChange={setSplits}
          open={splitOpen}
          onToggle={() => setSplitOpen(!splitOpen)}
        />
      )}

      {/* ── Date ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* ── Payment method ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Payment Method</label>
        <div className="flex gap-2">
          {PAYMENT_METHODS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPaymentMethod(value)}
              className={cn(
                'flex-1 rounded-xl border py-3 text-sm font-medium transition-colors',
                paymentMethod === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Store ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Store / Place <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="Shufersal, Amazon..."
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
        />
      </div>

      {/* ── Comment ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Comment <span className="text-xs text-muted-foreground font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Note..."
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
        />
      </div>

      {/* ── Privacy ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Privacy</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPrivacy('regular')}
            className={cn(
              'flex-1 flex flex-col items-center rounded-xl border py-3 text-sm transition-colors',
              privacy === 'regular'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            <span className="text-base">👤</span>
            <span className="font-medium mt-0.5">Regular</span>
            <span className="text-xs opacity-70">In family stats</span>
          </button>
          <button
            type="button"
            onClick={() => setPrivacy('secret')}
            className={cn(
              'flex-1 flex flex-col items-center rounded-xl border py-3 text-sm transition-colors',
              privacy === 'secret'
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            <span className="text-base">🔒</span>
            <span className="font-medium mt-0.5">Secret</span>
            <span className="text-xs opacity-70">Hidden from family</span>
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
      )}

      {/* ── Save ── */}
      <button
        type="submit"
        disabled={!canSave || loading}
        className={cn(
          'w-full rounded-2xl py-4 text-base font-semibold text-primary-foreground transition-all',
          canSave
            ? 'bg-primary shadow-lg shadow-primary/25 active:scale-[0.98]'
            : 'bg-muted text-muted-foreground cursor-not-allowed',
          loading && 'opacity-70'
        )}
      >
        {loading ? 'Saving...' : 'Save Expense'}
      </button>
    </form>
  );
}
