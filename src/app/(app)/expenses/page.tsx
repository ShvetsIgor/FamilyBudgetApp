'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setIncome, prependIncome, removeIncome } from '@/features/income/store/incomeSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { fetchMonthIncome, addIncome, deleteIncome } from '@/features/income/services/incomeService';
import { ExpenseCard } from '@/features/expenses/components/ExpenseCard';
import { IncomeCard } from '@/features/income/components/IncomeCard';
import { IncomeForm } from '@/features/income/components/IncomeForm';
import { formatAmount } from '@/shared/utils/currency';
import type { SerializableExpense, SerializableIncome } from '@/shared/types';
import type { AddIncomeInput } from '@/features/income/services/incomeService';

type Tab = 'expenses' | 'income';

function groupByDate<T extends { date: string }>(items: T[]): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const day = item.date.slice(0, 10);
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

  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get('tab') === 'income' ? 'income' : 'expenses');
  const [showIncomeForm, setShowIncomeForm] = useState(searchParams.get('tab') === 'income');
  const [loading, setLoading] = useState(false);

  const currentMonth = format(new Date(), 'yyyy-MM');

  const loadExpenses = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchMonthExpenses(user.id, currentMonth);
      dispatch(setExpenses(data));
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, dispatch]);

  const loadIncome = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchMonthIncome(user.id, currentMonth);
      dispatch(setIncome(data));
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, dispatch]);

  useEffect(() => {
    if (expStatus === 'idle') loadExpenses();
  }, [expStatus, loadExpenses]);

  useEffect(() => {
    if (tab === 'income' && incStatus === 'idle') loadIncome();
  }, [tab, incStatus, loadIncome]);

  async function handleAddIncome(data: Omit<AddIncomeInput, 'userId'>) {
    if (!user) return;
    const saved = await addIncome({ ...data, userId: user.id });
    dispatch(prependIncome(saved));
    setShowIncomeForm(false);
  }

  async function handleDeleteIncome(income: SerializableIncome) {
    if (!user) return;
    if (!confirm('Delete this income entry?')) return;
    await deleteIncome(user.id, income);
    dispatch(removeIncome(income.id));
  }

  const monthTotal = tab === 'expenses'
    ? expenses.reduce((s, e) => s + e.amount, 0)
    : incomes.reduce((s, i) => s + i.amount, 0);

  const expenseGroups = groupByDate(expenses);
  const incomeGroups = groupByDate(incomes);

  if (showIncomeForm) {
    return (
      <div className="flex flex-col">
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <button onClick={() => setShowIncomeForm(false)} className="text-muted-foreground text-sm">
            ← Back
          </button>
          <h1 className="text-xl font-bold">Add Income</h1>
        </div>
        <IncomeForm onSave={handleAddIncome} onCancel={() => setShowIncomeForm(false)} />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{tab === 'expenses' ? 'Expenses' : 'Income'}</h1>
          <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM yyyy')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className={`text-lg font-bold ${tab === 'expenses' ? 'text-destructive' : 'text-emerald-500'}`}>
            {tab === 'expenses' ? '-' : '+'}{formatAmount(monthTotal, currency)}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl bg-muted p-1 mx-4 mb-3 gap-1">
        <button
          onClick={() => setTab('expenses')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === 'expenses' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          Expenses
        </button>
        <button
          onClick={() => setTab('income')}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            tab === 'income' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
          }`}
        >
          Income
        </button>
      </div>

      {/* Loading */}
      {loading && (tab === 'expenses' ? expenses : incomes).length === 0 && (
        <div className="flex justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      )}

      {/* Expenses tab */}
      {tab === 'expenses' && !loading && expenses.length === 0 && (
        <div className="flex flex-col items-center py-16 px-8 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-medium">No expenses this month</p>
          <p className="text-sm text-muted-foreground mt-1">Tap + to add your first expense</p>
        </div>
      )}

      {tab === 'expenses' && (
        <div className="flex flex-col gap-2 pb-4">
          {expenseGroups.map(([day, items]) => {
            const dayTotal = (items as SerializableExpense[]).reduce((s, e) => s + e.amount, 0);
            return (
              <div key={day} className="rounded-2xl bg-card border border-border overflow-hidden mx-4">
                <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {dateLabel(day)}
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    -{formatAmount(dayTotal, currency)}
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

      {/* Income tab */}
      {tab === 'income' && !loading && incomes.length === 0 && (
        <div className="flex flex-col items-center py-12 px-8 text-center">
          <p className="text-4xl mb-3">💰</p>
          <p className="font-medium">No income this month</p>
          <button
            onClick={() => setShowIncomeForm(true)}
            className="mt-3 text-sm font-medium text-primary hover:underline"
          >
            Add income →
          </button>
        </div>
      )}

      {tab === 'income' && (
        <>
          <div className="flex flex-col gap-2 pb-4">
            {incomeGroups.map(([day, items]) => {
              const dayTotal = (items as SerializableIncome[]).reduce((s, i) => s + i.amount, 0);
              return (
                <div key={day} className="rounded-2xl bg-card border border-border overflow-hidden mx-4">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {dateLabel(day)}
                    </span>
                    <span className="text-xs font-semibold text-emerald-500 tabular-nums">
                      +{formatAmount(dayTotal, currency)}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {(items as SerializableIncome[]).map((i) => (
                      <IncomeCard key={i.id} income={i} onDelete={() => handleDeleteIncome(i)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {incomes.length > 0 && (
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowIncomeForm(true)}
                className="w-full rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                + Add income
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
