'use client';

import Link from 'next/link';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useAppSelector } from '@/store/store';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount } from '@/shared/utils/currency';

const TYPE_ICONS: Record<string, string> = {
  subscription: '📺', rent: '🏠', utility: '💡',
  credit: '💳', mortgage: '🏦', custom: '🔄',
};

interface Props {
  withinDays?: number; // show items due within N days (default 30)
  maxItems?: number;
  compact?: boolean;   // compact mode for home page
}

export function UpcomingBills({ withinDays = 30, maxItems, compact = false }: Props) {
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);
  const { list } = useAppSelector((s) => s.recurring);

  const upcoming = list
    .filter((r) => {
      if (!r.isActive) return false;
      const days = differenceInDays(parseISO(r.nextDueDate), new Date());
      return days >= 0 && days <= withinDays;
    })
    .sort((a, b) => parseISO(a.nextDueDate).getTime() - parseISO(b.nextDueDate).getTime())
    .slice(0, maxItems);

  if (upcoming.length === 0) return null;

  if (compact) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Upcoming bills</h2>
          <Link href="/recurring" className="text-xs text-primary hover:underline">See all</Link>
        </div>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {upcoming.map((item) => {
            const cat = categories.find((c) => c.id === item.categoryId);
            const days = differenceInDays(parseISO(item.nextDueDate), new Date());
            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3 opacity-70">
                {cat ? (
                  <CategoryIcon icon={cat.icon} color={cat.color} size="sm" />
                ) : (
                  <span className="text-xl shrink-0">{TYPE_ICONS[item.type] ?? '🔄'}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {days === 0 ? 'Today' : `In ${days}d · ${format(parseISO(item.nextDueDate), 'MMM d')}`}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                  {item.amount > 0 ? '-' : ''}{formatAmount(item.amount, item.currency)}
                </span>
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
        Upcoming
      </p>
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 divide-y divide-border overflow-hidden">
        {upcoming.map((item) => {
          const cat = categories.find((c) => c.id === item.categoryId);
          const days = differenceInDays(parseISO(item.nextDueDate), new Date());
          return (
            <Link key={item.id} href="/recurring" className="flex items-center gap-3 px-4 py-3 opacity-60 hover:opacity-80 transition-opacity">
              {cat ? (
                <CategoryIcon icon={cat.icon} color={cat.color} size="md" />
              ) : (
                <span className="text-2xl shrink-0">{TYPE_ICONS[item.type] ?? '🔄'}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {days === 0 ? (
                    <span className="text-amber-500 font-medium">Due today</span>
                  ) : days <= 3 ? (
                    <span className="text-amber-500 font-medium">In {days} days</span>
                  ) : (
                    <span>{format(parseISO(item.nextDueDate), 'MMM d')}</span>
                  )}
                  {' · '}{item.frequency}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                -{formatAmount(item.amount, item.currency)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
