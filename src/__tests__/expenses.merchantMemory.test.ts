import { describe, it, expect } from 'vitest';
import {
  normalizeMerchantKey,
  merchantTotalUses,
  hasEnoughHistory,
  getSuggestedContext,
  getTopMerchantCategories,
} from '@/features/expenses/engine/merchantMemory';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

const emptyMemory: SuggestionMemoryState = {
  merchants: {},
  recents: [],
  splitCombos: [],
  tagAssociations: [],
  merchantContextStats: {},
};

describe('normalizeMerchantKey', () => {
  it('lowercases and trims', () => { expect(normalizeMerchantKey('  Dabbah  ')).toBe('dabbah'); });
  it('handles empty string', () => { expect(normalizeMerchantKey('')).toBe(''); });
});

describe('merchantTotalUses', () => {
  it('returns 0 for unknown merchant', () => {
    expect(merchantTotalUses('dabbah', emptyMemory)).toBe(0);
  });
  it('sums all category counts for merchant', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchants: {
        dabbah: [
          { categoryId: 'groceries', count: 5, lastUsed: '2025-01-01' },
          { categoryId: 'household', count: 3, lastUsed: '2025-01-01' },
        ],
      },
    };
    expect(merchantTotalUses('dabbah', memory)).toBe(8);
    expect(merchantTotalUses('Dabbah', memory)).toBe(8); // normalizes
  });
});

describe('hasEnoughHistory', () => {
  it('returns false when no history', () => {
    expect(hasEnoughHistory('dabbah', emptyMemory)).toBe(false);
  });
  it('returns false when only 1 use', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchants: { dabbah: [{ categoryId: 'groceries', count: 1, lastUsed: '2025-01-01' }] },
    };
    expect(hasEnoughHistory('dabbah', memory)).toBe(false);
  });
  it('returns true at 2 uses', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchants: { dabbah: [{ categoryId: 'groceries', count: 2, lastUsed: '2025-01-01' }] },
    };
    expect(hasEnoughHistory('dabbah', memory)).toBe(true);
  });
});

describe('getSuggestedContext', () => {
  it('returns null when no context stats', () => {
    expect(getSuggestedContext('dabbah', emptyMemory)).toBeNull();
  });
  it('returns null when below threshold', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchantContextStats: { dabbah: { food: 1 } },
    };
    expect(getSuggestedContext('dabbah', memory)).toBeNull();
  });
  it('returns top context when sufficient history', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchantContextStats: { dabbah: { food: 4, home: 1 } },
    };
    const result = getSuggestedContext('dabbah', memory);
    expect(result).not.toBeNull();
    expect(result!.folderId).toBe('food');
    expect(result!.count).toBe(4);
  });
  it('confidence saturates at CONFIDENT_AT uses', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchantContextStats: { dabbah: { food: 10 } },
    };
    expect(getSuggestedContext('dabbah', memory)!.confidence).toBe(1);
  });
  it('normalizes merchant key', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchantContextStats: { dabbah: { food: 3 } },
    };
    expect(getSuggestedContext('Dabbah', memory)?.folderId).toBe('food');
  });
});

describe('getTopMerchantCategories', () => {
  const cats = [
    { id: 'groceries', name: 'Groceries', icon: 'cart', color: '#abc', folderId: 'food', isPrivate: false, order: 0, type: 'expense' as const },
    { id: 'household', name: 'Household', icon: 'house', color: '#def', folderId: 'home', isPrivate: false, order: 1, type: 'expense' as const },
    { id: 'alcohol', name: 'Alcohol', icon: 'beer', color: '#ghi', folderId: 'food', isPrivate: false, order: 2, type: 'expense' as const },
  ];

  it('returns empty when no merchant history', () => {
    expect(getTopMerchantCategories('dabbah', emptyMemory, cats)).toHaveLength(0);
  });

  it('returns categories sorted by usage count', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchants: {
        dabbah: [
          { categoryId: 'alcohol', count: 3, lastUsed: '2025-01-01' },
          { categoryId: 'groceries', count: 10, lastUsed: '2025-01-01' },
          { categoryId: 'household', count: 5, lastUsed: '2025-01-01' },
        ],
      },
    };
    const result = getTopMerchantCategories('dabbah', memory, cats);
    expect(result.map((c) => c.id)).toEqual(['groceries', 'household', 'alcohol']);
  });

  it('respects topN limit', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchants: {
        dabbah: [
          { categoryId: 'groceries', count: 10, lastUsed: '2025-01-01' },
          { categoryId: 'household', count: 5, lastUsed: '2025-01-01' },
          { categoryId: 'alcohol', count: 3, lastUsed: '2025-01-01' },
        ],
      },
    };
    expect(getTopMerchantCategories('dabbah', memory, cats, 2)).toHaveLength(2);
  });

  it('skips categories not in provided list', () => {
    const memory: SuggestionMemoryState = {
      ...emptyMemory,
      merchants: {
        dabbah: [{ categoryId: 'deleted-cat', count: 10, lastUsed: '2025-01-01' }],
      },
    };
    expect(getTopMerchantCategories('dabbah', memory, cats)).toHaveLength(0);
  });
});
