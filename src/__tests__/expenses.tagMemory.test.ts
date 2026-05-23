import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import suggestionMemoryReducer, {
  recordTagAssociation,
  normalizeTag,
  extractTags,
  type SuggestionMemoryState,
} from '@/features/expenses/store/suggestionMemorySlice';
import { computeSuggestions } from '@/features/expenses/engine/suggestionEngine';

function makeStore(initial?: Partial<SuggestionMemoryState>) {
  const preloadedState: SuggestionMemoryState = {
    merchants: {},
    recents: [],
    splitCombos: [],
    tagAssociations: [],
    ...initial,
  };
  return configureStore({
    reducer: { suggestionMemory: suggestionMemoryReducer },
    preloadedState: { suggestionMemory: preloadedState },
  });
}

const today = new Date().toISOString().slice(0, 10);

const items = [
  { id: 'groceries', name: 'Продукты' },
  { id: 'household', name: 'Хозтовары' },
  { id: 'health', name: 'Здоровье' },
  { id: 'transport', name: 'Транспорт' },
];

// ── normalizeTag / extractTags ────────────────────────────────────────────────

describe('normalizeTag', () => {
  it('lowercases and trims', () => {
    expect(normalizeTag('  Dabbah  ')).toBe('dabbah');
    expect(normalizeTag('SHUFERSAL')).toBe('shufersal');
  });

  it('returns empty string for blank input', () => {
    expect(normalizeTag('')).toBe('');
    expect(normalizeTag('   ')).toBe('');
  });
});

describe('extractTags', () => {
  it('returns single normalized token array', () => {
    expect(extractTags('Dabbah')).toEqual(['dabbah']);
    expect(extractTags('SHUFERSAL')).toEqual(['shufersal']);
  });

  it('returns empty array for blank input', () => {
    expect(extractTags('')).toEqual([]);
    expect(extractTags('   ')).toEqual([]);
  });
});

// ── recordTagAssociation reducer ──────────────────────────────────────────────

describe('recordTagAssociation — upsert behavior', () => {
  it('creates a new association on first record', () => {
    const store = makeStore();
    store.dispatch(recordTagAssociation({ tags: ['dabbah'], categoryId: 'groceries', date: today, source: 'split' }));
    const { tagAssociations } = store.getState().suggestionMemory;
    expect(tagAssociations).toHaveLength(1);
    expect(tagAssociations[0]).toMatchObject({ tag: 'dabbah', categoryId: 'groceries', usageCount: 1, source: 'split' });
  });

  it('increments usageCount on repeat call for same tag+category', () => {
    const store = makeStore();
    store.dispatch(recordTagAssociation({ tags: ['dabbah'], categoryId: 'groceries', date: today, source: 'split' }));
    store.dispatch(recordTagAssociation({ tags: ['dabbah'], categoryId: 'groceries', date: today, source: 'split' }));
    store.dispatch(recordTagAssociation({ tags: ['dabbah'], categoryId: 'groceries', date: today, source: 'split' }));
    const { tagAssociations } = store.getState().suggestionMemory;
    expect(tagAssociations).toHaveLength(1);
    expect(tagAssociations[0].usageCount).toBe(3);
  });

  it('creates separate entries for different categories on same tag', () => {
    const store = makeStore();
    store.dispatch(recordTagAssociation({ tags: ['dabbah'], categoryId: 'groceries', date: today, source: 'split' }));
    store.dispatch(recordTagAssociation({ tags: ['dabbah'], categoryId: 'household', date: today, source: 'split' }));
    const { tagAssociations } = store.getState().suggestionMemory;
    expect(tagAssociations).toHaveLength(2);
    const catIds = tagAssociations.map((a) => a.categoryId);
    expect(catIds).toContain('groceries');
    expect(catIds).toContain('household');
  });

  it('creates separate entries for different tags on same category', () => {
    const store = makeStore();
    store.dispatch(recordTagAssociation({ tags: ['dabbah'], categoryId: 'groceries', date: today, source: 'split' }));
    store.dispatch(recordTagAssociation({ tags: ['shufersal'], categoryId: 'groceries', date: today, source: 'split' }));
    const { tagAssociations } = store.getState().suggestionMemory;
    expect(tagAssociations).toHaveLength(2);
  });

  it('does nothing when tags array is empty', () => {
    const store = makeStore();
    store.dispatch(recordTagAssociation({ tags: [], categoryId: 'groceries', date: today, source: 'split' }));
    expect(store.getState().suggestionMemory.tagAssociations).toHaveLength(0);
  });

  it('normalizes tag tokens before storing', () => {
    const store = makeStore();
    store.dispatch(recordTagAssociation({ tags: ['  DABBAH  '], categoryId: 'groceries', date: today, source: 'split' }));
    expect(store.getState().suggestionMemory.tagAssociations[0].tag).toBe('dabbah');
  });
});

// ── tagHistory signal in ranking engine ───────────────────────────────────────

describe('tagHistory signal — ranking', () => {
  it('category with tag association ranks above categories with no signals', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'dabbah', categoryId: 'groceries', usageCount: 1, lastUsedAt: today, source: 'split' },
      ],
    };
    const result = computeSuggestions({ merchant: 'dabbah', items, memory });
    const groceries = result.find((s) => s.categoryId === 'groceries')!;
    expect(groceries.score).toBeGreaterThan(0);
    expect(groceries.reasons.some((r) => r.kind === 'tag_history')).toBe(true);
    // Should rank above cold categories
    const transport = result.find((s) => s.categoryId === 'transport')!;
    expect(groceries.score).toBeGreaterThan(transport.score);
  });

  it('split reinforcement: higher usageCount → higher tagHistory score', () => {
    const memoryLow: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'store', categoryId: 'groceries', usageCount: 1, lastUsedAt: today, source: 'split' },
      ],
    };
    const memoryHigh: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'store', categoryId: 'groceries', usageCount: 3, lastUsedAt: today, source: 'split' },
      ],
    };
    const lowResult = computeSuggestions({ merchant: 'store', items, memory: memoryLow });
    const highResult = computeSuggestions({ merchant: 'store', items, memory: memoryHigh });
    const lowScore = lowResult.find((s) => s.categoryId === 'groceries')!.score;
    const highScore = highResult.find((s) => s.categoryId === 'groceries')!.score;
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('multiple categories share same tag — both get tagHistory signal', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'dabbah', categoryId: 'groceries', usageCount: 2, lastUsedAt: today, source: 'split' },
        { tag: 'dabbah', categoryId: 'household', usageCount: 1, lastUsedAt: today, source: 'split' },
      ],
    };
    const result = computeSuggestions({ merchant: 'dabbah', items, memory });
    const groceries = result.find((s) => s.categoryId === 'groceries')!;
    const household = result.find((s) => s.categoryId === 'household')!;
    expect(groceries.reasons.some((r) => r.kind === 'tag_history')).toBe(true);
    expect(household.reasons.some((r) => r.kind === 'tag_history')).toBe(true);
    // Higher usageCount → higher score
    expect(groceries.score).toBeGreaterThan(household.score);
  });

  it('tagHistory does not fire when merchant does not match tag', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'dabbah', categoryId: 'groceries', usageCount: 3, lastUsedAt: today, source: 'split' },
      ],
    };
    const result = computeSuggestions({ merchant: 'shufersal', items, memory });
    const groceries = result.find((s) => s.categoryId === 'groceries')!;
    expect(groceries.reasons.every((r) => r.kind !== 'tag_history')).toBe(true);
  });

  it('freshness decay: stale tagHistory contributes less than fresh', () => {
    const staleDate = new Date(Date.now() - 80 * 86_400_000).toISOString().slice(0, 10);
    const memoryFresh: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'shop', categoryId: 'groceries', usageCount: 3, lastUsedAt: today, source: 'split' },
      ],
    };
    const memoryStale: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'shop', categoryId: 'groceries', usageCount: 3, lastUsedAt: staleDate, source: 'split' },
      ],
    };
    const freshScore = computeSuggestions({ merchant: 'shop', items, memory: memoryFresh })
      .find((s) => s.categoryId === 'groceries')!.score;
    const staleScore = computeSuggestions({ merchant: 'shop', items, memory: memoryStale })
      .find((s) => s.categoryId === 'groceries')!.score;
    expect(freshScore).toBeGreaterThan(staleScore);
    // 80 days / 90 decayDays ≈ 11% contribution remaining
    expect(staleScore).toBeLessThan(freshScore * 0.2);
  });
});

// ── merchantHistory vs tagHistory priority ────────────────────────────────────

describe('merchantHistory vs tagHistory ranking priority', () => {
  it('merchantHistory outscores tagHistory for same category', () => {
    const memory: SuggestionMemoryState = {
      merchants: { shop: [{ categoryId: 'groceries', count: 3, lastUsed: today }] },
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'shop', categoryId: 'household', usageCount: 3, lastUsedAt: today, source: 'split' },
      ],
    };
    const result = computeSuggestions({ merchant: 'shop', items, memory });
    const groceries = result.find((s) => s.categoryId === 'groceries')!;
    const household = result.find((s) => s.categoryId === 'household')!;
    expect(groceries.score).toBeGreaterThan(household.score);
    expect(groceries.reasons.some((r) => r.kind === 'merchant_history')).toBe(true);
    expect(household.reasons.some((r) => r.kind === 'tag_history')).toBe(true);
  });

  it('display reason shows merchant_history as primary, not tag_history, when both fire', () => {
    const memory: SuggestionMemoryState = {
      merchants: { shop: [{ categoryId: 'groceries', count: 2, lastUsed: today }] },
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'shop', categoryId: 'groceries', usageCount: 2, lastUsedAt: today, source: 'split' },
      ],
    };
    const result = computeSuggestions({ merchant: 'shop', items, memory });
    const groceries = result.find((s) => s.categoryId === 'groceries')!;
    // First non-fallback reason should be merchant_history
    const primary = groceries.reasons.find((r) => r.kind !== 'fallback');
    expect(primary?.kind).toBe('merchant_history');
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('tagHistory determinism', () => {
  it('same inputs produce identical ranking output', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'dabbah', categoryId: 'groceries', usageCount: 2, lastUsedAt: today, source: 'split' },
        { tag: 'dabbah', categoryId: 'household', usageCount: 1, lastUsedAt: today, source: 'split' },
      ],
    };
    const a = computeSuggestions({ merchant: 'dabbah', items, memory });
    const b = computeSuggestions({ merchant: 'dabbah', items, memory });
    expect(a.map((s) => s.categoryId)).toEqual(b.map((s) => s.categoryId));
    expect(a.map((s) => s.score)).toEqual(b.map((s) => s.score));
  });
});
