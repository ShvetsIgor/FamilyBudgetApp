import { describe, it, expect } from 'vitest';
import reducer, {
  setExpenses,
  prependExpense,
  updateExpense,
  removeExpense,
  remapExpenseCategories,
} from '@/features/expenses/store/expensesSlice';
import type { SerializableExpense } from '@/shared/types';

const makeExpense = (id: string, categoryId: string): SerializableExpense => ({
  id,
  userId: 'u1',
  amount: 100,
  currency: 'ILS',
  categoryId,
  date: '2026-05-01T10:00:00.000Z',
  paymentMethod: 'card',
  tags: [],
  privacy: 'regular',
  splits: [],
  createdAt: '2026-05-01T10:00:00.000Z',
  updatedAt: '2026-05-01T10:00:00.000Z',
});

const initialState = { list: [], status: 'idle' as const, hasMore: true, error: null };

describe('expensesSlice', () => {
  it('setExpenses replaces list and sets status to ready', () => {
    const e = makeExpense('1', 'cat1');
    const state = reducer(initialState, setExpenses([e]));
    expect(state.list).toHaveLength(1);
    expect(state.status).toBe('ready');
  });

  it('prependExpense adds to the front', () => {
    const e1 = makeExpense('1', 'cat1');
    const e2 = makeExpense('2', 'cat2');
    let state = reducer(initialState, setExpenses([e1]));
    state = reducer(state, prependExpense(e2));
    expect(state.list[0].id).toBe('2');
    expect(state.list[1].id).toBe('1');
  });

  it('updateExpense replaces matching entry', () => {
    const e = makeExpense('1', 'cat1');
    let state = reducer(initialState, setExpenses([e]));
    state = reducer(state, updateExpense({ ...e, amount: 999 }));
    expect(state.list[0].amount).toBe(999);
  });

  it('removeExpense deletes by id', () => {
    const e = makeExpense('1', 'cat1');
    let state = reducer(initialState, setExpenses([e]));
    state = reducer(state, removeExpense('1'));
    expect(state.list).toHaveLength(0);
  });

  describe('remapExpenseCategories', () => {
    it('remaps categoryId', () => {
      const e = makeExpense('1', 'oldCat');
      let state = reducer(initialState, setExpenses([e]));
      state = reducer(state, remapExpenseCategories({ oldCat: 'newCat' }));
      expect(state.list[0].categoryId).toBe('newCat');
    });

    it('leaves id unchanged when not in map', () => {
      const e = makeExpense('1', 'cat1');
      let state = reducer(initialState, setExpenses([e]));
      state = reducer(state, remapExpenseCategories({ other: 'x' }));
      expect(state.list[0].categoryId).toBe('cat1');
    });

    it('handles empty map without errors', () => {
      const e = makeExpense('1', 'cat1');
      let state = reducer(initialState, setExpenses([e]));
      state = reducer(state, remapExpenseCategories({}));
      expect(state.list[0].categoryId).toBe('cat1');
    });
  });
});
