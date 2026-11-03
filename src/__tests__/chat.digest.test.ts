/**
 * The morning card and the weekly summary read what is in the store. Sent at
 * mount on a cold start they read nothing («₪0 yesterday», and once marked sent
 * there was no second try), and «yesterday» or «this week» reaching into the
 * previous month was never loaded at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Category, SerializableExpense } from '@/shared/types';

const fetchMonthExpenses = vi.fn();
const addMessage = vi.fn();
vi.mock('@/features/expenses/services/expensesService', () => ({
  fetchMonthExpenses: (...args: unknown[]) => fetchMonthExpenses(...args),
}));
vi.mock('@/features/chat/services/messagesService', () => ({
  addMessage: (...args: unknown[]) => addMessage(...args),
}));

import { store } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { setCategories } from '@/features/categories/store/categoriesSlice';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setIncome } from '@/features/income/store/incomeSlice';
import { setBudgets } from '@/features/budget/store/budgetSlice';
import { setBudgetMode, setBudgetMonthlyLimit, setBudgetDailyLimit } from '@/features/ui/store/uiSlice';
import { hydrateNotifications } from '@/features/notifications/store/notificationsSlice';
import { collectDigestContext, type DigestContext } from '@/features/chat/bot/context';
import { digestMonths, sendDueDigests } from '@/features/chat/bot/digest';
import { buildMorningCard } from '@/features/chat/bot/morning';
import { buildWeeklyCard } from '@/features/chat/bot/weekly';
import { handleSlashCommand } from '@/features/chat/bot/slash';
import type { EnvelopesCardData } from '@/features/chat/components/BotCard/EnvelopesCard';

const cat = (id: string, name: string): Category => ({
  id, name, userId: 'u1', icon: 'box', color: '#E07A5F', isPrivate: false, order: 0, type: 'expense',
});
const expense = (id: string, amount: number, date: string, overrides: Partial<SerializableExpense> = {}): SerializableExpense => ({
  id, userId: 'u1', amount, currency: 'ILS', categoryId: 'groceries', date,
  paymentMethod: 'card', tags: [], privacy: 'regular', splits: [], isRecurring: false,
  createdAt: date, updatedAt: date, ...overrides,
} as SerializableExpense);

// Sunday 2026-11-01, evening: yesterday and most of this week are in October
const NOV_1 = new Date(2026, 10, 1, 19);

function ctxWith(expenses: SerializableExpense[], limits: Record<string, number> = {}): DigestContext {
  const categories = [cat('groceries', 'Groceries'), cat('coffee', 'Coffee')];
  return {
    userId: 'u1', currency: 'ILS', language: 'en',
    categoriesById: new Map(categories.map((c) => [c.id, c])),
    foldersById: new Map(), topCategoryIds: [], incomeCategoriesById: new Map(), topIncomeCategoryIds: [],
    todaySpent: 0, suggestionMemory: {} as DigestContext['suggestionMemory'],
    allExpenses: expenses, budgetLimits: limits, dailyBudget: 0, todayFree: 0,
  };
}

describe('digestMonths', () => {
  it('stays in the month when yesterday and the whole week are in it', () => {
    expect(digestMonths(new Date(2026, 10, 18, 12))).toEqual(['2026-11']);
  });

  it('reaches back when the week started last month, or yesterday was in it', () => {
    expect(digestMonths(NOV_1)).toEqual(['2026-11', '2026-10']);
    expect(digestMonths(new Date(2026, 8, 3, 12))).toEqual(['2026-09', '2026-08']);
  });
});

describe('buildWeeklyCard', () => {
  it('adds up the whole week across a month boundary', () => {
    const card = buildWeeklyCard(ctxWith([
      expense('oct', 100, new Date(2026, 9, 28, 12).toISOString()),
      expense('nov', 50, new Date(2026, 10, 1, 12).toISOString()),
      expense('before', 999, new Date(2026, 9, 25, 12).toISOString()),
    ]), NOV_1);
    expect(card.totalSpent).toBe(150);
  });

  it('credits a split receipt to the categories it was split into', () => {
    const card = buildWeeklyCard(ctxWith([
      expense('mixed', 100, new Date(2026, 10, 1, 12).toISOString(), {
        categoryId: 'groceries', splits: [{ categoryId: 'coffee', amount: 30 }],
      } as Partial<SerializableExpense>),
    ], { groceries: 400, coffee: 400 }), NOV_1);
    const spent = Object.fromEntries(card.envelopes.map((e) => [e.name, e.spent]));
    expect(spent).toEqual({ Groceries: 70, Coffee: 30 });
  });

  it('does not budget with a limit a deleted category left behind', () => {
    const card = buildWeeklyCard(ctxWith([], { groceries: 400, gone: 4000 }), NOV_1);
    expect(card.totalBudget).toBe(100);
    expect(card.envelopes.map((e) => e.name)).toEqual(['Groceries']);
  });

  it('never shows a raw category id', () => {
    const card = buildWeeklyCard(ctxWith([
      expense('orphan', 10, new Date(2026, 10, 1, 12).toISOString(), { categoryId: 'xYz123' }),
    ]), NOV_1);
    expect(card.mostFrequent).not.toContain('xYz123');
  });
});

describe('buildMorningCard', () => {
  it('finds yesterday in the previous month on the 1st', () => {
    const card = buildMorningCard(ctxWith([
      expense('yesterday', 120, new Date(2026, 9, 31, 12).toISOString()),
      expense('today', 7, new Date(2026, 10, 1, 9).toISOString()),
    ]), NOV_1);
    expect(card.yesterdayAmount).toBe(120);
  });
});

describe('sendDueDigests', () => {
  const user = { id: 'u1', name: 'A', email: 'a@x.com', currency: 'ILS', language: 'en', theme: 'mist', accountType: 'personal' };
  const notifications = () => store.getState().notifications.items;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOV_1);
    localStorage.clear();
    fetchMonthExpenses.mockReset();
    store.dispatch(setUser(user as never));
    store.dispatch(setExpenses([]));
    store.dispatch(hydrateNotifications('u1'));
    store.dispatch(setCategories({ type: 'expense', categories: [cat('groceries', 'Groceries')] }));
  });
  afterEach(() => vi.useRealTimers());

  it('reports yesterday and the week from the month it had to load', async () => {
    fetchMonthExpenses.mockResolvedValue([expense('oct', 120, new Date(2026, 9, 31, 12).toISOString())]);
    await sendDueDigests('u1', NOV_1);
    expect(fetchMonthExpenses.mock.calls.map((c) => c[1])).toEqual(['2026-10']);
    const byKind = Object.fromEntries(notifications().map((n) => [n.kind, n.data as Record<string, number>]));
    expect(byKind.morning.yesterdayAmount).toBe(120);
    expect(byKind.weekly.totalSpent).toBe(120);
  });

  it('sends nothing and marks nothing when the read fails, so the next launch can', async () => {
    fetchMonthExpenses.mockRejectedValue(new Error('offline'));
    await expect(sendDueDigests('u1', NOV_1)).rejects.toThrow('offline');
    expect(notifications()).toHaveLength(0);

    fetchMonthExpenses.mockResolvedValue([]);
    await sendDueDigests('u1', NOV_1);
    expect(notifications().map((n) => n.kind).sort()).toEqual(['morning', 'weekly']);
  });

  it('sends nothing into another account', async () => {
    fetchMonthExpenses.mockImplementation(async () => {
      store.dispatch(setUser({ ...user, id: 'u2' } as never));
      return [expense('oct', 120, new Date(2026, 9, 31, 12).toISOString())];
    });
    await sendDueDigests('u1', NOV_1);
    expect(notifications()).toHaveLength(0);
    expect(store.getState().expenses.list).toHaveLength(0);
  });

  it('sends each digest once a day', async () => {
    fetchMonthExpenses.mockResolvedValue([]);
    await sendDueDigests('u1', NOV_1);
    fetchMonthExpenses.mockClear();
    await sendDueDigests('u1', NOV_1);
    expect(fetchMonthExpenses).not.toHaveBeenCalled();
    expect(notifications()).toHaveLength(2);
  });
});

describe('collectDigestContext', () => {
  const NOV_21 = new Date(2026, 10, 21, 9); // 10 days left, today included

  beforeEach(() => {
    store.dispatch(setUser({ id: 'u1', name: 'A', email: 'a@x.com', currency: 'ILS', language: 'en', theme: 'mist', accountType: 'personal' } as never));
    store.dispatch(setCategories({ type: 'expense', categories: [cat('groceries', 'Groceries')] }));
    store.dispatch(setExpenses([
      expense('month', 900, new Date(2026, 10, 3, 12).toISOString()),
      expense('foreign', 500, new Date(2026, 10, 3, 12).toISOString(), { currency: 'USD' }),
      expense('old', 700, new Date(2026, 9, 3, 12).toISOString()),
    ]));
    store.dispatch(setIncome([]));
    store.dispatch(setBudgets({}));
    store.dispatch(setBudgetDailyLimit(0));
  });

  it('works out the monthly allowance from this month in the account currency', () => {
    store.dispatch(setBudgetMode('monthly'));
    store.dispatch(setBudgetMonthlyLimit(2000));
    const ctx = collectDigestContext(store.getState(), NOV_21)!;
    expect(ctx.dailyBudget).toBe(110);
    expect(ctx.allExpenses.map((e) => e.id).sort()).toEqual(['month', 'old']);
  });

  it('does not take today off an allowance that already counts it', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOV_21);
    store.dispatch(setExpenses([expense('today', 100, new Date(2026, 10, 21, 8).toISOString())]));
    store.dispatch(setBudgetMode('monthly'));
    store.dispatch(setBudgetMonthlyLimit(1100));
    const ctx = collectDigestContext(store.getState(), NOV_21)!;
    expect(ctx.todayFree).toBe(100);

    store.dispatch(setBudgetMode('daily'));
    store.dispatch(setBudgetDailyLimit(300));
    expect(collectDigestContext(store.getState(), NOV_21)!.todayFree).toBe(200);
    vi.useRealTimers();
  });
});

describe('/balance', () => {
  it('splits a mixed receipt, keeps money from a deleted category, drops its limit', async () => {
    addMessage.mockReset();
    const inThisMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12).toISOString();
    await handleSlashCommand('/balance', ctxWith([
      expense('mixed', 100, inThisMonth, { splits: [{ categoryId: 'coffee', amount: 30 }] } as Partial<SerializableExpense>),
      expense('orphan', 5, inThisMonth, { categoryId: 'xYz123' }),
    ], { groceries: 400, ghost: 900 }));
    const card = addMessage.mock.calls[0][0].card.data as EnvelopesCardData;
    const rows = Object.fromEntries(card.envelopes.map((e) => [e.name, [e.spent, e.limit]]));
    expect(rows).toEqual({ Groceries: [70, 400], Coffee: [30, 0], Other: [5, 0] });
  });
});
