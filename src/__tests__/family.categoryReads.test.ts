/**
 * Another member's category names cost one document read each (rules forbid
 * listing them). That must be one read per distinct (member, category) — not
 * one per row — and two members' identical category ids stay separate.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  reads: [] as string[],
  expenses: {} as Record<string, { id: string; categoryId: string; date: string }[]>,
  incomes: {} as Record<string, { id: string; categoryId: string; date: string }[]>,
}));

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  getDoc: async (path: string) => {
    m.reads.push(path);
    const [, owner, , id] = path.split('/');
    return { exists: () => true, data: () => ({ name: `${owner}:${id}`, icon: 'cart', color: '#fff' }) };
  },
  updateDoc: vi.fn(), deleteField: vi.fn(),
}));
vi.mock('@/features/expenses/services/expensesService', () => ({
  fetchSharedMonthExpenses: async (uid: string) => m.expenses[uid] ?? [],
  fetchSharedExpensesInRange: vi.fn(),
}));
vi.mock('@/features/income/services/incomeService', () => ({
  fetchSharedMonthIncome: async (uid: string) => m.incomes[uid] ?? [],
  fetchSharedIncomeInRange: vi.fn(),
}));
vi.mock('@/features/savings/services/savingsService', () => ({ fetchSharedGoals: vi.fn() }));

import { fetchFamilyMonthExpenses, fetchFamilyMonthIncomes } from '@/features/family/services/familyBudgetService';
import type { UserProfile } from '@/shared/types';

const members = [
  { id: 'me', name: 'Me' }, { id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' },
] as UserProfile[];

function rows(categoryIds: string[]) {
  return categoryIds.map((categoryId, i) => ({ id: `${categoryId}-${i}`, categoryId, date: `2026-09-${String(10 + i).padStart(2, '0')}` }));
}

beforeEach(() => {
  m.reads = [];
  m.expenses = { me: rows(['food']), alice: rows(['food', 'food', 'food', 'fuel', 'food']), bob: rows(['food', 'food']) };
  m.incomes = { alice: rows(['salary', 'salary', 'salary']), bob: rows(['salary']) };
});

describe('family category metadata', () => {
  it('reads each foreign (member, category) once for expenses', async () => {
    const data = await fetchFamilyMonthExpenses(members, '2026-09', 'me', [
      { id: 'food', name: 'My food', icon: 'cart', color: '#000' },
    ] as never);

    expect(m.reads.sort()).toEqual([
      'categories/alice/expense/food', 'categories/alice/expense/fuel', 'categories/bob/expense/food',
    ]);
    expect(data.categoryMeta['me|food']?.name).toBe('My food');
    expect(data.categoryMeta['alice|food']?.name).toBe('alice:food');
    expect(data.categoryMeta['bob|food']?.name).toBe('bob:food');
  });

  it('reads each foreign (member, category) once for incomes', async () => {
    const data = await fetchFamilyMonthIncomes(members, '2026-09', 'me', []);

    expect(m.reads.sort()).toEqual(['categories/alice/income/salary', 'categories/bob/income/salary']);
    expect(data.categoryMeta['alice|salary']?.name).toBe('alice:salary');
    expect(data.categoryMeta['bob|salary']?.name).toBe('bob:salary');
  });
});
