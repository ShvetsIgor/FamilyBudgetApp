/**
 * A supermarket receipt is habitually split. For such a merchant, offering
 * single-category chips is worse than offering nothing: tapping one files the
 * whole amount under it. These helpers detect the habit from usage counts.
 */
import { describe, it, expect } from 'vitest';
import {
  merchantSplitUses, merchantSplitShare, prefersSplit,
} from '@/features/expenses/engine/merchantMemory';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

const memory = (
  merchantCounts: Record<string, number>,
  splits: { merchantKey: string; count: number }[] = [],
): SuggestionMemoryState => ({
  merchants: {
    osher: Object.entries(merchantCounts).map(([categoryId, count]) => ({
      categoryId, count, lastUsed: '2026-07-27',
    })),
  },
  recents: [],
  splitCombos: splits.map((s, i) => ({
    key: `${s.merchantKey}|combo${i}`,
    merchantKey: s.merchantKey,
    categoryIds: ['groceries', 'household'],
    count: s.count,
    lastUsed: '2026-07-27',
  })),
  tagAssociations: [],
});

describe('merchantSplitUses', () => {
  it('sums combo counts for the merchant only', () => {
    const m = memory({ groceries: 4 }, [
      { merchantKey: 'osher', count: 3 },
      { merchantKey: 'shufersal', count: 9 },
    ]);
    expect(merchantSplitUses('Osher', m)).toBe(3);
  });

  it('is zero for a merchant that was never split', () => {
    expect(merchantSplitUses('osher', memory({ groceries: 2 }))).toBe(0);
  });
});

describe('merchantSplitShare', () => {
  it('is the split fraction of all saves', () => {
    const m = memory({ groceries: 4 }, [{ merchantKey: 'osher', count: 3 }]);
    expect(merchantSplitShare('osher', m)).toBeCloseTo(0.75);
  });

  it('is 0 with no history at all, without dividing by zero', () => {
    expect(merchantSplitShare('unknown', memory({}))).toBe(0);
  });

  it('never exceeds 1 even if combo counts outpace merchant counts', () => {
    const m = memory({ groceries: 1 }, [{ merchantKey: 'osher', count: 5 }]);
    expect(merchantSplitShare('osher', m)).toBe(1);
  });
});

describe('prefersSplit', () => {
  it('is true for a habitually split merchant, case-insensitively', () => {
    const m = memory({ groceries: 4 }, [{ merchantKey: 'osher', count: 3 }]);
    expect(prefersSplit('osher', m)).toBe(true);
    expect(prefersSplit('  Osher ', m)).toBe(true);
  });

  it('is false when most saves were a single category', () => {
    const m = memory({ groceries: 5 }, [{ merchantKey: 'osher', count: 1 }]);
    expect(prefersSplit('osher', m)).toBe(false);
  });

  it('stays false until the merchant has enough history to judge', () => {
    // One save, and it was a split — not enough to call it a habit yet
    const m = memory({ groceries: 1 }, [{ merchantKey: 'osher', count: 1 }]);
    expect(prefersSplit('osher', m)).toBe(false);
  });

  it('is false for an unknown merchant', () => {
    expect(prefersSplit('newplace', memory({ groceries: 4 }))).toBe(false);
  });
});
