'use client';

import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { calculateSplit } from '@/features/expenses/utils/splitAlgorithm';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { cn } from '@/shared/utils/cn';
import type { SplitItem, Currency } from '@/shared/types';

interface Props {
  total: number;
  currency: Currency;
  parentCategoryId: string;
  splits: SplitItem[];
  onChange: (splits: SplitItem[]) => void;
  open: boolean;
  onToggle: () => void;
}

export function SplitEditor({ total, currency, parentCategoryId, splits, onChange, open, onToggle }: Props) {
  const allCategories = useAppSelector((s) => s.categories.expense);
  const subcategories = allCategories.filter((c) => c.parentId === parentCategoryId);
  const { mainAmount, isValid } = calculateSplit(total, splits);
  const symbol = getCurrencySymbol(currency);

  // No subcategories — nothing to split
  if (subcategories.length === 0) return null;

  function toggleSubcategory(catId: string) {
    const exists = splits.find((s) => s.categoryId === catId);
    if (exists) {
      onChange(splits.filter((s) => s.categoryId !== catId));
    } else {
      onChange([...splits, { categoryId: catId, amount: 0 }]);
    }
  }

  function updateAmount(catId: string, amount: number) {
    onChange(splits.map((s) => (s.categoryId === catId ? { ...s, amount } : s)));
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>Split by subcategory</span>
          {splits.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-semibold">
              {splits.length} selected
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-border p-3 flex flex-col gap-2">
          {/* Remainder */}
          <div className={cn(
            'flex items-center justify-between rounded-lg px-3 py-2 text-sm mb-1',
            isValid ? 'bg-muted' : 'bg-destructive/10'
          )}>
            <span className="text-muted-foreground">Unassigned (main category)</span>
            <span className={cn('font-semibold tabular-nums', !isValid && 'text-destructive')}>
              {symbol}{mainAmount % 1 === 0 ? mainAmount : mainAmount.toFixed(2)}
            </span>
          </div>

          {/* Subcategory rows */}
          {subcategories.map((sub) => {
            const split = splits.find((s) => s.categoryId === sub.id);
            const active = !!split;

            return (
              <div key={sub.id} className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                active ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
              )}>
                <button
                  type="button"
                  onClick={() => toggleSubcategory(sub.id)}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left"
                >
                  <CategoryIcon icon={sub.icon} color={sub.color} size="sm" />
                  <span className={cn('text-sm truncate', active ? 'font-medium' : 'text-muted-foreground')}>
                    {sub.name}
                  </span>
                </button>

                {active && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm text-muted-foreground">{symbol}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={split.amount || ''}
                      onChange={(e) => updateAmount(sub.id, parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-right outline-none focus:border-primary"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            );
          })}

          {!isValid && (
            <p className="text-xs text-destructive px-1">
              Total split amount exceeds the expense amount.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
