/**
 * №10 regression: a failing secondary chat-card write must NOT undo the saved
 * financial record or block the form from closing. If the drawer stayed open
 * after a successful save, a retry would duplicate the income.
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
const recordSavedCard = vi.fn();

vi.mock('@/features/income/services/incomeService', () => ({
  addIncome: (...a: unknown[]) => addIncome(...a),
}));
vi.mock('@/features/chat/services/savedCardService', () => ({
  recordSavedCard: (...a: unknown[]) => recordSavedCard(...a),
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
const salary: Category = {
  id: 'inc-salary', userId: 'u1', name: 'Salary', icon: 'cash', color: '#10b981',
  type: 'income', order: 0, isPrivate: false,
};

function seed() {
  store.dispatch(setUser(user));
  store.dispatch(setCategories({ type: 'income', categories: [salary] }));
  store.dispatch(openQuickAdd({ tab: 'income' }));
}

beforeEach(() => {
  addIncome.mockReset();
  recordSavedCard.mockReset();
  seed();
});

describe('IncomeDrawerForm chat-card failure', () => {
  it('closes the drawer and saves once even when the chat card write fails', async () => {
    addIncome.mockResolvedValue({ id: 'inc1', categoryId: 'inc-salary', amount: 5000 });
    recordSavedCard.mockRejectedValue(new Error('chat write failed'));

    render(<Provider store={store}><IncomeDrawerForm accent="#10b981" /></Provider>);

    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5000' } });
    // Save button carries the localized key with the amount interpolated
    fireEvent.click(screen.getByText(/income\.numpadSave/));

    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    // The financial write succeeded and the drawer closed despite the throw
    await waitFor(() => expect(store.getState().quickAdd.open).toBe(false));
    // The income category id is real, never a folder id
    expect(addIncome.mock.calls[0][0].categoryId).toBe('inc-salary');
  });

  it('keeps the drawer open and allows retry when the financial write fails', async () => {
    addIncome.mockRejectedValueOnce(new Error('network'));

    render(<Provider store={store}><IncomeDrawerForm accent="#10b981" /></Provider>);
    fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '5000' } });
    fireEvent.click(screen.getByText(/income\.numpadSave/));

    await waitFor(() => expect(addIncome).toHaveBeenCalledTimes(1));
    // Financial write failed → drawer stays open, chat card never attempted
    expect(store.getState().quickAdd.open).toBe(true);
    expect(recordSavedCard).not.toHaveBeenCalled();
  });
});
