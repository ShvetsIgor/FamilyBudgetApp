'use client';
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { fetchExpenseById } from '@/features/expenses/services/expensesService';
import { mergeExpenses } from '@/features/expenses/store/expensesSlice';

export function useExpenseById(id: string) {
  const userId = useAppSelector(s => s.auth.user?.id);
  const expense = useAppSelector(s => s.expenses.list.find(e => e.id === id && e.userId === userId));
  const dispatch = useAppDispatch();
  const key = `${userId}|${id}`;
  const [result, setResult] = useState<{ key: string; error: boolean } | null>(null);
  useEffect(() => {
    if (!userId || expense) return;
    let active = true;
    fetchExpenseById(userId, id).then(value => {
      if (!active) return;
      dispatch(mergeExpenses([value]));
      setResult({ key, error: false });
    }).catch(error => {
      if (active) setResult({ key, error: error instanceof Error && error.message !== 'expense-not-found' });
    });
    return () => { active = false; };
  }, [userId, id, key, expense, dispatch]);
  return { expense, loading: !expense && result?.key !== key, error: result?.key === key && result.error };
}
