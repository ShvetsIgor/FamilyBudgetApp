/**
 * Numbers and lists found wrong by the «silent limits» audit: a list that drops
 * entries with no way to reach them, a total that skips splits or adds up
 * currencies, and day counts that change at noon or west of Greenwich.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import type { Category, SavingsGoal, SerializableExpense, SerializableRecurringPayment, UserProfile } from '@/shared/types';

const fetchGoals = vi.fn();
vi.mock('@/features/savings/services/savingsService', () => ({
  fetchGoals: (...args: unknown[]) => fetchGoals(...args),
}));
vi.mock('@/features/income/services/incomeService', () => ({ addIncome: vi.fn() }));
vi.mock('@/features/chat/services/savedCardService', () => ({
  recordSavedCard: vi.fn(),
  buildEntryDateHint: () => undefined,
}));
vi.mock('@/features/recurring/hooks/useRecurringActions', () => ({
  useRecurringActions: () => ({ markPaid: vi.fn() }),
}));
vi.mock('@/shared/hooks/useT', () => {
  const t = ((k: string, params?: Record<string, unknown>) => (params ? `${k}:${JSON.stringify(params)}` : k)) as
    ((k: string, params?: Record<string, unknown>) => string) & { cat: (n: string) => string };
  t.cat = (n: string) => n;
  return { useT: () => t };
});
vi.mock('@/shared/hooks/useDateFnsLocale', () => ({ useDateFnsLocale: () => undefined }));

import { store } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { setCategories } from '@/features/categories/store/categoriesSlice';
import { setExpenses } from '@/features/expenses/store/expensesSlice';
import { setBudgets } from '@/features/budget/store/budgetSlice';
import { setRecurring } from '@/features/recurring/store/recurringSlice';
import { setCurrency } from '@/features/ui/store/uiSlice';
import { RPEnvelopes } from '@/features/chat/desktop/widgets/RPEnvelopes';
import { RPBills } from '@/features/chat/desktop/widgets/RPBills';
import { RPGoals } from '@/features/chat/desktop/widgets/RPGoals';
import { RPToday } from '@/features/chat/desktop/widgets/RPToday';
import { IncomeDrawerForm } from '@/features/quickadd/components/IncomeDrawerForm';
import { UpcomingBills } from '@/features/recurring/components/UpcomingBills';
import { daysCountedInMonth } from '@/features/analytics/utils/daysCountedInMonth';
import { goalDaysLeft } from '@/features/savings/utils/goalDays';
import { computeDailyBudget } from '@/features/budget/utils/dailyBudget';

const user = {
  id: 'u1', name: 'A', email: 'a@x.com', currency: 'ILS', language: 'en',
  theme: 'mist', accountType: 'personal',
} as UserProfile;
const cat = (id: string, name: string, type: 'expense' | 'income' = 'expense'): Category => ({
  id, userId: 'u1', name, icon: 'box', color: '#10b981', type, order: 0, isPrivate: false,
});
const inThisMonth = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12).toISOString();
const dayFromNow = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};
const bill = (id: string, nextDueDate: string, overrides: Partial<SerializableRecurringPayment> = {}) => ({
  id, userId: 'u1', name: id, amount: 40, currency: 'ILS', categoryId: 'c', frequency: 'monthly',
  type: 'subscription', isActive: true, nextDueDate, startDate: nextDueDate, ...overrides,
}) as SerializableRecurringPayment;
const inStore = (ui: React.ReactElement) => render(<Provider store={store}>{ui}</Provider>);

beforeEach(() => {
  fetchGoals.mockReset();
  fetchGoals.mockResolvedValue([]);
  store.dispatch(setUser(user));
  store.dispatch(setCurrency('ILS'));
  store.dispatch(setExpenses([]));
  store.dispatch(setBudgets({}));
  store.dispatch(setRecurring([]));
});

describe('RPEnvelopes', () => {
  beforeEach(() => {
    store.dispatch(setCategories({ type: 'expense', categories: [cat('a', 'Aa'), cat('b', 'Bb')] }));
  });

  it('counts splits and leaves foreign charges out, like /budget', () => {
    store.dispatch(setBudgets({ a: 500, b: 100 }));
    store.dispatch(setExpenses([
      { id: 'mixed', userId: 'u1', amount: 100, currency: 'ILS', categoryId: 'a', date: inThisMonth(), splits: [{ categoryId: 'b', amount: 30 }] },
      { id: 'usd', userId: 'u1', amount: 999, currency: 'USD', categoryId: 'a', date: inThisMonth(), splits: [] },
    ] as SerializableExpense[]));
    inStore(<RPEnvelopes />);
    expect(screen.getByText(/₪70\s*\/\s*₪500/)).toBeTruthy();
    expect(screen.getByText(/₪30\s*\/\s*₪100/)).toBeTruthy();
  });

  it('shows no raw id for a limit whose category is gone, and no NaN', () => {
    store.dispatch(setBudgets({ ghost: 300, a: 0 }));
    inStore(<RPEnvelopes />);
    expect(screen.queryByText('ghost')).toBeNull();
    expect(document.body.textContent).not.toContain('NaN');
  });

  it('keeps the fullest four when there are more', () => {
    const cats = [1, 2, 3, 4, 5].map((n) => cat(`c${n}`, `Cat${n}`));
    store.dispatch(setCategories({ type: 'expense', categories: cats }));
    store.dispatch(setBudgets(Object.fromEntries(cats.map((c) => [c.id, 100]))));
    store.dispatch(setExpenses(cats.slice(1).map((c, i) => ({
      id: c.id, userId: 'u1', amount: 10 * (i + 1), currency: 'ILS', categoryId: c.id, date: inThisMonth(), splits: [],
    })) as unknown as SerializableExpense[]));
    inStore(<RPEnvelopes />);
    expect(screen.queryByText('Cat1')).toBeNull();
    expect(screen.getByText('Cat5')).toBeTruthy();
  });
});

describe('RP widgets currency', () => {
  it('writes ₽ and CA$, not €', () => {
    store.dispatch(setCurrency('RUB'));
    inStore(<RPToday />);
    expect(document.body.textContent).toContain('₽');
    expect(document.body.textContent).not.toContain('€');
  });

  it('prices a bill in its own currency', () => {
    store.dispatch(setRecurring([bill('netflix', dayFromNow(2), { currency: 'USD' })]));
    inStore(<RPBills />);
    expect(screen.getByText('$40')).toBeTruthy();
  });
});

describe('RPBills days', () => {
  it('calls an overdue bill overdue, not «in -3 days»', () => {
    store.dispatch(setRecurring([bill('late', dayFromNow(-3))]));
    inStore(<RPBills />);
    expect(screen.getByText('recurring.overdueDays:{"n":3}')).toBeTruthy();
  });

  it('calls tomorrow tomorrow at any hour', () => {
    const tomorrowMorning = new Date();
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(0, 0, 0, 0);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(tomorrowMorning.getTime() - 3_600_000)); // 23:00 the night before
    store.dispatch(setRecurring([bill('soon', tomorrowMorning.toISOString())]));
    inStore(<RPBills />);
    expect(screen.getByText('chat.desktop.tomorrow')).toBeTruthy();
    vi.useRealTimers();
  });
});

describe('RPGoals', () => {
  it('loads the goals itself: nothing else has by the time /home renders', async () => {
    fetchGoals.mockResolvedValue([{
      id: 'g1', name: 'Trip', currency: 'USD', targetAmount: 100, currentAmount: 25, userId: 'u1',
    } as SavingsGoal]);
    inStore(<RPGoals />);
    await waitFor(() => expect(screen.getByText('Trip')).toBeTruthy());
    expect(screen.getByText(/\$25/)).toBeTruthy();
    expect(fetchGoals).toHaveBeenCalledWith('u1');
  });
});

describe('IncomeDrawerForm', () => {
  it('offers every income category, not the first eight', () => {
    store.dispatch(setCategories({
      type: 'income',
      categories: Array.from({ length: 11 }, (_, i) => cat(`inc${i}`, `Source ${i}`, 'income')),
    }));
    inStore(<IncomeDrawerForm accent="#10b981" />);
    expect(screen.getAllByText('Source 10').length).toBeGreaterThan(0);
  });
});

describe('UpcomingBills', () => {
  it('links to the rest when a limit hides some', () => {
    const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 12).toISOString();
    store.dispatch(setRecurring([bill('one', lastDay), bill('two', lastDay), bill('three', lastDay)]));
    const { unmount } = inStore(<UpcomingBills maxItems={2} />);
    expect(screen.getByText('recurring.seeAll')).toBeTruthy();
    unmount();
    inStore(<UpcomingBills maxItems={5} />);
    expect(screen.queryByText('recurring.seeAll')).toBeNull();
  });
});

describe('day counts', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it('averages the current month over the days so far, west of Greenwich too', () => {
    process.env.TZ = 'America/Toronto';
    const now = new Date(2026, 10, 3, 12);
    expect(daysCountedInMonth('2026-11', now)).toBe(3);
    expect(daysCountedInMonth('2026-10', now)).toBe(31);
    expect(daysCountedInMonth('2026-02', now)).toBe(28);
  });

  it('counts a deadline in calendar days, whatever the hour', () => {
    expect(goalDaysLeft(new Date(2026, 10, 4).toISOString(), new Date(2026, 10, 3, 14))).toBe(1);
    expect(goalDaysLeft(new Date(2026, 10, 3).toISOString(), new Date(2026, 10, 3, 14))).toBe(0);
    expect(goalDaysLeft(new Date(2026, 10, 1).toISOString(), new Date(2026, 10, 3, 14))).toBe(-2);
  });
});

describe('computeDailyBudget', () => {
  const base = { dailyLimit: 0, monthlyLimit: 0, monthSpent: 900, monthIncome: 0, now: new Date(2026, 10, 21, 12) };

  it('spreads what is left of the month over the days left', () => {
    expect(computeDailyBudget({ ...base, mode: 'monthly', monthlyLimit: 2000 })).toBe(110);
    expect(computeDailyBudget({ ...base, mode: 'auto', monthIncome: 1900 })).toBe(100);
  });

  it('never goes negative, and is zero with nothing to spread', () => {
    expect(computeDailyBudget({ ...base, mode: 'monthly', monthlyLimit: 500 })).toBe(0);
    expect(computeDailyBudget({ ...base, mode: 'auto' })).toBe(0);
    expect(computeDailyBudget({ ...base, mode: 'daily', dailyLimit: 75 })).toBe(75);
  });
});
