'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
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
import { useT } from '@/shared/hooks/useT';

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
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM d');
}

export default function ExpensesPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: expenses, status: expStatus } = useAppSelector((s) => s.expenses);
  const { list: incomes, status: incStatus } = useAppSelector((s) => s.income);
  const categories = useAppSelector((s) => s.categories.expense);
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'income' ? 'income' : 'expenses');
  const [showIncomeForm, setShowIncomeForm] = useState(searchParams.get('tab') === 'income');
  const [editingIncome, setEditingIncome] = useState<SerializableIncome | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCatId, setFilterCatId] = useState('');
  const t = useT();

  const currentMonth = format(new Date(), 'yyyy-MM');

  const loadExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      dispatch(setExpenses(await fetchMonthExpenses(user.id, currentMonth)));
    } finally { setLoading(false); }
  }, [user, currentMonth, dispatch]);

  const loadIncome = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      dispatch(setIncome(await fetchMonthIncome(user.id, currentMonth)));
    } finally { setLoading(false); }
  }, [user, currentMonth, dispatch]);

  useEffect(() => { if (expStatus === 'idle') loadExpenses(); }, [expStatus, loadExpenses]);
  useEffect(() => { if (tab === 'income' && incStatus === 'idle') loadIncome(); }, [tab, incStatus, loadIncome]);

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
    if (!confirm('Delete this income entry?')) return;
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

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">
      {/* ── List column (left on desktop, full on mobile when form not open) ── */}
      <div className={cn('lg:col-span-2 flex flex-col', formOpen && 'hidden lg:flex')}>
        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between lg:px-0 lg:pt-0">
          <div>
            <h1 className="text-xl font-bold">{tab === 'expenses' ? t('expenses.title') : t('expenses.income')}</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('expenses.total')}</p>
            <p className={`text-lg font-bold ${tab === 'expenses' ? 'text-destructive' : 'text-emerald-500'}`}>
              {tab === 'expenses' ? (monthTotal > 0 ? '-' : '') : (monthTotal > 0 ? '+' : '')}{formatAmount(monthTotal, currency)}
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-muted p-1 mx-4 mb-3 gap-1 lg:mx-0">
          <button
            onClick={() => setTab('expenses')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === 'expenses' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            {t('expenses.title')}
          </button>
          <button
            onClick={() => { setTab('income'); if (incStatus === 'idle') loadIncome(); }}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('expenses.search')}
              className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground"
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
                      <span>{c.icon}</span><span>{t.cat(c.name)}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (tab === 'expenses' ? expenses : incomes).length === 0 && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}

        {/* Expenses empty states */}
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

        {/* Upcoming recurring (expenses tab, mobile only — desktop shows in right col) */}
        {tab === 'expenses' && <div className="lg:hidden"><UpcomingBills withinDays={30} /></div>}

        {/* Expense groups */}
        {tab === 'expenses' && (
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
            <button onClick={() => setShowIncomeForm(true)} className="mt-3 text-sm font-medium text-primary hover:underline">
              {t('income.addIncome')}
            </button>
          </div>
        )}

        {/* Income groups */}
        {tab === 'income' && (
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
            {incomes.length > 0 && (
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
        {/* Mobile: form replaces page */}
        {formOpen && (
          <div className="lg:hidden flex flex-col">
            <div className="px-4 pt-5 pb-3 flex items-center gap-3">
              <button onClick={closeForm} className="text-muted-foreground text-sm">{t('common.back')}</button>
              <h1 className="text-xl font-bold">{editingIncome ? t('income.editTitle') : t('income.title')}</h1>
            </div>
            {formPanel}
          </div>
        )}

        {/* Desktop: form panel or upcoming bills */}
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
              <UpcomingBills withinDays={30} maxItems={5} />
              {tab === 'income' && (
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
