'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { mergeExpenses, removeExpense, prependExpense } from '@/features/expenses/store/expensesSlice';
import { fetchMonthExpenses, deleteExpense, restoreExpense } from '@/features/expenses/services/expensesService';
import { updateRecurringItem } from '@/features/recurring/store/recurringSlice';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { UpcomingBills } from '@/features/recurring/components/UpcomingBills';
import { formatAmount } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import type { SerializableExpense } from '@/shared/types';
import { setExpensesSearch } from '@/features/ui/store/uiSlice';
import { useT } from '@/shared/hooks/useT';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import {
  getExpenseListMeta,
  matchesExpenseListFilter,
} from '@/features/expenses/utils/expensePresentation';

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
  const folders = useAppSelector((s) => s.categories.folders.expense);
  const language = useAppSelector((s) => s.ui.language);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const yearMonths = getYearMonths();

  const [loading, setLoading] = useState(false);
  const search = useAppSelector((s) => s.ui.expensesSearch);
  const [filterCatId, setFilterCatId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [localExpenses, setLocalExpenses] = useState<SerializableExpense[] | null>(null);
  const monthBarRef = useRef<HTMLDivElement>(null);
  const t = useT();

  // Undo-delete state. The delete is committed to Firestore *immediately* so
  // closing the tab can't strand a half-deleted item; the toast just offers a
  // 5-second window to restore via setDoc on the original id.
  const [undoItem, setUndoItem] = useState<{ expense: SerializableExpense; timerId: ReturnType<typeof setTimeout> } | null>(null);
  const undoRef = useRef<typeof undoItem>(null);
  undoRef.current = undoItem;

  useEffect(() => {
    return () => {
      const u = undoRef.current;
      if (u) clearTimeout(u.timerId);
    };
  }, []);

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
    const listMeta = getExpenseListMeta(e, categories, folders, language);
    const q = search.toLowerCase();
    const matchesSearch = !q || [e.store, e.comment, categories.find((c) => c.id === e.categoryId)?.name, listMeta?.labelSource]
      .some((v) => v?.toLowerCase().includes(q));
    const matchesCat = !filterCatId || matchesExpenseListFilter(e, filterCatId);
    return matchesSearch && matchesCat;
  });

  const filterOptions = expenses.reduce<Array<{ key: string; icon: string; color: string; label: string }>>(
    (acc, expense) => {
      const localizedMeta = getExpenseListMeta(expense, categories, folders, language);
      if (!localizedMeta) return acc;
      if (acc.some((option) => option.key === localizedMeta.key)) return acc;
      acc.push({
        key: localizedMeta.key,
        icon: localizedMeta.icon,
        color: localizedMeta.color,
        label: t.cat(localizedMeta.labelSource),
      });
      return acc;
    },
    [],
  );

  const monthTotal = expenses.reduce((s, e) => s + e.amount, 0);
  const expenseGroups = groupByDate(filteredExpenses).sort(([a], [b]) => b.localeCompare(a));

  const monthBar = (
    <div
      ref={monthBarRef}
      className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] lg:px-0"
      style={{ background: 'hsl(var(--card))' }}
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

  const budgetMode = useAppSelector((s) => s.ui.budgetMode);
  const budgetMonthlyLimit = useAppSelector((s) => s.ui.budgetMonthlyLimit);
  // Only show budget bar in monthly mode — auto/daily don't have a meaningful monthly limit here
  const monthBudget = budgetMode === 'monthly' ? budgetMonthlyLimit : 0;
  const budgetPct = monthBudget > 0 ? Math.min(100, Math.round((monthTotal / monthBudget) * 100)) : 0;

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      {/* ── List column ── */}
      <div className="lg:col-span-2 flex flex-col">
        {/* Header — architectural: large number + budget bar */}
        <div className="px-4 pt-6 pb-4 lg:px-0 lg:pt-0" style={{ borderBottom: '2px solid hsl(var(--foreground))', background: 'hsl(var(--card))' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
            {format(parseISO(selectedMonth + '-01'), 'LLLL yyyy', { locale: ru })}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1 }}>
              {monthTotal > 0 ? '-' : ''}{formatAmount(monthTotal, currency)}
            </div>
            {monthBudget > 0 && (
              <button onClick={() => router.push('/budget')} style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))' }}>
                  {t('expenses.budget')}
                </p>
                <p style={{ fontSize: 16, fontWeight: 800 }}>
                  {formatAmount(monthBudget, currency)}
                </p>
              </button>
            )}
          </div>
          {monthBudget > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ height: 3, background: 'hsl(var(--muted))' }}>
                <div style={{
                  height: '100%',
                  width: `${budgetPct}%`,
                  background: budgetPct > 85 ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))',
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <p style={{ marginTop: 4, fontSize: 10, color: 'hsl(var(--muted-foreground))' }}>
                {budgetPct}% · {t('expenses.budgetLeft')} {formatAmount(Math.max(0, monthBudget - monthTotal), currency)}
              </p>
            </div>
          )}
        </div>

        {/* Month bar */}
        {monthBar}

        {/* Search + filter */}
        <div className="px-4 mt-3 mb-2 flex flex-col gap-2 lg:px-0">
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
              {filterOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => setFilterCatId(filterCatId === option.key ? '' : option.key)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterCatId === option.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                  >
                    <StickerIcon icon={option.icon} color={option.color} className="h-3.5 w-3.5" />
                    <span>{option.label}</span>
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
          <div className="flex flex-col pb-4">
            {expenseGroups.map(([day, items]) => {
              const dayTotal = (items as SerializableExpense[]).reduce((s, e) => s + e.amount, 0);
              return (
                <div key={day} className="border-b border-border/30">
                  {/* Day header */}
                  <div className="flex items-center justify-between px-4 py-2 lg:px-0" style={{ background: 'hsl(var(--muted)/0.4)' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, color: 'hsl(var(--muted-foreground))' }}>
                      {dateLabel(day)}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'hsl(var(--muted-foreground))' }}>
                      {dayTotal > 0 ? '-' : ''}{formatAmount(dayTotal, currency)}
                    </span>
                  </div>
                  {/* Rows */}
                  <div className="divide-y divide-border/20">
                    {(items as SerializableExpense[]).map((e) => (
                      <ExpenseCard
                        key={e.id}
                        expense={e}
                        onClick={() => router.push(`/expenses/${e.id}`)}
                        onEdit={() => router.push(`/expenses/${e.id}/edit`)}
                        onDelete={() => {
                          if (!user) return;
                          // Dismiss any existing undo toast — its delete already
                          // hit Firestore the moment it was triggered.
                          if (undoItem) {
                            clearTimeout(undoItem.timerId);
                            setUndoItem(null);
                          }
                          // Commit the delete to Firestore now. If the tab is
                          // closed before Undo fires, the row stays gone.
                          dispatch(removeExpense(e.id));
                          deleteExpense(user.id, e)
                            .then((restored) => {
                              if (restored) dispatch(updateRecurringItem(restored));
                            })
                            .catch(() => {
                              // Network failure: surface the expense again so
                              // the list doesn't lie about the deletion.
                              dispatch(prependExpense(e));
                            });
                          const timerId = setTimeout(() => setUndoItem(null), 5000);
                          setUndoItem({ expense: e, timerId });
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

      {/* ── Undo delete toast ── */}
      {undoItem && (
        <div className="fixed bottom-28 left-4 right-4 z-40 flex items-center gap-3 rounded-2xl bg-foreground px-4 py-3 shadow-xl lg:left-auto lg:right-6 lg:max-w-sm">
          <span className="flex-1 text-sm font-semibold text-background truncate">
            Удалено: {undoItem.expense.store || undoItem.expense.comment || 'Расход'}
          </span>
          <button
            onClick={() => {
              if (!user) { setUndoItem(null); return; }
              clearTimeout(undoItem.timerId);
              const expense = undoItem.expense;
              setUndoItem(null);
              dispatch(prependExpense(expense));
              restoreExpense(user.id, expense).catch(() => {
                // Restore failed — revert the optimistic list change so the
                // user sees the actual server state.
                dispatch(removeExpense(expense.id));
              });
            }}
            className="shrink-0 rounded-xl bg-background/20 px-3 py-1.5 text-sm font-bold text-background hover:bg-background/30 transition-colors"
          >
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}
