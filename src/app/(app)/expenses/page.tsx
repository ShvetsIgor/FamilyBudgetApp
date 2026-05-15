'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isToday, isYesterday, subMonths, startOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setIncome, prependIncome, removeIncome, updateIncome as updateIncomeAction } from '@/features/income/store/incomeSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { fetchMonthIncome, addIncome, updateIncome, deleteIncome } from '@/features/income/services/incomeService';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { IncomeCard } from '@/features/income/components/IncomeCard';
import { UpcomingBills } from '@/features/recurring/components/UpcomingBills';
import { IncomeForm } from '@/features/income/components/IncomeForm';
import { formatAmount } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import type { SerializableExpense, SerializableIncome } from '@/shared/types';
import type { AddIncomeInput } from '@/features/income/services/incomeService';
import { setExpensesSearch } from '@/features/ui/store/uiSlice';
import { useT } from '@/shared/hooks/useT';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';

type Tab = 'expenses' | 'income';

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
  const { list: reduxIncomes, status: incStatus } = useAppSelector((s) => s.income);
  const categories = useAppSelector((s) => s.categories.expense);
  const searchParams = useSearchParams();

  const currentMonth = format(new Date(), 'yyyy-MM');
  const yearMonths = getYearMonths();

  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'income' ? 'income' : 'expenses');
  const [showIncomeForm, setShowIncomeForm] = useState(searchParams.get('tab') === 'income');
  const [editingIncome, setEditingIncome] = useState<SerializableIncome | null>(null);
  const [loading, setLoading] = useState(false);
  const search = useAppSelector((s) => s.ui.expensesSearch);
  const [filterCatId, setFilterCatId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  // Local data for non-current months; current month synced with Redux
  const [localExpenses, setLocalExpenses] = useState<SerializableExpense[] | null>(null);
  const [localIncomes, setLocalIncomes] = useState<SerializableIncome[] | null>(null);
  const monthBarRef = useRef<HTMLDivElement>(null);
  const t = useT();

  const isCurrentMonth = selectedMonth === currentMonth;
  const expenses = isCurrentMonth ? reduxExpenses : (localExpenses ?? []);
  const incomes = isCurrentMonth ? reduxIncomes : (localIncomes ?? []);

  // Load current month into Redux (once)
  const loadCurrentExpenses = useCallback(async () => {
    if (!user || expStatus !== 'idle') return;
    dispatch(setExpenses(await fetchMonthExpenses(user.id, currentMonth)));
  }, [user, currentMonth, expStatus, dispatch]);

  const loadCurrentIncomes = useCallback(async () => {
    if (!user || incStatus !== 'idle') return;
    dispatch(setIncome(await fetchMonthIncome(user.id, currentMonth)));
  }, [user, currentMonth, incStatus, dispatch]);

  useEffect(() => { loadCurrentExpenses(); }, [loadCurrentExpenses]);
  useEffect(() => { if (tab === 'income') loadCurrentIncomes(); }, [tab, loadCurrentIncomes]);

  // Load historical month into local state
  useEffect(() => {
    if (isCurrentMonth) { setLocalExpenses(null); setLocalIncomes(null); return; }
    setLocalExpenses(null);
    setLocalIncomes(null);
    if (!user) return;
    setLoading(true);
    Promise.all([
      fetchMonthExpenses(user.id, selectedMonth),
      fetchMonthIncome(user.id, selectedMonth),
    ]).then(([exp, inc]) => {
      setLocalExpenses(exp);
      setLocalIncomes(inc);
    }).finally(() => setLoading(false));
  }, [selectedMonth, isCurrentMonth, user]);

  // Scroll month bar to selected chip
  useEffect(() => {
    const bar = monthBarRef.current;
    if (!bar) return;
    const chip = bar.querySelector(`[data-month="${selectedMonth}"]`) as HTMLElement | null;
    if (chip) chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedMonth]);

  async function handleAddIncome(data: Omit<AddIncomeInput, 'userId'>) {
    if (!user) return;
    dispatch(prependIncome(await addIncome({ ...data, userId: user.id })));
    setShowIncomeForm(false);
  }

  async function handleEditIncome(data: Omit<AddIncomeInput, 'userId'>) {
    if (!user || !editingIncome) return;
    dispatch(updateIncomeAction(await updateIncome({ ...data, userId: user.id, id: editingIncome.id })));
    setEditingIncome(null);
  }

  async function handleDeleteIncome(income: SerializableIncome) {
    if (!user) return;
    if (!confirm('Удалить эту запись?')) return;
    await deleteIncome(user.id, income);
    dispatch(removeIncome(income.id));
  }

  function closeForm() { setShowIncomeForm(false); setEditingIncome(null); }

  const formOpen = showIncomeForm || !!editingIncome;

  const filteredExpenses = expenses.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch = !q || [e.store, e.comment, categories.find((c) => c.id === e.categoryId)?.name]
      .some((v) => v?.toLowerCase().includes(q));
    const matchesCat = !filterCatId || e.categoryId === filterCatId;
    return matchesSearch && matchesCat;
  });

  const monthTotal = tab === 'expenses'
    ? expenses.reduce((s, e) => s + e.amount, 0)
    : incomes.reduce((s, i) => s + i.amount, 0);

  const expenseGroups = groupByDate(filteredExpenses);
  const incomeGroups = groupByDate(incomes);

  const formPanel = (
    <IncomeForm
      initialIncome={editingIncome ?? undefined}
      onSave={editingIncome ? handleEditIncome : handleAddIncome}
      onCancel={closeForm}
    />
  );

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
      <div className={cn('lg:col-span-2 flex flex-col', formOpen && 'hidden lg:flex')}>
        {/* Header */}
        <div className="px-4 pt-5 pb-2 flex items-center justify-between lg:px-0 lg:pt-0">
          <div>
            <h1 className="text-xl font-bold">{tab === 'expenses' ? t('expenses.title') : t('expenses.income')}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(parseISO(selectedMonth + '-01'), 'LLLL yyyy', { locale: ru })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('expenses.total')}</p>
            <p className={`text-lg font-bold ${tab === 'expenses' ? 'text-destructive' : 'text-emerald-500'}`}>
              {tab === 'expenses' ? (monthTotal > 0 ? '-' : '') : (monthTotal > 0 ? '+' : '')}{formatAmount(monthTotal, currency)}
            </p>
          </div>
        </div>

        {/* Month bar */}
        {monthBar}

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-muted p-1 mx-4 mb-3 gap-1 lg:mx-0">
          <button
            onClick={() => setTab('expenses')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === 'expenses' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            {t('expenses.title')}
          </button>
          <button
            onClick={() => { setTab('income'); if (incStatus === 'idle') loadCurrentIncomes(); }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === 'income' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            {t('expenses.income')}
          </button>
        </div>

        {/* Search + filter (expenses tab only) */}
        {tab === 'expenses' && (
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
                  .filter((c) => !c.parentId && expenses.some((e) => e.categoryId === c.id))
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
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}

        {/* Expenses empty state */}
        {tab === 'expenses' && !loading && expenses.length === 0 && (
          <div className="flex flex-col items-center py-16 px-8 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="font-medium">{t('expenses.noExpenses')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('expenses.tapToAdd')}</p>
          </div>
        )}
        {tab === 'expenses' && !loading && expenses.length > 0 && filteredExpenses.length === 0 && (
          <div className="flex flex-col items-center py-12 px-8 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-medium">{t('expenses.noResults')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('expenses.tryOther')}</p>
          </div>
        )}

        {/* Upcoming recurring (expenses tab, current month, mobile only) */}
        {tab === 'expenses' && isCurrentMonth && <div className="lg:hidden"><UpcomingBills withinDays={30} /></div>}

        {/* Expense groups */}
        {tab === 'expenses' && !loading && (
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
                      <ExpenseCard key={e.id} expense={e} onClick={() => router.push(`/expenses/${e.id}`)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Income empty state */}
        {tab === 'income' && !loading && incomes.length === 0 && (
          <div className="flex flex-col items-center py-12 px-8 text-center">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-medium">{t('income.noIncome')}</p>
            {isCurrentMonth && (
              <button onClick={() => setShowIncomeForm(true)} className="mt-3 text-sm font-medium text-primary hover:underline">
                {t('income.addIncome')}
              </button>
            )}
          </div>
        )}

        {/* Income groups */}
        {tab === 'income' && !loading && (
          <>
            <div className="flex flex-col gap-2 pb-4">
              {incomeGroups.map(([day, items]) => {
                const dayTotal = (items as SerializableIncome[]).reduce((s, i) => s + i.amount, 0);
                return (
                  <div key={day} className="rounded-2xl bg-card border border-border overflow-hidden mx-4 lg:mx-0">
                    <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{dateLabel(day)}</span>
                      <span className="text-xs font-semibold text-emerald-500 tabular-nums">
                        {dayTotal > 0 ? '+' : ''}{formatAmount(dayTotal, currency)}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {(items as SerializableIncome[]).map((i) => (
                        <IncomeCard key={i.id} income={i} onEdit={() => setEditingIncome(i)} onDelete={() => handleDeleteIncome(i)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {isCurrentMonth && incomes.length > 0 && (
              <div className="px-4 pb-4 lg:px-0">
                <button
                  onClick={() => setShowIncomeForm(true)}
                  className="w-full rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {t('income.addMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Right column ── */}
      <div>
        {formOpen && (
          <div className="lg:hidden flex flex-col">
            <div className="px-4 pt-5 pb-3 flex items-center gap-3">
              <button onClick={closeForm} className="text-muted-foreground text-sm">{t('common.back')}</button>
              <h1 className="text-xl font-bold">{editingIncome ? t('income.editTitle') : t('income.title')}</h1>
            </div>
            {formPanel}
          </div>
        )}
        <div className="hidden lg:block sticky top-6">
          {formOpen ? (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-sm">{editingIncome ? t('income.editTitle') : t('income.title')}</h2>
                <button onClick={closeForm} className="text-muted-foreground text-xs hover:text-foreground">✕</button>
              </div>
              {formPanel}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {isCurrentMonth && <UpcomingBills withinDays={30} maxItems={5} />}
              {tab === 'income' && isCurrentMonth && (
                <button
                  onClick={() => setShowIncomeForm(true)}
                  className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  + {t('income.addIncome')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
