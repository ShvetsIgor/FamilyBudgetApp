/**
 * A family total that silently drops one member reads as a real number. Every
 * family loader reports the members it could not read, and the notice says the
 * total is incomplete (or that nothing loaded) with a retry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';

const m = vi.hoisted(() => ({ failing: new Set<string>() }));
const maybeFail = async <T,>(uid: string, value: T): Promise<T> => {
  if (m.failing.has(uid)) throw Object.assign(new Error('unavailable'), { code: 'unavailable' });
  return value;
};

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  getDoc: async () => ({ exists: () => false, data: () => ({}) }),
  updateDoc: vi.fn(), deleteField: vi.fn(),
}));
vi.mock('@/features/expenses/services/expensesService', () => ({
  fetchSharedMonthExpenses: (uid: string) => maybeFail(uid, [{ id: `${uid}-e`, categoryId: 'food', date: '2026-09-10T10:00:00.000Z', amount: 10, currency: 'ILS' }]),
  fetchSharedExpensesInRange: (uid: string) => maybeFail(uid, [{ id: `${uid}-e`, categoryId: 'food', date: '2026-09-10T10:00:00.000Z', amount: 10, currency: 'ILS' }]),
}));
vi.mock('@/features/income/services/incomeService', () => ({
  fetchSharedMonthIncome: (uid: string) => maybeFail(uid, []),
  fetchSharedIncomeInRange: (uid: string) => maybeFail(uid, []),
}));
vi.mock('@/features/savings/services/savingsService', () => ({
  fetchSharedGoals: (uid: string) => maybeFail(uid, [{ id: `${uid}-g`, name: 'Trip' }]),
}));

import { store } from '@/store/store';
import { setLanguage } from '@/features/ui/store/uiSlice';
import {
  fetchFamilyAnalytics, fetchFamilyGoals, fetchFamilyMonthExpenses, fetchFamilyMonthIncomes,
} from '@/features/family/services/familyBudgetService';
import { FamilyLoadNotice } from '@/features/family/components/FamilyLoadNotice';
import type { UserProfile } from '@/shared/types';

const members = [
  { id: 'me', name: 'Me' }, { id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' },
] as UserProfile[];

beforeEach(() => { m.failing = new Set(); });
afterEach(() => { store.dispatch(setLanguage('en')); });

describe('family loaders report unreadable members', () => {
  it('lists failed members in member order and keeps the others', async () => {
    m.failing = new Set(['bob', 'alice']);
    const expenses = await fetchFamilyMonthExpenses(members, '2026-09', 'me', []);
    expect(expenses.failedMemberIds).toEqual(['alice', 'bob']);
    expect(expenses.expenses.map((e) => e.memberId)).toEqual(['me']);

    const incomes = await fetchFamilyMonthIncomes(members, '2026-09', 'me', []);
    expect(incomes.failedMemberIds).toEqual(['alice', 'bob']);

    const goals = await fetchFamilyGoals(members);
    expect(goals.failedMemberIds).toEqual(['alice', 'bob']);
    expect(goals.goals.map((g) => g.memberId)).toEqual(['me']);

    const analytics = await fetchFamilyAnalytics(members, ['2026-09'], 'me', [], 'ILS');
    expect(analytics.failedMemberIds).toEqual(['alice', 'bob']);
    expect(analytics.totalSpent).toBe(10);
  });

  it('reports nothing when every member loaded', async () => {
    expect((await fetchFamilyMonthExpenses(members, '2026-09', 'me', [])).failedMemberIds).toEqual([]);
    expect((await fetchFamilyGoals(members)).failedMemberIds).toEqual([]);
  });
});

describe('FamilyLoadNotice', () => {
  const renderNotice = (props: Partial<React.ComponentProps<typeof FamilyLoadNotice>> = {}) => {
    const onRetry = vi.fn();
    render(
      <Provider store={store}>
        <FamilyLoadNotice failedMemberIds={[]} members={members} onRetry={onRetry} {...props} />
      </Provider>,
    );
    return onRetry;
  };

  it('renders nothing when everything loaded', () => {
    renderNotice();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('names the missing members and retries', () => {
    const onRetry = renderNotice({ failedMemberIds: ['alice', 'bob'] });
    expect(screen.getByRole('alert').textContent).toContain('Alice, Bob');
    expect(screen.getByRole('alert').textContent).toContain('incomplete');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('says nothing loaded on total failure, in Russian too', () => {
    store.dispatch(setLanguage('ru'));
    renderNotice({ failedEntirely: true });
    expect(screen.getByRole('alert').textContent).toContain('Не удалось загрузить семейные данные');
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
  });
});
