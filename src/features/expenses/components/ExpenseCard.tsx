'use client';

import { useState } from 'react';
import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
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
  const currency = useAppSelector((s) => s.ui.currency);
  const category = categories.find((c) => c.id === expense.categoryId);
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // Only count parts that have non-zero amounts
  const splitSum = expense.splits.reduce((s, x) => s + x.amount, 0);
  const parentPortion = expense.amount - splitSum;
  const effectiveParts =
    expense.splits.filter((s) => s.amount > 0).length + (parentPortion > 0.01 ? 1 : 0);
  const hasSplit = effectiveParts > 1;

  return (
    <div className="flex flex-col">
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
            {expense.comment || expense.store || (category ? t.cat(category.name) : 'Expense')}
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <span>{category && t.cat(category.name)}</span>
            {hasSplit && (
              <button
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] hover:bg-muted/80 transition-colors"
              >
                split {effectiveParts} {expanded ? '▲' : '▼'}
              </button>
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

      {/* Expanded split breakdown */}
      {hasSplit && expanded && (
        <div className="px-4 pb-2 flex flex-col gap-1 border-t border-border/50 bg-muted/20">
          {parentPortion > 0.01 && category && (
            <div className="flex items-center gap-2 py-1.5 pl-12">
              <span className="text-xs text-muted-foreground flex-1">{t.cat(category.name)}</span>
              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                -{formatAmount(parentPortion, expense.currency)}
              </span>
            </div>
          )}
          {expense.splits.filter((s) => s.amount > 0).map((split, i) => {
            const splitCat = categories.find((c) => c.id === split.categoryId);
            return (
              <div key={i} className="flex items-center gap-2 py-1.5 pl-12">
                <span className="text-xs text-muted-foreground flex-1">
                  {splitCat ? t.cat(splitCat.name) : '—'}
                </span>
                <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                  -{formatAmount(split.amount, expense.currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
