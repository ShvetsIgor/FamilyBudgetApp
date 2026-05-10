'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { removeExpense } from '@/features/expenses/store/expensesSlice';
import { deleteExpense } from '@/features/expenses/services/expensesService';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';

const PAYMENT_LABELS: Record<string, string> = { card: '💳 Card', cash: '💵 Cash', other: '🔄 Other' };

export default function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const expense = useAppSelector((s) => s.expenses.list.find((e) => e.id === id));
  const categories = useAppSelector((s) => s.categories.expense);

  if (!expense) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="font-medium">Expense not found</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          ← Go back
        </button>
      </div>
    );
  }

  const category = categories.find((c) => c.id === expense.categoryId);
  const subcategory = categories.find((c) => c.id === expense.subcategoryId);

  async function handleDelete() {
    if (!user) return;
    if (!confirm('Delete this expense?')) return;
    await deleteExpense(user.id, expense!);
    dispatch(removeExpense(expense!.id));
    router.back();
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-8">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-muted-foreground w-fit">
        ← Back
      </button>

      {/* Amount card */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col items-center gap-3">
        {category && <CategoryIcon icon={category.icon} color={category.color} size="lg" />}
        <p className="text-3xl font-bold tabular-nums text-destructive">
          -{formatAmount(expense.amount, expense.currency)}
        </p>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(expense.date), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <Row label="Category" value={category?.name ?? '—'} />
        {subcategory && <Row label="Subcategory" value={subcategory.name} />}
        {expense.store && <Row label="Store" value={expense.store} />}
        <Row label="Payment" value={PAYMENT_LABELS[expense.paymentMethod] ?? expense.paymentMethod} />
        <Row label="Privacy" value={expense.privacy === 'secret' ? '🔒 Secret' : 'Regular'} />
        {expense.comment && <Row label="Comment" value={expense.comment} />}
        {expense.tags.length > 0 && <Row label="Tags" value={expense.tags.join(', ')} />}
      </div>

      {/* Splits */}
      {expense.splits.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-3">Split</p>
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
        Delete Expense
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
