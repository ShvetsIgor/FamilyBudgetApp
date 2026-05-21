'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses, mergeExpenses, removeExpense } from '@/features/expenses/store/expensesSlice';
import { fetchMonthExpenses, deleteExpense } from '@/features/expenses/services/expensesService';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { UpcomingBills } from '@/features/recurring/components/UpcomingBills';
import { formatAmount } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import type { SerializableExpense } from '@/shared/types';
import { setExpensesSearch } from '@/features/ui/store/uiSlice';
import { useT } from '@/shared/hooks/useT';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { isActiveCategory } from '@/features/categories/policy/categoryPolicy';

function groupByDate<T extends { date: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const day = format(parseISO(item.date), 'yyyy-MM-dd');
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return Array.from(map.entries());
}

function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return 'Сегодня';
  if (isYesterday(d)) return 'Вчера';
  return format(d, 'EEEE, d MMMM', { locale: ru });
}

// Generate months from Jan of current year up to (and including) current month
function getYearMonths(): string[] {
  const now = new Date();
  const currentMonth = format(now, 'yyyy-MM');
  const months: string[] = [];
  for (let m = 0; m <= 11; m++) {
    const d = new Date(now.getFullYear(), m, 1);
    const key = format(d, 'yyyy-MM');
    months.push(key);
    if (key === currentMonth) break;
  }
  return months;
}

export default function ExpensesPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: reduxExpenses, status: expStatus } = useAppSelector((s) => s.expenses);
  const categories = useAppSelector((s) => s.categories.expense);
  const searchParams = useSearchParams();

  const currentMonth = format(new Date(), 'yyyy-MM');
  const yearMonths = getYearMonths();

  const [loading, setLoading] = useState(false);
  const search = useAppSelector((s) => s.ui.expensesSearch);
  const [filterCatId, setFilterCatId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [localExpenses, setLocalExpenses] = useState<SerializableExpense[] | null>(null);
  const monthBarRef = useRef<HTMLDivElement>(null);
  const t = useT();

  const isCurrentMonth = selectedMonth === currentMonth;
  const expenses = isCurrentMonth ? reduxExpenses : (localExpenses ?? []);

  const loadCurrentExpenses = useCallback(async () => {
    if (!user || expStatus !== 'idle') return;
    dispatch(mergeExpenses(await fetchMonthExpenses(user.id, currentMonth)));
  }, [user, currentMonth, expStatus, dispatch]);

  useEffect(() => { loadCurrentExpenses(); }, [loadCurrentExpenses]);

  useEffect(() => {
    if (isCurrentMonth) { setLocalExpenses(null); return; }
    setLocalExpenses(null);
    if (!user) return;
    setLoading(true);
    fetchMonthExpenses(user.id, selectedMonth)
      .then(setLocalExpenses)
      .finally(() => setLoading(false));
  }, [selectedMonth, isCurrentMonth, user]);

  // Scroll month bar to selected chip
  useEffect(() => {
    const bar = monthBarRef.current;
    if (!bar) return;
    const chip = bar.querySelector(`[data-month="${selectedMonth}"]`) as HTMLElement | null;
    if (chip) chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedMonth]);

  const filteredExpenses = expenses.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [e.store, e.comment, categories.find((c) => c.id === e.categoryId)?.name]
      .some((v) => v?.toLowerCase().includes(q));
    const matchesCat = !filterCatId || e.categoryId === filterCatId;
    return matchesSearch && matchesCat;
  });

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const expenseGroups = groupByDate(filteredExpenses).sort(([a], [b]) => b.localeCompare(a));

  const monthBar = (
    <div
      ref={monthBarRef}
      className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] lg:px-0"
    >
      {yearMonths.map((m) => {
        const sel = m === selectedMonth;
        const label = format(parseISO(m + '-01'), 'LLL', { locale: ru });
        return (
          <button
            key={m}
            data-month={m}
            onClick={() => { setSelectedMonth(m); dispatch(setExpensesSearch('')); setFilterCatId(''); }}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1 text-xs font-bold capitalize transition-colors',
              sel
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      {/* ── List column ── */}
      <div className="lg:col-span-2 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-5 pb-2 flex items-center justify-between lg:px-0 lg:pt-0">
          <div>
            <h1 className="text-xl font-bold">{t('expenses.title')}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(parseISO(selectedMonth + '-01'), 'LLLL yyyy', { locale: ru })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('expenses.total')}</p>
            <p className="text-lg font-bold text-destructive">
              {monthTotal > 0 ? '-' : ''}{formatAmount(monthTotal, currency)}
            </p>
          </div>
        </div>

        {/* Month bar */}
        {monthBar}

        {/* Search + filter */}
        <div className="px-4 mb-2 flex flex-col gap-2 lg:px-0">
          <input
            type="search"
            value={search}
            onChange={(e) => dispatch(setExpensesSearch(e.target.value))}
            placeholder={t('expenses.search')}
            className="lg:hidden w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
          />
          {expenses.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setFilterCatId('')}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${!filterCatId ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
              >
                {t('expenses.all')}
              </button>
              {categories
                .filter((c) => isActiveCategory(c) && expenses.some((e) => e.categoryId === c.id))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCatId(filterCatId === c.id ? '' : c.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterCatId === c.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    <StickerIcon icon={c.icon} color={c.color} className="h-3.5 w-3.5" /><span>{t.cat(c.name)}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}

        {/* Empty states */}
        {!loading && expenses.length === 0 && (
          <div className="flex flex-col items-center py-16 px-8 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium">{t('expenses.noExpenses')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('expenses.tapToAdd')}</p>
          </div>
        )}
        {!loading && expenses.length > 0 && filteredExpenses.length === 0 && (
          <div className="flex flex-col items-center py-12 px-8 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium">{t('expenses.noResults')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('expenses.tryOther')}</p>
          </div>
        )}

        {/* Upcoming recurring (mobile only) */}
        {isCurrentMonth && <div className="lg:hidden"><UpcomingBills withinDays={30} /></div>}

        {/* Expense groups */}
        {!loading && (
          <div className="flex flex-col gap-2 pb-4">
            {expenseGroups.map(([day, items]) => {
              const dayTotal = (items as SerializableExpense[]).reduce((s, e) => s + e.amount, 0);
              return (
                <div key={day} className="rounded-2xl bg-card border border-border overflow-hidden mx-4 lg:mx-0">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dateLabel(day)}</span>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      {dayTotal > 0 ? '-' : ''}{formatAmount(dayTotal, currency)}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {(items as SerializableExpense[]).map((e) => (
                      <ExpenseCard
                        key={e.id}
                        expense={e}
                        onClick={() => router.push(`/expenses/${e.id}`)}
                        onEdit={() => router.push(`/expenses/${e.id}/edit`)}
                        onDelete={async () => {
                          if (!user) return;
                          dispatch(removeExpense(e.id));
                          try { await deleteExpense(user.id, e); } catch { /* ignore */ }
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Right column (desktop) ── */}
      <div className="hidden lg:block sticky top-6">
        {isCurrentMonth && <UpcomingBills withinDays={30} maxItems={5} />}
      </div>

      {/* ── FAB — add expense ── */}
      <button
        onClick={() => router.push('/expenses/new')}
        className="lg:hidden fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
        style={{ background: 'hsl(var(--primary))' }}
      >
        <Plus size={24} color="white" />
      </button>
    </div>
  );
}
