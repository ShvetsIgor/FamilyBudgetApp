'use client';

import { format, parseISO } from 'date-fns';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { recurringProgress } from '@/features/recurring/utils/progress';
import { recurringStatus } from '@/features/recurring/utils/status';
import { recurringFreqLabel, recurringTypeIcon } from '@/features/recurring/utils/labels';
import { formatAmount } from '@/shared/utils/currency';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import type { Category, SerializableRecurringPayment } from '@/shared/types';

export interface RecurringListRowProps {
  item: SerializableRecurringPayment;
  category?: Category;
  /** Desktop: this row is the one open in the side editor */
  selected?: boolean;
  actionsOpen: boolean;
  /** Inline «другая сумма» editor value; null = editor closed */
  payEditValue: string | null;
  onOpen: () => void;
  onToggleActions: () => void;
  onEdit: () => void;
  onMarkPaid: (amount?: number) => void;
  onStartPayEdit: () => void;
  onChangePayEdit: (value: string) => void;
  onCancelPayEdit: () => void;
  onSkip: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

/**
 * One template in the list.
 *
 * The line under the name used to carry four facts (kind · frequency · date ·
 * payment N of M) on a single non-wrapping line — on a phone the middle of it
 * was simply cut off. It now carries the status alone: the only part that asks
 * the user to do something. The kind moved to the detail screen (the category
 * icon and the coloured edge already carry it), the term progress moved under
 * the amount, and a frequency is printed only when it is NOT monthly, monthly
 * being the norm for a page whose totals are all «per month».
 */
export function RecurringListRow({
  item, category, selected = false, actionsOpen, payEditValue,
  onOpen, onToggleActions, onEdit, onMarkPaid, onStartPayEdit, onChangePayEdit,
  onCancelPayEdit, onSkip, onToggleActive, onDelete,
}: RecurringListRowProps) {
  const t = useT();
  const dfLocale = useDateFnsLocale();

  const status = recurringStatus(item);
  const progress = recurringProgress(item);
  const borderColor = category?.color ?? 'hsl(var(--muted-foreground))';

  const statusText =
    status.tone === 'completed' ? t('recurring.completed')
    : status.tone === 'paused' ? t('recurring.paused')
    : status.tone === 'overdue' ? t('recurring.overdueDays', { n: -status.days })
    : status.tone === 'due' ? t('recurring.dueToday')
    : status.tone === 'soon' ? t('recurring.inDays', { n: status.days })
    : format(parseISO(item.nextDueDate), 'd MMM', { locale: dfLocale });

  const statusClass =
    status.tone === 'completed' ? 'font-semibold text-emerald-600'
    : status.tone === 'overdue' || status.tone === 'due' ? 'font-semibold text-destructive'
    : status.tone === 'soon' ? 'font-semibold text-amber-600'
    : '';

  const payEditing = payEditValue !== null;
  const payAmount = parseFloat((payEditValue ?? '').replace(',', '.'));

  return (
    <div
      className={cn(
        'transition-colors hover:bg-muted/20',
        !item.isActive && 'opacity-50',
        selected && 'bg-primary/5',
      )}
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex min-h-16 items-center gap-3 py-2 pl-3 pr-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          {category
            ? <CategoryIcon icon={category.icon} color={category.color} size="sm" />
            : <CategoryIcon icon={recurringTypeIcon(item.type)} color={borderColor} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold leading-tight">{item.name}</p>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[11px] text-muted-foreground">
              <span className={cn('truncate', statusClass)}>{statusText}</span>
              {item.frequency !== 'monthly' && (
                <>
                  <span className="text-muted-foreground/35">·</span>
                  <span className="shrink-0">{recurringFreqLabel(item.frequency, t)}</span>
                </>
              )}
            </p>
          </div>
        </button>

        <div className="shrink-0 text-right">
          <p className="text-[15px] font-black tabular-nums tracking-[-0.02em]">
            {item.amount > 0 ? '-' : ''}{formatAmount(item.amount, item.currency)}
          </p>
          {progress.pendingNumber > 0 && (
            <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {progress.pendingNumber}/{progress.total}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleActions}
          className="fb-touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t('nav.more')}
          aria-expanded={actionsOpen}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {actionsOpen && (
        <div className="border-t border-border/30 px-3 py-2">
          {payEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                autoFocus
                value={payEditValue}
                onChange={(e) => onChangePayEdit(e.target.value)}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-right text-sm font-extrabold tabular-nums outline-hidden focus:border-primary"
              />
              <button
                onClick={() => onMarkPaid(payAmount || 0)}
                disabled={!(payAmount > 0)}
                className="min-h-11 rounded-xl bg-emerald-500/10 px-4 text-sm font-bold text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
              >
                {t('recurring.markPaid')}
              </button>
              <button onClick={onCancelPayEdit} className="fb-touch-target h-11 w-11 rounded-xl bg-muted text-muted-foreground">✕</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onEdit}
                className="min-h-11 shrink-0 rounded-xl bg-muted px-3 text-xs font-semibold text-muted-foreground"
              >
                {t('common.edit')}
              </button>
              {item.isActive && status.days <= 0 && status.tone !== 'completed' && (
                <>
                  <button onClick={() => onMarkPaid()} className="min-h-11 shrink-0 rounded-xl bg-emerald-500/10 px-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {t('recurring.markPaid')}
                  </button>
                  <button onClick={onStartPayEdit} className="min-h-11 shrink-0 rounded-xl bg-muted px-3 text-xs font-semibold text-muted-foreground">
                    {t('recurring.payDifferent')}
                  </button>
                </>
              )}
              {item.isActive && status.tone === 'overdue' && (
                <button onClick={onSkip} className="min-h-11 shrink-0 rounded-xl bg-muted px-3 text-xs font-semibold text-muted-foreground">
                  {t('recurring.skip')}
                </button>
              )}
              <button
                onClick={onToggleActive}
                className="min-h-11 shrink-0 rounded-xl bg-muted px-3 text-xs font-semibold text-muted-foreground"
              >
                {item.isActive ? t('recurring.pause') : t('recurring.resume')}
              </button>
              <button
                onClick={onDelete}
                className="fb-touch-target flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-destructive/5 px-3 text-xs font-semibold text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                {t('common.delete')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
