import { describe, it, expect } from 'vitest';
import reducer, {
  setCategories,
  addCategory,
  updateCategory,
  removeCategory,
} from '@/features/categories/store/categoriesSlice';
import type { Category } from '@/shared/types';

const makeCategory = (id: string, type: 'expense' | 'income' = 'expense'): Category => ({
  id,
  userId: 'u1',
  name: `Cat ${id}`,
  icon: 'cart',
  color: '#E07A5F',
  type,
  isPrivate: false,
  order: 0,
});

const initialState = { expense: [], income: [], status: 'idle' as const };

describe('categoriesSlice', () => {
  it('setCategories sets list for expense type', () => {
    const cat = makeCategory('1', 'expense');
    const state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    expect(state.expense).toHaveLength(1);
    expect(state.income).toHaveLength(0);
  });

  it('setCategories sets list for income type', () => {
    const cat = makeCategory('1', 'income');
    const state = reducer(initialState, setCategories({ type: 'income', categories: [cat] }));
    expect(state.income).toHaveLength(1);
    expect(state.expense).toHaveLength(0);
  });

  it('addCategory appends to correct list', () => {
    const cat = makeCategory('1', 'expense');
    const state = reducer(initialState, addCategory(cat));
    expect(state.expense).toHaveLength(1);
    expect(state.expense[0].id).toBe('1');
  });

  it('updateCategory replaces matching entry', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, updateCategory({ ...cat, name: 'Updated' }));
    expect(state.expense[0].name).toBe('Updated');
  });

  it('updateCategory does not affect other types', () => {
    const expCat = makeCategory('1', 'expense');
    const incCat = makeCategory('1', 'income');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [expCat] }));
    state = reducer(state, setCategories({ type: 'income', categories: [incCat] }));
    state = reducer(state, updateCategory({ ...expCat, name: 'Changed' }));
    expect(state.income[0].name).toBe('Cat 1');
  });

  it('removeCategory removes from expense list', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, removeCategory({ id: '1', type: 'expense' }));
    expect(state.expense).toHaveLength(0);
  });

  it('removeCategory ignores wrong type', () => {
    const cat = makeCategory('1', 'expense');
    let state = reducer(initialState, setCategories({ type: 'expense', categories: [cat] }));
    state = reducer(state, removeCategory({ id: '1', type: 'income' }));
    expect(state.expense).toHaveLength(1);
  });
});
