'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependExpense, updateExpense as updateExpenseAction } from '@/features/expenses/store/expensesSlice';
import { addExpense, updateExpense } from '@/features/expenses/services/expensesService';
import { addContribution } from '@/features/savings/services/savingsService';
import { updateGoalItem } from '@/features/savings/store/savingsSlice';
import { CategoryPicker } from '@/features/categories/components/CategoryPicker';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { SplitEditor } from './SplitEditor';
import { calculateSplit } from '@/features/expenses/utils/splitAlgorithm';
import { getCurrencySymbol, blockInvalidAmountKeys, parseLocalDate } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import type { Privacy, PaymentMethod, SplitItem, SerializableExpense } from '@/shared/types';

interface Props {
  initialExpense?: SerializableExpense;
}

export function ExpenseForm({ initialExpense }: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const symbol = getCurrencySymbol(currency);
  const expenseCategories = useAppSelector((s) => s.categories.expense);
  const goals = useAppSelector((s) => s.savings.list);
  const t = useT();

  const isEdit = !!initialExpense;

  const [amount, setAmount] = useState(initialExpense?.amount.toString() ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialExpense?.categoryId ?? '');
  const [categoryId, setCategoryId] = useState(initialExpense?.categoryId ?? '');
  const [goalId, setGoalId] = useState(initialExpense?.goalId ?? '');
  const [splits, setSplits] = useState<SplitItem[]>(initialExpense?.splits ?? []);
  const [splitOpen, setSplitOpen] = useState(false);
  const [date, setDate] = useState(
    initialExpense ? format(parseISO(initialExpense.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(initialExpense?.paymentMethod ?? 'card');
  const [store, setStore] = useState(initialExpense?.store ?? '');
  const [comment, setComment] = useState(initialExpense?.comment ?? '');
  const [privacy, setPrivacy] = useState<Privacy>(initialExpense?.privacy ?? 'regular');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user) return null;

  const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
    { value: 'card', label: `💳 ${t('expense.card')}` },
    { value: 'cash', label: `💵 ${t('expense.cash')}` },
    { value: 'other', label: `🔄 ${t('expense.other')}` },
  ];

  const numAmount = parseFloat(amount) || 0;
  const { isValid: splitValid } = calculateSplit(numAmount, splits);
  const selectedCategory = expenseCategories.find((c) => c.id === selectedCategoryId);
  const isSavingsCategory = selectedCategory?.name?.toLowerCase() === 'savings';
  const groupCats = expenseCategories.filter((c) => c.folderId === selectedCategoryId && !c.archived);
  const canSave = numAmount > 0 && categoryId && splitValid && (!isSavingsCategory || goalId !== '');

  function handleCategoryChange(id: string) {
    setSelectedCategoryId(id);
    setCategoryId(id);
    setGoalId('');
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

      if (isEdit && initialExpense) {
        const updated = await updateExpense({
          id: initialExpense.id,
          userId: user!.id,
          amount: numAmount,
          currency,
          categoryId,
          date: parseLocalDate(date),
          paymentMethod,
          store: store || undefined,
          tags: initialExpense.tags,
          comment: comment || undefined,
          privacy,
          splits: validSplits,
          goalId: goalId || undefined,
        });
        dispatch(updateExpenseAction(updated));
        router.replace(`/expenses/${initialExpense.id}`);
      } else {
        const expense = await addExpense({
          userId: user!.id,
          amount: numAmount,
          currency,
          categoryId,
          date: parseLocalDate(date),
          paymentMethod,
          store: store || undefined,
          tags: [],
          comment: comment || undefined,
          privacy,
          splits: validSplits,
          goalId: goalId || undefined,
        });
        dispatch(prependExpense(expense));

        if (goalId) {
          const goal = goals.find((g) => g.id === goalId);
          if (goal) {
            const updated = await addContribution(user!.id, goal, { amount: numAmount });
            dispatch(updateGoalItem(updated));
          }
        }

        router.replace('/expenses');
      }
    } catch (err) {
      console.error(err);
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pt-4 pb-8">

      {/* ── Amount ── */}
      <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t('expense.amount')} · {currency}
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
            onKeyDown={blockInvalidAmountKeys}
            placeholder="0.00"
            className="flex-1 bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground/30"
          />
        </div>
      </div>

      {/* ── Category ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('expense.category')}</label>
        <CategoryPicker
          type="expense"
          value={selectedCategoryId || undefined}
          onChange={handleCategoryChange}
          placeholder={t('categories.selectCategory')}
          ungroupedOnly
        />
        {groupCats.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {groupCats.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setCategoryId(categoryId === sub.id ? parentCategoryId : sub.id)}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors',
                  categoryId === sub.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted'
                )}
              >
                <StickerIcon icon={sub.icon} color={sub.color} className="h-3.5 w-3.5" />
                <span>{t.cat(sub.name)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Savings goal picker ── */}
      {isSavingsCategory && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">
            {t('expense.savingGoal')} <span className="text-xs text-destructive">*</span>
          </label>
          {goals.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-xl border border-border bg-card px-4 py-3">
              {t('expense.noGoalsYet')}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {goals.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoalId(g.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors text-left',
                    goalId === g.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-foreground hover:bg-muted'
                  )}
                >
                  <span className="text-xl">{g.icon}</span>
                  <span className="flex-1 font-medium">{g.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {g.currentAmount} / {g.targetAmount}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Split ── */}
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
        <label className="text-sm font-medium">{t('expense.date')}</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* ── Payment method ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('expense.paymentMethod')}</label>
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
          {t('expense.store')} <span className="text-xs text-muted-foreground font-normal">({t('expense.optional')})</span>
        </label>
        <input
          type="text"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder={t('expense.storePlaceholder')}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
        />
      </div>

      {/* ── Comment ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          {t('expense.comment')} <span className="text-xs text-muted-foreground font-normal">({t('expense.optional')})</span>
        </label>
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('expense.commentPlaceholder')}
          className="rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
        />
      </div>

      {/* ── Privacy ── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('expense.privacy')}</label>
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
            <span className="font-medium mt-0.5">{t('expense.regular')}</span>
            <span className="text-xs opacity-70">{t('expense.inFamilyStats')}</span>
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
            <span className="font-medium mt-0.5">{t('expense.secret')}</span>
            <span className="text-xs opacity-70">{t('expense.hiddenFromFamily')}</span>
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
        {loading ? t('expense.saving') : isEdit ? t('expense.saveChanges') : t('expense.save')}
      </button>
    </form>
  );
}
