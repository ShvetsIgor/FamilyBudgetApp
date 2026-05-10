'use client';

import { Plus, Trash2, ChevronDown } from 'lucide-react';
import { CategoryPicker } from '@/features/categories/components/CategoryPicker';
import { calculateSplit } from '@/features/expenses/utils/splitAlgorithm';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import type { SplitItem, Currency } from '@/shared/types';

interface Props {
  total: number;
  currency: Currency;
  mainCategoryId: string;
  splits: SplitItem[];
  onChange: (splits: SplitItem[]) => void;
  open: boolean;
  onToggle: () => void;
}

export function SplitEditor({ total, currency, mainCategoryId, splits, onChange, open, onToggle }: Props) {
  const { mainAmount, isValid } = calculateSplit(total, splits);
  const symbol = getCurrencySymbol(currency);

  function addRow() {
    onChange([...splits, { categoryId: '', amount: 0 }]);
  }

  function updateRow(idx: number, patch: Partial<SplitItem>) {
    onChange(splits.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeRow(idx: number) {
    onChange(splits.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
      >
        <span className="flex items-center gap-2">
          Split Expense
          {splits.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-semibold">
              {splits.length}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-border p-3 flex flex-col gap-3">
          {/* Remainder display */}
          <div className={cn(
            'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
            isValid ? 'bg-muted' : 'bg-destructive/10'
          )}>
            <span className="text-muted-foreground">Remaining in main category</span>
            <span className={cn('font-semibold', !isValid && 'text-destructive')}>
              {symbol}{mainAmount.toFixed(2)}
            </span>
          </div>

          {/* Split rows */}
          {splits.map((split, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1 min-w-0">
                <CategoryPicker
                  type="expense"
                  value={split.categoryId || undefined}
                  onChange={(id) => updateRow(idx, { categoryId: id })}
                  placeholder="Category"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm text-muted-foreground">{symbol}</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={split.amount || ''}
                  onChange={(e) => updateRow(idx, { amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="w-20 rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-right"
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="rounded-lg p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add split
          </button>

          {!isValid && (
            <p className="text-xs text-destructive">
              Split total exceeds the expense amount. Reduce split amounts.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
