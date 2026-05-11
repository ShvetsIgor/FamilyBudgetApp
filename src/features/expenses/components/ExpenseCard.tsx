'use client';

import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { format } from 'date-fns';
import { cn } from '@/shared/utils/cn';
import type { SerializableExpense } from '@/shared/types';

interface Props {
  expense: SerializableExpense;
  onClick?: () => void;
}

const PAYMENT_ICONS: Record<string, string> = {
  card: '💳',
  cash: '💵',
  other: '🔄',
};

export function ExpenseCard({ expense, onClick }: Props) {
  const categories = useAppSelector((s) => s.categories.expense);
  const category = categories.find((c) => c.id === expense.categoryId);
  const t = useT();

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
    >
      {category ? (
        <CategoryIcon icon={category.icon} color={category.color} size="md" />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {expense.store || (category ? t.cat(category.name) : 'Expense')}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <span>{category && t.cat(category.name)}</span>
          {expense.splits.length > 0 && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">
              split {expense.splits.length + 1}
            </span>
          )}
          <span>·</span>
          <span>{PAYMENT_ICONS[expense.paymentMethod]}</span>
          {expense.privacy === 'secret' && <span>🔒</span>}
        </p>
      </div>

      <span className={cn('text-sm font-semibold shrink-0 tabular-nums')}>
        {expense.amount > 0 ? '-' : ''}{formatAmount(expense.amount, expense.currency)}
      </span>
    </button>
  );
}
