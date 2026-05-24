import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import suggestionMemoryReducer, {
  recordExpense,
  recordSplitExpense,
} from '@/features/expenses/store/suggestionMemorySlice';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';
import { computeSuggestions } from '@/features/expenses/engine/suggestionEngine';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeStore(initial?: Partial<SuggestionMemoryState>) {
  // Always pass preloadedState to bypass the localStorage initializer
  return configureStore({
    reducer: { suggestionMemory: suggestionMemoryReducer },
    preloadedState: {
      suggestionMemory: {
        merchants: initial?.merchants ?? {},
        recents: initial?.recents ?? [],
        splitCombos: initial?.splitCombos ?? [],
      },
    },
  });
}

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const emptyMemory: SuggestionMemoryState = { merchants: {}, recents: [], splitCombos: [], tagAssociations: [] };

// ── recordSplitExpense ────────────────────────────────────────────────────────

describe('recordSplitExpense', () => {
  it('adds a new split combo', () => {
    const store = makeStore();
    store.dispatch(recordSplitExpense({ merchant: 'Dabbah', categoryIds: ['food', 'household'], date: today }));
    const state = store.getState().suggestionMemory;
    expect(state.splitCombos).toHaveLength(1);
    expect(state.splitCombos[0].categoryIds).toEqual(['food', 'household'].sort());
    expect(state.splitCombos[0].merchantKey).toBe('dabbah');
    expect(state.splitCombos[0].count).toBe(1);
  });

  it('increments count on repeated combo', () => {
    const store = makeStore();
    store.dispatch(recordSplitExpense({ merchant: 'Dabbah', categoryIds: ['food', 'household'], date: today }));
    store.dispatch(recordSplitExpense({ merchant: 'Dabbah', categoryIds: ['household', 'food'], date: today }));
    const state = store.getState().suggestionMemory;
    expect(state.splitCombos).toHaveLength(1);
    expect(state.splitCombos[0].count).toBe(2);
  });

  it('stores combo with no merchant as empty merchantKey', () => {
    const store = makeStore();
    store.dispatch(recordSplitExpense({ categoryIds: ['cat1', 'cat2'], date: today }));
    const state = store.getState().suggestionMemory;
    expect(state.splitCombos[0].merchantKey).toBe('');
  });

  it('ignores single-category splits (not a real split)', () => {
    const store = makeStore();
    store.dispatch(recordSplitExpense({ merchant: 'Shop', categoryIds: ['food'], date: today }));
    const state = store.getState().suggestionMemory;
    expect(state.splitCombos).toHaveLength(0);
  });

  it('normalizes category order — same combo regardless of input order', () => {
    const store = makeStore();
    store.dispatch(recordSplitExpense({ categoryIds: ['zzz', 'aaa'], date: today }));
    store.dispatch(recordSplitExpense({ categoryIds: ['aaa', 'zzz'], date: today }));
    const state = store.getState().suggestionMemory;
    expect(state.splitCombos).toHaveLength(1);
    expect(state.splitCombos[0].categoryIds).toEqual(['aaa', 'zzz']);
  });

  it('treats different merchants as different combos', () => {
    const store = makeStore();
    store.dispatch(recordSplitExpense({ merchant: 'StoreA', categoryIds: ['food', 'health'], date: today }));
    store.dispatch(recordSplitExpense({ merchant: 'StoreB', categoryIds: ['food', 'health'], date: today }));
    const state = store.getState().suggestionMemory;
    expect(state.splitCombos).toHaveLength(2);
  });

  it('updates lastUsed on re-use', () => {
    const store = makeStore();
    store.dispatch(recordSplitExpense({ categoryIds: ['a', 'b'], date: yesterday }));
    store.dispatch(recordSplitExpense({ categoryIds: ['a', 'b'], date: today }));
    const state = store.getState().suggestionMemory;
    expect(state.splitCombos[0].lastUsed).toBe(today);
  });
});

// ── split_history signal in computeSuggestions ────────────────────────────────

describe('computeSuggestions split_history signal', () => {
  const items = [
    { id: 'food', name: 'Food' },
    { id: 'health', name: 'Health' },
    { id: 'transport', name: 'Transport' },
  ];

  it('boosts a category that appears in split combos for this merchant', () => {
    const mem: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [
        { key: 'shop|food,health', merchantKey: 'shop', categoryIds: ['food', 'health'], count: 3, lastUsed: today },
      ],
    };
    const scored = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const foodScore = scored.find((s) => s.categoryId === 'food')?.score ?? 0;
    const transportScore = scored.find((s) => s.categoryId === 'transport')?.score ?? 0;
    expect(foodScore).toBeGreaterThan(transportScore);
  });

  it('includes split_history reason when combo is present', () => {
    const mem: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [
        { key: 'shop|food,health', merchantKey: 'shop', categoryIds: ['food', 'health'], count: 2, lastUsed: today },
      ],
    };
    const scored = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const food = scored.find((s) => s.categoryId === 'food');
    expect(food?.reasons.some((r) => r.kind === 'split_history')).toBe(true);
  });

  it('does not add split_history reason when no combos match', () => {
    const scored = computeSuggestions({ merchant: 'shop', items, memory: emptyMemory });
    expect(scored.every((s) => s.reasons.every((r) => r.kind !== 'split_history'))).toBe(true);
  });
});
