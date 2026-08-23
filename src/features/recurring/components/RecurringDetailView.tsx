'use client';

import { format, parseISO } from 'date-fns';
import { ChevronRight, Trash2 } from 'lucide-react';
import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
import { recurringProgress } from '@/features/recurring/utils/progress';
import { recurringStatus, type RecurringStatusTone } from '@/features/recurring/utils/status';
import {
  recurringFreqLabel, recurringTypeIcon, recurringTypeLabel,
} from '@/features/recurring/utils/labels';
import { monthlyEquivalent } from '@/features/recurring/utils/schedule';
import { groupByCurrency } from '@/shared/utils/currencyTotals';
import { formatAmount } from '@/shared/utils/currency';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import type { Category, SerializableExpense, SerializableRecurringPayment } from '@/shared/types';

const TONE_CLASS: Record<RecurringStatusTone, string> = {
  completed: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  paused: 'bg-muted text-muted-foreground',
  overdue: 'bg-destructive/10 text-destructive',
  due: 'bg-destructive/10 text-destructive',
  soon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  upcoming: 'bg-muted text-muted-foreground',
};

export interface RecurringDetailViewProps {
  item: SerializableRecurringPayment;
  category?: Category;
  /** Booked payments; null while still loading */
  history: SerializableExpense[] | null;
  busy?: boolean;
  /** Inline «другая сумма» editor value; null = editor closed */
  payEditValue: string | null;
  onBack: () => void;
  onEdit: () => void;
  onMarkPaid: (amount?: number) => void;
  onStartPayEdit: () => void;
  onChangePayEdit: (value: string) => void;
  onCancelPayEdit: () => void;
  onSkip: () => void;
  onToggleActive: () => void;
  onFinish: () => void;
  onDelete: () => void;
  onOpenExpense: (expenseId: string) => void;
}

/**
 * Everything known about one recurring payment: what kind it is, when the next
 * one falls due, how far a fixed term has run and which payments were actually
 * booked. Presentation only — the page above it owns loading and writes.
 */
export function RecurringDetailView({
  item, category, history, busy = false, payEditValue,
  onBack, onEdit, onMarkPaid, onStartPayEdit, onChangePayEdit, onCancelPayEdit,
  onSkip, onToggleActive, onFinish, onDelete, onOpenExpense,
}: RecurringDetailViewProps) {
  const t = useT();
  const dfLocale = useDateFnsLocale();

  const status = recurringStatus(item);
  const progress = recurringProgress(item);
  const typeLabel = recurringTypeLabel(item, t);
  const freqLabel = recurringFreqLabel(item.frequency, t);
  const dueDateText = format(parseISO(item.nextDueDate), 'd MMMM yyyy', { locale: dfLocale });

  const statusText =
    status.tone === 'completed' ? t('recurring.completed')
    : status.tone === 'paused' ? t('recurring.paused')
    : status.tone === 'overdue' ? t('recurring.overdueDays', { n: -status.days })
    : status.tone === 'due' ? t('recurring.dueToday')
    : status.tone === 'soon' ? t('recurring.inDays', { n: status.days })
    : dueDateText;

  // Real money booked against this template — grouped per currency, since an
  // edited template can have booked payments in a currency it no longer uses
  const paidTotals = groupByCurrency((history ?? []).map((e) => ({ amount: e.amount, currency: e.currency })));
  const payable = item.isActive && (status.tone === 'overdue' || status.tone === 'due');
  const payEditing = payEditValue !== null;
  const payAmount = parseFloat((payEditValue ?? '').replace(',', '.'));

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="fb-touch-target flex min-h-11 items-center text-sm text-muted-foreground">
          {t('common.back')}
        </button>
        <button
          onClick={onEdit}
          className="fb-touch-target flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
        >
          {t('common.edit')}
        </button>
      </div>

      {/* Identity + price */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6 text-center">
        {category
          ? <CategoryIcon icon={category.icon} color={category.color} size="lg" />
          : <CategoryIcon icon={recurringTypeIcon(item.type)} color="hsl(var(--muted-foreground))" size="lg" />}
        <div>
          <p className="text-lg font-bold leading-tight">{item.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[typeLabel, freqLabel].filter(Boolean).join(' · ')}
          </p>
        </div>
        <p className="text-3xl font-black tabular-nums tracking-[-0.03em] text-destructive">
          -{formatAmount(item.amount, item.currency)}
        </p>
        <span className={cn('rounded-full px-3 py-1 text-xs font-bold', TONE_CLASS[status.tone])}>
          {statusText}
        </span>
      </div>

      {/* Next payment + what can be done about it */}
      {status.tone !== 'completed' && (
        <Section title={t('recurring.nextPayment')}>
          <div className="flex items-baseline justify-between gap-3 px-4 py-3">
            <span className="text-sm font-semibold">{dueDateText}</span>
            {progress.pendingNumber > 0 && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t('recurring.paymentNofM', { n: progress.pendingNumber, m: progress.total })}
              </span>
            )}
          </div>
          <div className="px-4 pb-4 pt-3">
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
                  onClick={() => onMarkPaid(payAmount)}
                  disabled={busy || !(payAmount > 0)}
                  className="min-h-11 rounded-xl bg-emerald-500/10 px-4 text-sm font-bold text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                >
                  {t('recurring.markPaid')}
                </button>
                <button onClick={onCancelPayEdit} className="fb-touch-target h-11 w-11 rounded-xl bg-muted text-muted-foreground">✕</button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {payable && (
                  <>
                    <button
                      onClick={() => onMarkPaid()}
                      disabled={busy}
                      className="min-h-11 rounded-xl bg-emerald-500/10 px-4 text-sm font-bold text-emerald-700 disabled:opacity-50 dark:text-emerald-300"
                    >
                      {t('recurring.markPaid')}
                    </button>
                    <button
                      onClick={onStartPayEdit}
                      disabled={busy}
                      className="min-h-11 rounded-xl bg-muted px-4 text-sm font-semibold text-muted-foreground disabled:opacity-50"
                    >
                      {t('recurring.payDifferent')}
                    </button>
                  </>
                )}
                {item.isActive && status.tone === 'overdue' && (
                  <button
                    onClick={onSkip}
                    disabled={busy}
                    className="min-h-11 rounded-xl bg-muted px-4 text-sm font-semibold text-muted-foreground disabled:opacity-50"
                  >
                    {t('recurring.skip')}
                  </button>
                )}
                <button
                  onClick={onToggleActive}
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-muted px-4 text-sm font-semibold text-muted-foreground disabled:opacity-50"
                >
                  {item.isActive ? t('recurring.pause') : t('recurring.resume')}
                </button>
                {item.isActive && (
                  <button
                    onClick={onFinish}
                    disabled={busy}
                    className="min-h-11 rounded-xl bg-muted px-4 text-sm font-semibold text-muted-foreground disabled:opacity-50"
                  >
                    {t('recurring.finish')}
                  </button>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Fixed term — the «сколько ещё платить» block */}
      {progress.fixedTerm && (
        <Section title={t('recurring.termTitle')}>
          <div className="px-4 py-3">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">
                {t('recurring.schedulePaid', { n: progress.paid, m: progress.total })}
              </span>
              <span className="shrink-0 text-xs font-bold tabular-nums text-muted-foreground">
                {Math.round(progress.ratio * 100)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </div>
          </div>
          <Row label={t('recurring.paymentsLeftLabel')} value={String(progress.left)} />
          <Row label={t('recurring.leftToPay')} value={formatAmount(progress.leftAmount, item.currency)} />
          <Row label={t('recurring.paidSoFar')} value={formatAmount(progress.paidAmount, item.currency)} />
          {progress.lastPaymentDate && (
            <Row
              label={t('recurring.lastPaymentLabel')}
              value={format(parseISO(progress.lastPaymentDate), 'd MMMM yyyy', { locale: dfLocale })}
            />
          )}
        </Section>
      )}

      <Section title={t('recurring.detailsTitle')}>
        <Row
          label={t('recurring.type')}
          value={(
            <span className="inline-flex items-center gap-2">
              <StickerIcon icon={recurringTypeIcon(item.type)} color="hsl(var(--muted-foreground))" className="h-4 w-4" />
              {typeLabel}
            </span>
          )}
        />
        <Row
          label={t('recurring.category')}
          value={category
            ? (
              <span className="inline-flex items-center gap-2">
                <StickerIcon icon={category.icon} color={category.color} className="h-4 w-4" />
                {t.cat(category.name)}
              </span>
            )
            : '—'}
        />
        <Row label={t('recurring.frequency')} value={freqLabel} />
        <Row label={t('recurring.amount')} value={formatAmount(item.amount, item.currency)} />
        {item.frequency !== 'monthly' && (
          <Row
            label={t('recurring.perMonthEquivalent')}
            value={`≈ ${formatAmount(monthlyEquivalent(item.amount, item.frequency), item.currency)}`}
          />
        )}
        <Row
          label={t('recurring.startedOn')}
          value={format(parseISO(item.startDate), 'd MMMM yyyy', { locale: dfLocale })}
        />
        <Row label={t('recurring.remind')} value={t('recurring.remindDays', { n: item.reminderDays })} />
        {item.comment && <Row label={t('recurring.comment')} value={item.comment} />}
      </Section>

      {/* Booked payments — real expenses, not the schedule's arithmetic */}
      <Section title={t('recurring.historyTitle')}>
        {history === null ? (
          <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" /></div>
        ) : history.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted-foreground">{t('recurring.historyEmpty')}</p>
        ) : (
          <>
            {paidTotals.map((total) => (
              <Row
                key={total.currency}
                label={t('recurring.historyTotal')}
                value={<span className="tabular-nums">{formatAmount(total.total, total.currency)}</span>}
              />
            ))}
            {history.map((expense) => (
              <button
                key={expense.id}
                onClick={() => onOpenExpense(expense.id)}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                <span className="flex-1 text-sm">
                  {format(parseISO(expense.date), 'd MMMM yyyy', { locale: dfLocale })}
                </span>
                <span className="text-sm font-bold tabular-nums">
                  -{formatAmount(expense.amount, expense.currency)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </>
        )}
      </Section>

      <button
        onClick={onDelete}
        disabled={busy}
        className="fb-touch-target flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
      >
        <Trash2 className="h-4 w-4" />
        {t('common.delete')}
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="mb-1.5 px-0.5 text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground">
        {title}
      </p>
      <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium">{value}</span>
    </div>
  );
}
