'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parseISO, differenceInDays, endOfMonth } from 'date-fns';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { recurringTypeIcon } from '@/shared/config/domainIcons';
import { markAsPaid } from '@/features/recurring/services/recurringService';
import { updateRecurringItem } from '@/features/recurring/store/recurringSlice';
import { addExpense } from '@/features/expenses/services/expensesService';
import { resolveExpensePrivacy } from '@/features/expenses/utils/expensePrivacy';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import type { SerializableRecurringPayment } from '@/shared/types';

function DayPill({ days }: { days: number }) {
  const t = useT();
  if (days < 0) {
    return (
      <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
        {t('recurring.overdue')}
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
        {t('recurring.todayBang')}
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
        {t('recurring.daysShort', { days })}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
      {t('recurring.daysShort', { days })}
    </span>
  );
}

interface Props {
  withinDays?: number;
  maxItems?: number;
  compact?: boolean;
  embedded?: boolean;
}

export function UpcomingBills({ withinDays = 30, maxItems, compact = false, embedded = false }: Props) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);
  const { list } = useAppSelector((s) => s.recurring);
  const t = useT();
  const dfLocale = useDateFnsLocale();
  const [payingId, setPayingId] = useState<string | null>(null);

  const monthEnd = endOfMonth(new Date());
  const upcoming = list
    .filter((r) => {
      if (!r.isActive) return false;
      const due = parseISO(r.nextDueDate);
      const days = differenceInDays(due, new Date());
      return days >= -7 && due <= monthEnd;
    })
    .sort((a, b) => parseISO(a.nextDueDate).getTime() - parseISO(b.nextDueDate).getTime())
    .slice(0, maxItems);

  if (upcoming.length === 0) return null;

  async function handlePay(item: SerializableRecurringPayment, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || payingId) return;
    setPayingId(item.id);
    try {
      if (item.categoryId) {
        const exp = await addExpense({
          userId: user.id, amount: item.amount, currency: item.currency,
          categoryId: item.categoryId, date: parseISO(item.nextDueDate),
          paymentMethod: 'card', splits: [], tags: ['recurring'],
          privacy: resolveExpensePrivacy({ categories, categoryId: item.categoryId }),
          store: item.name,
          comment: item.comment || undefined,
          recurringId: item.id,
        });
        dispatch(prependExpense(exp));
      }
      dispatch(updateRecurringItem(await markAsPaid(user.id, item)));
    } finally {
      setPayingId(null);
    }
  }

  const rows = upcoming.map((item) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    const days = differenceInDays(parseISO(item.nextDueDate), new Date());
    const isDue = days <= 0;
    return (
      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
        {cat ? (
          <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
        ) : (
          <StickerIcon icon={recurringTypeIcon(item.type)} color="hsl(var(--muted-foreground))" className="h-5 w-5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(item.nextDueDate), 'd MMMM', { locale: dfLocale })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm font-bold tabular-nums">
            {item.amount > 0 ? '-' : ''}{formatAmount(item.amount, item.currency)}
          </span>
          {isDue ? (
            <button
              onClick={(e) => handlePay(item, e)}
              disabled={payingId === item.id}
              className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
            >
              {payingId === item.id ? '…' : t('recurring.markPaid')}
            </button>
          ) : (
            <DayPill days={days} />
          )}
        </div>
      </div>
    );
  });

  // embedded — renders bare rows inside an existing card (no wrapper, no header)
  if (embedded) {
    return <div className="divide-y divide-border">{rows}</div>;
  }

  // compact — standalone card with header
  if (compact) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('recurring.upcomingBills')}</h2>
          <Link href="/recurring" className="text-xs text-primary hover:underline">{t('recurring.seeAll')}</Link>
        </div>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {rows}
        </div>
      </div>
    );
  }

  // non-compact — mobile expenses page style
  return (
    <div className="flex flex-col gap-1 mx-4 mb-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
        {t('recurring.upcomingBills')}
      </p>
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 divide-y divide-border overflow-hidden">
        {rows}
      </div>
    </div>
  );
}
