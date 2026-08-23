/**
 * The drawer's default category is DERIVED, not synced by an effect.
 *
 * The old shape («if the field is empty and categories arrived, set it») left
 * the form with an empty categoryId for the render right after the categories
 * landed — a save in that window went out without a category. Deriving it
 * during render closes that window, and an explicit pick still wins.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { setCategories } from '@/features/categories/store/categoriesSlice';
import { openQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import type { UserProfile, Category } from '@/shared/types';

const addIncome = vi.fn();

vi.mock('@/features/income/services/incomeService', () => ({
  addIncome: (...a: unknown[]) => addIncome(...a),
}));
vi.mock('@/features/chat/services/savedCardService', () => ({
  recordSavedCard: vi.fn(),
  buildEntryDateHint: () => undefined,
}));
vi.mock('@/shared/hooks/useT', () => {
  const t = ((k: string) => k) as ((k: string) => string) & { cat: (n: string) => string };
  t.cat = (n: string) => n;
  return { useT: () => t };
});
vi.mock('@/shared/hooks/useDateFnsLocale', () => ({ useDateFnsLocale: () => ({}) }));

import { IncomeDrawerForm } from '@/features/quickadd/components/IncomeDrawerForm';

const user: UserProfile = {
  id: 'u1', name: 'A', email: 'a@x.com', currency: 'ILS', language: 'en',
  theme: 'mist', accountType: 'personal', createdAt: undefined as never,
};
const cat = (id: string, name: string, order: number): Category => ({
  id, userId: 'u1', name, icon: 'cash', color: '#10b981',
  type: 'income', order, isPrivate: false,
});

beforeEach(() => {
  addIncome.mockReset();
  addIncome.mockResolvedValue({ id: 'inc1', categoryId: 'inc-salary', amount: 5000 });
  store.dispatch(setUser(user));
  store.dispatch(setCategories({ type: 'income', categories: [] }));
  store.dispatch(openQuickAdd({ tab: 'income' }));
});

describe('IncomeDrawerForm default category', () => {
  it('saves against the first category even when categories load after mount', async () => {
    render(<Provider store={store}><IncomeDrawerForm accent="#10b981" /></Provider>);

    // Mounted with an empty category list, as happens on a cold start
    store.dispatch(setCategories({ type: 'income', categories: [cat('inc-salary', 'Salary', 0)] }));
    await waitFor(() => expect(screen.getAllByText('Salary').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5000' } });
    fireEvent.click(screen.getByText(/income\.numpadSave/));

    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    expect(addIncome.mock.calls[0][0].categoryId).toBe('inc-salary');
  });

  it('keeps an explicit pick when the category list changes underneath', async () => {
    store.dispatch(setCategories({
      type: 'income',
      categories: [cat('inc-salary', 'Salary', 0), cat('inc-gift', 'Gift', 1)],
    }));
    render(<Provider store={store}><IncomeDrawerForm accent="#10b981" /></Provider>);

    fireEvent.click(screen.getAllByText('Gift')[0]);
    // A later load must not reset the user's choice back to the first entry
    store.dispatch(setCategories({
      type: 'income',
      categories: [cat('inc-salary', 'Salary', 0), cat('inc-gift', 'Gift', 1), cat('inc-bonus', 'Bonus', 2)],
    }));

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '300' } });
    fireEvent.click(screen.getByText(/income\.numpadSave/));

    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    expect(addIncome.mock.calls[0][0].categoryId).toBe('inc-gift');
  });
});
