/**
 * Opening /expenses/{id} directly fetches that one expense. It must not mark
 * the expense list as loaded: /expenses fetches the month only while the list
 * is 'idle', and would otherwise present this single expense as the month.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { beforeEach, expect, it, vi } from 'vitest';
import type { SerializableExpense, UserProfile } from '@/shared/types';

const fetchExpenseById = vi.hoisted(() => vi.fn());
vi.mock('@/features/expenses/services/expensesService', () => ({ fetchExpenseById }));

import { store } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { useExpenseById } from '@/features/expenses/hooks/useExpenseById';

const user = { id: 'bob', name: 'Bob', email: 'b@x.com', currency: 'ILS', language: 'en' } as UserProfile;
const expense = {
  id: 'e1', userId: 'bob', amount: 50, currency: 'ILS', categoryId: 'food', date: '2026-09-10T09:00:00.000Z',
  paymentMethod: 'card', tags: [], privacy: 'regular', splits: [], isRecurring: false,
  createdAt: '2026-09-10T09:00:00.000Z', updatedAt: '2026-09-10T09:00:00.000Z',
} as SerializableExpense;

beforeEach(() => {
  store.dispatch(setUser(null));
  store.dispatch(setUser(user));
  fetchExpenseById.mockReset();
});

it('caches a deep-linked expense without marking the month as loaded', async () => {
  fetchExpenseById.mockResolvedValue(expense);
  const { result } = renderHook(() => useExpenseById('e1'), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });

  await waitFor(() => expect(result.current.expense?.id).toBe('e1'));
  expect(fetchExpenseById).toHaveBeenCalledWith('bob', 'e1');
  expect(store.getState().expenses.status).toBe('idle');
  expect(store.getState().expenses.list.map(e => e.id)).toEqual(['e1']);
});

it('reports a missing expense as not found rather than as an error', async () => {
  fetchExpenseById.mockRejectedValue(new Error('expense-not-found'));
  const { result } = renderHook(() => useExpenseById('gone'), {
    wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
  });

  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.expense).toBeUndefined();
  expect(result.current.error).toBe(false);
});
