'use client';

import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import type { SerializableIncome } from '@/shared/types';

interface Props {
  income: SerializableIncome;
  onDelete?: () => void;
  onEdit?: () => void;
}

const METHOD_ICONS: Record<string, string> = {
  card: '💳',
  cash: '💵',
  bank: '🏦',
  other: '🔄',
};

export function IncomeCard({ income, onDelete, onEdit }: Props) {
  const categories = useAppSelector((s) => s.categories.income);
  const category = categories.find((c) => c.id === income.categoryId);

  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      {category ? (
        <CategoryIcon icon={category.icon} color={category.color} size="md" />
      ) : (
        <div className="h-10 w-10 rounded-xl bg-muted shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {income.comment || category?.name || 'Income'}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <span>{category?.name}</span>
          <span>·</span>
          <span>{METHOD_ICONS[income.method] ?? '🔄'}</span>
          {income.privacy === 'secret' && <span>🔒</span>}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm font-semibold tabular-nums text-emerald-500">
          +{formatAmount(income.amount, income.currency)}
        </span>
        {onEdit && (
          <button
            onClick={onEdit}
            className="text-muted-foreground hover:text-primary transition-colors text-xs px-1"
          >
            ✎
          </button>
        )}
        {onDelete && (
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors text-xs"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
