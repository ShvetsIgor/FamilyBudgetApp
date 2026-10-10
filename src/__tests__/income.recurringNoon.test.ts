/**
 * A booked recurring income is a calendar date, stored at local NOON: a
 * midnight timestamp read in any timezone further west falls on the previous
 * day — and on the 1st, in the previous month.
 */
import { beforeEach, expect, it, vi } from 'vitest';
import { toLocalDateKey } from '@/shared/utils/dateKey';

const m = vi.hoisted(() => ({
  docs: {} as Record<string, Record<string, unknown>>,
  sets: [] as { path: string; data: Record<string, unknown> }[],
}));

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/'), id: parts.at(-1) }),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const updates: [string, Record<string, unknown>][] = [];
      const result = await fn({
        get: async (ref: { path: string; id: string }) => ({
          id: ref.id, exists: () => ref.path in m.docs, data: () => m.docs[ref.path],
        }),
        set: (ref: { path: string }, data: Record<string, unknown>) => { m.sets.push({ path: ref.path, data }); },
        update: (ref: { path: string }, data: Record<string, unknown>) => { updates.push([ref.path, data]); },
      });
      for (const [path, data] of updates) m.docs[path] = { ...m.docs[path], ...data };
      return result;
    },
  };
});
vi.mock('@/features/income/services/recurringIncomeService', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/income/services/recurringIncomeService')>(),
  fetchRecurringIncome: async () => [{ id: 'salary' }],
}));
vi.mock('@/features/income/services/incomeService', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/income/services/incomeService')>(),
  fetchMonthIncome: async () => [],
}));

import { loadCurrentMonthIncomes } from '@/features/income/services/incomeStartupService';

beforeEach(() => {
  const today = new Date();
  m.sets = [];
  m.docs = {
    'categories/bob/income/salary': { name: 'Salary' },
    'recurringIncome/bob/items/salary': {
      userId: 'bob', name: 'Salary', amount: 1000, currency: 'ILS', categoryId: 'salary',
      dayOfMonth: today.getDate(), nextDueDate: toLocalDateKey(today), isActive: true,
    },
  };
});

it('books a due salary once, dated at local noon of its day', async () => {
  await loadCurrentMonthIncomes('bob', () => { throw new Error('unexpected recurring error'); });

  const incomes = m.sets.filter(s => s.path.startsWith('incomes/bob/items/'));
  expect(incomes).toHaveLength(1);
  const date = (incomes[0].data.date as { toDate(): Date }).toDate();
  expect(toLocalDateKey(date)).toBe(toLocalDateKey(new Date()));
  expect(date.getHours()).toBe(12);
});
