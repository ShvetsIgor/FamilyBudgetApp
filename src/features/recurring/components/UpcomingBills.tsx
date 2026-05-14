'use client';

import Link from 'next/link';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';

const TYPE_ICONS: Record<string, string> = {
  subscription: '📺', rent: '🏠', utility: '💡',
  credit: '💳', mortgage: '🏦', custom: '🔄',
};

function DayPill({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
        Просрочено
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="rounded-full bg-destructive/15 text-destructive px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
        Сегодня!
      </span>
    );
  }
  if (days <= 7) {
    return (
      <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold whitespace-nowrap">
        {days} дн
      </span>
    );
  }
  return (
    <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
      {days} дн
    </span>
  );
}

interface Props {
  withinDays?: number;
  maxItems?: number;
  compact?: boolean;
}

export function UpcomingBills({ withinDays = 30, maxItems, compact = false }: Props) {
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);
  const { list } = useAppSelector((s) => s.recurring);
  const t = useT();

  const upcoming = list
    .filter((r) => {
      if (!r.isActive) return false;
      const days = differenceInDays(parseISO(r.nextDueDate), new Date());
      return days >= -7 && days <= withinDays;
    })
    .sort((a, b) => parseISO(a.nextDueDate).getTime() - parseISO(b.nextDueDate).getTime())
    .slice(0, maxItems);

  if (upcoming.length === 0) return null;

  if (compact) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('recurring.upcomingBills')}</h2>
          <Link href="/recurring" className="text-xs text-primary hover:underline">{t('recurring.seeAll')}</Link>
        </div>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {upcoming.map((item) => {
            const cat = categories.find((c) => c.id === item.categoryId);
            const days = differenceInDays(parseISO(item.nextDueDate), new Date());
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                {cat ? (
                  <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                ) : (
                  <span className="text-xl shrink-0">{TYPE_ICONS[item.type] ?? '🔄'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(item.nextDueDate), 'd MMMM', { locale: ru })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-sm font-bold tabular-nums">
                    {item.amount > 0 ? '-' : ''}{formatAmount(item.amount, item.currency)}
                  </span>
                  <DayPill days={days} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 mx-4 mb-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1 mb-1">
        {t('recurring.upcomingBills')}
      </p>
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 divide-y divide-border overflow-hidden">
        {upcoming.map((item) => {
          const cat = categories.find((c) => c.id === item.categoryId);
          const days = differenceInDays(parseISO(item.nextDueDate), new Date());
          return (
            <Link key={item.id} href="/recurring" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              {cat ? (
                <CategoryIcon icon={cat.icon} color={cat.color} size="md" />
              ) : (
                <span className="text-2xl shrink-0">{TYPE_ICONS[item.type] ?? '🔄'}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(parseISO(item.nextDueDate), 'd MMMM', { locale: ru })}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-sm font-semibold tabular-nums">
                  -{formatAmount(item.amount, item.currency)}
                </span>
                <DayPill days={days} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
