import { describe, it, expect } from 'vitest';
import {
  getRecentMerchants,
  getTopCategoriesForMerchant,
  getRecentCategories,
  getTopCategories,
  hasUsageContext,
} from '@/features/expenses/engine/recentContextEngine';
import { shortExplainSuggestion } from '@/features/expenses/engine/suggestionEngine';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';
import type { ScoredSuggestion } from '@/features/expenses/engine/suggestionEngine';

const emptyMemory: SuggestionMemoryState = { merchants: {}, recents: [], splitCombos: [] };

const now = new Date().toISOString();
const yesterday = new Date(Date.now() - 86_400_000).toISOString();
const oldDate = new Date(Date.now() - 10 * 86_400_000).toISOString();

const richMemory: SuggestionMemoryState = {
  merchants: {
    dabbah: [
      { categoryId: 'groceries', count: 8, lastUsed: now },
      { categoryId: 'household', count: 3, lastUsed: yesterday },
    ],
    superpharm: [
      { categoryId: 'health', count: 5, lastUsed: yesterday },
    ],
    oldstore: [
      { categoryId: 'food', count: 2, lastUsed: oldDate },
    ],
  },
  recents: [
    { categoryId: 'groceries', count: 10, lastUsed: now },
    { categoryId: 'health', count: 5, lastUsed: yesterday },
    { categoryId: 'transport', count: 3, lastUsed: oldDate },
  ],
  splitCombos: [],
};

// ── getRecentMerchants ────────────────────────────────────────────────────────

describe('getRecentMerchants', () => {
  it('returns empty for empty memory', () => {
    expect(getRecentMerchants(emptyMemory)).toEqual([]);
  });

  it('returns merchants sorted by lastUsed descending', () => {
    const result = getRecentMerchants(richMemory);
    expect(result[0].key).toBe('dabbah');
    expect(result[1].key).toBe('superpharm');
  });

  it('respects limit', () => {
    expect(getRecentMerchants(richMemory, 1)).toHaveLength(1);
    expect(getRecentMerchants(richMemory, 2)).toHaveLength(2);
  });

  it('topCategoryId reflects highest count category for merchant', () => {
    const result = getRecentMerchants(richMemory);
    const dabbah = result.find((m) => m.key === 'dabbah');
    expect(dabbah?.topCategoryId).toBe('groceries'); // count: 8 > 3
  });

  it('totalCount sums all category usages for merchant', () => {
    const result = getRecentMerchants(richMemory);
    const dabbah = result.find((m) => m.key === 'dabbah');
    expect(dabbah?.totalCount).toBe(11); // 8 + 3
  });
});

// ── getTopCategoriesForMerchant ───────────────────────────────────────────────

describe('getTopCategoriesForMerchant', () => {
  it('returns top categories by count for known merchant', () => {
    const result = getTopCategoriesForMerchant('Dabbah', richMemory, 3);
    expect(result[0]).toBe('groceries'); // count: 8
    expect(result[1]).toBe('household'); // count: 3
  });

  it('is case-insensitive', () => {
    const lower = getTopCategoriesForMerchant('dabbah', richMemory);
    const upper = getTopCategoriesForMerchant('DABBAH', richMemory);
    expect(lower).toEqual(upper);
  });

  it('returns empty for unknown merchant', () => {
    expect(getTopCategoriesForMerchant('unknown', richMemory)).toEqual([]);
  });

  it('respects limit', () => {
    expect(getTopCategoriesForMerchant('dabbah', richMemory, 1)).toHaveLength(1);
  });
});

// ── getRecentCategories ───────────────────────────────────────────────────────

describe('getRecentCategories', () => {
  it('returns empty for empty memory', () => {
    expect(getRecentCategories(emptyMemory)).toEqual([]);
  });

  it('returns entries sorted by lastUsed', () => {
    const result = getRecentCategories(richMemory);
    expect(result[0].categoryId).toBe('groceries');
    expect(result[1].categoryId).toBe('health');
  });

  it('includes daysSinceLastUsed', () => {
    const result = getRecentCategories(richMemory);
    expect(result[0].daysSinceLastUsed).toBe(0); // today
    expect(result[1].daysSinceLastUsed).toBe(1); // yesterday
  });

  it('respects limit', () => {
    expect(getRecentCategories(richMemory, 2)).toHaveLength(2);
  });
});

// ── getTopCategories ──────────────────────────────────────────────────────────

describe('getTopCategories', () => {
  it('returns category IDs sorted by count', () => {
    const result = getTopCategories(richMemory, 3);
    expect(result[0]).toBe('groceries'); // count: 10
    expect(result[1]).toBe('health');    // count: 5
  });
});

// ── hasUsageContext ───────────────────────────────────────────────────────────

describe('hasUsageContext', () => {
  it('returns false for empty memory', () => {
    expect(hasUsageContext(emptyMemory)).toBe(false);
  });

  it('returns true when recents exist', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [{ categoryId: 'food', count: 1, lastUsed: now }],
      splitCombos: [],
    };
    expect(hasUsageContext(memory)).toBe(true);
  });

  it('returns true when merchants exist', () => {
    const memory: SuggestionMemoryState = {
      merchants: { store: [{ categoryId: 'food', count: 1, lastUsed: now }] },
      recents: [],
      splitCombos: [],
    };
    expect(hasUsageContext(memory)).toBe(true);
  });
});

// ── shortExplainSuggestion ────────────────────────────────────────────────────

describe('shortExplainSuggestion', () => {
  it('returns count for merchant history', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 50,
      reasons: [{ kind: 'merchant_history', count: 5 }],
    };
    expect(shortExplainSuggestion(s)).toBe('5×');
  });

  it('returns "сегодня" for daysSince=0', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 20,
      reasons: [{ kind: 'recent_usage', daysSince: 0 }],
    };
    expect(shortExplainSuggestion(s)).toBe('сегодня');
  });

  it('returns "Nd" for N days ago', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 15,
      reasons: [{ kind: 'recent_usage', daysSince: 3 }],
    };
    expect(shortExplainSuggestion(s)).toBe('3д');
  });

  it('returns "название" for name match', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 10,
      reasons: [{ kind: 'name_match' }],
    };
    expect(shortExplainSuggestion(s)).toBe('название');
  });

  it('returns empty string for fallback', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 0,
      reasons: [{ kind: 'fallback' }],
    };
    expect(shortExplainSuggestion(s)).toBe('');
  });

  it('uses first non-fallback reason when multiple reasons exist', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 60,
      reasons: [
        { kind: 'merchant_history', count: 5 },
        { kind: 'recent_usage', daysSince: 1 },
      ],
    };
    expect(shortExplainSuggestion(s)).toBe('5×');
  });
});
