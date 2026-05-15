'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { removeExpense } from '@/features/expenses/store/expensesSlice';
import { deleteExpense } from '@/features/expenses/services/expensesService';
import { reverseContribution } from '@/features/savings/services/savingsService';
import { updateGoalItem } from '@/features/savings/store/savingsSlice';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const expense = useAppSelector((s) => s.expenses.list.find((e) => e.id === id));
  const categories = useAppSelector((s) => s.categories.expense);
  const goals = useAppSelector((s) => s.savings.list);
  const t = useT();

  const PAYMENT_LABELS: Record<string, string> = {
    card: `💳 ${t('expense.card')}`,
    cash: `💵 ${t('expense.cash')}`,
    other: `🔄 ${t('expense.other')}`,
  };

  if (!expense) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="font-medium">{t('expense.notFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          {t('expense.goBack')}
        </button>
      </div>
    );
  }

  const category = categories.find((c) => c.id === expense.categoryId);
  const subcategory = categories.find((c) => c.id === expense.subcategoryId);

  async function handleDelete() {
    if (!user) return;
    if (!confirm(t('expense.confirmDelete'))) return;
    await deleteExpense(user.id, expense!);
    dispatch(removeExpense(expense!.id));

    if (expense!.goalId) {
      const goal = goals.find((g) => g.id === expense!.goalId);
      if (goal) {
        const updated = await reverseContribution(user.id, goal, expense!.amount);
        dispatch(updateGoalItem(updated));
      }
    }

    router.back();
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
      {/* Back + Edit */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground">
          {t('expense.back')}
        </button>
        <button
          onClick={() => router.push(`/expenses/${id}/edit`)}
          className="text-sm font-medium text-primary hover:underline"
        >
          {t('expense.edit')}
        </button>
      </div>

      {/* Amount card */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-3">
        {category && <CategoryIcon icon={category.icon} color={category.color} size="lg" />}
        <p className="text-3xl font-bold tabular-nums text-destructive">
          {expense.amount > 0 ? '-' : ''}{formatAmount(expense.amount, expense.currency)}
        </p>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(expense.date), 'EEEE, d MMMM yyyy', { locale: ru })}
        </p>
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <Row label={t('expense.category')} value={category?.name ?? '—'} />
        {subcategory && <Row label={t('expense.subcategory')} value={subcategory.name} />}
        {expense.store && <Row label={t('expense.store')} value={expense.store} />}
        <Row label={t('expense.payment')} value={PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod} />
        <Row label={t('expense.privacy2')} value={expense.privacy === 'secret' ? `🔒 ${t('expense.secret')}` : t('expense.regular')} />
        {expense.comment && <Row label={t('expense.comment')} value={expense.comment} />}
        {expense.tags.length > 0 && <Row label={t('expense.tags')} value={expense.tags.join(', ')} />}
      </div>

      {/* Splits */}
      {expense.splits.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-3">{t('expense.split2')}</p>
          <div className="flex flex-col gap-2">
            {expense.splits.map((sp, i) => {
              const spCat = categories.find((c) => c.id === sp.categoryId);
              return (
                <div key={i} className="flex items-center gap-2">
                  {spCat && <CategoryIcon icon={spCat.icon} color={spCat.color} size="sm" />}
                  <span className="flex-1 text-sm">{spCat?.name ?? sp.categoryId}</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatAmount(sp.amount, expense.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete */}
      <button
        onClick={handleDelete}
        className="rounded-2xl border border-destructive/40 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
      >
        {t('expense.delete')}
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
