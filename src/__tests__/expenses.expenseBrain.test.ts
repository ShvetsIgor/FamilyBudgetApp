import { describe, it, expect } from 'vitest';
import {
  findMatchingSplitCombos,
  rankSplitCombos,
  buildSplitPresets,
  splitComboConfidence,
  hasSplitPresets,
  topSplitPreset,
} from '../features/expenses/engine/splitMemoryEngine';
import type { SuggestionMemoryState, SplitComboEntry } from '../features/expenses/store/suggestionMemorySlice';
import type { Category } from '../shared/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EMPTY_MEMORY: SuggestionMemoryState = {
  merchants: {},
  recents: [],
  splitCombos: [],
  tagAssociations: [],
};

const NOW = new Date('2026-05-24T12:00:00Z').getTime();

function makeCat(id: string, name: string): Category {
  return {
    id, userId: 'u1', name, icon: 'tag', color: '#aaa',
    isPrivate: false, order: 0, type: 'expense',
  };
}

const CATS: Category[] = [
  makeCat('groceries', 'Groceries'),
  makeCat('home', 'Home'),
  makeCat('health', 'Health'),
  makeCat('transport', 'Transport'),
  makeCat('electronics', 'Electronics'),
];

function makeMemoryWithCombos(combos: SplitComboEntry[]): SuggestionMemoryState {
  return { ...EMPTY_MEMORY, splitCombos: combos };
}

function makeCombo(merchantKey: string, categoryIds: string[], count: number, daysAgo = 1): SplitComboEntry {
  return {
    key: `${merchantKey}|${[...categoryIds].sort().join(',')}`,
    merchantKey,
    categoryIds,
    count,
    lastUsed: new Date(NOW - daysAgo * 86_400_000).toISOString(),
  };
}

// ── splitMemoryEngine ─────────────────────────────────────────────────────────

describe('splitMemoryEngine', () => {
  const combo1 = makeCombo('dabbah', ['groceries', 'home'], 5, 1);
  const combo2 = makeCombo('dabbah', ['groceries', 'tools'], 2, 7);
  const combo3 = makeCombo('dabbah', ['electronics'], 3, 3);
  const comboOther = makeCombo('ramilevi', ['groceries'], 4, 2);

  describe('findMatchingSplitCombos', () => {
    it('returns combos for the given merchant key', () => {
      const mem = makeMemoryWithCombos([combo1, combo2, comboOther]);
      const result = findMatchingSplitCombos('dabbah', mem);
      expect(result).toHaveLength(2);
    });

    it('returns empty for unknown merchant', () => {
      const mem = makeMemoryWithCombos([combo1]);
      expect(findMatchingSplitCombos('unknown', mem)).toEqual([]);
    });

    it('normalizes merchantKey for lookup', () => {
      const mem = makeMemoryWithCombos([combo1]);
      expect(findMatchingSplitCombos('DABBAH', mem)).toHaveLength(1);
    });

    it('returns empty when memory has no combos', () => {
      expect(findMatchingSplitCombos('dabbah', EMPTY_MEMORY)).toEqual([]);
    });
  });

  describe('rankSplitCombos', () => {
    it('sorts by count descending', () => {
      const ranked = rankSplitCombos([combo2, combo1], NOW);
      expect(ranked[0].count).toBeGreaterThanOrEqual(ranked[1].count);
    });

    it('tie-breaks by recency', () => {
      const recent = makeCombo('dabbah', ['a', 'b'], 3, 1);
      const older  = makeCombo('dabbah', ['c', 'd'], 3, 30);
      const ranked = rankSplitCombos([older, recent], NOW);
      expect(ranked[0]).toBe(recent);
    });

    it('does not mutate input array', () => {
      const input = [combo2, combo1];
      const ranked = rankSplitCombos(input, NOW);
      expect(input[0]).toBe(combo2);
      expect(ranked).not.toBe(input);
    });

    it('is deterministic', () => {
      const r1 = rankSplitCombos([combo1, combo2, combo3], NOW);
      const r2 = rankSplitCombos([combo1, combo2, combo3], NOW);
      expect(r1.map((c) => c.key)).toEqual(r2.map((c) => c.key));
    });
  });

  describe('splitComboConfidence', () => {
    it('saturates at 1.0 for high count', () => {
      const c = makeCombo('m', ['a'], 10);
      expect(splitComboConfidence(c)).toBe(1);
    });

    it('scales linearly below saturation', () => {
      const c1 = makeCombo('m', ['a'], 1);
      const c2 = makeCombo('m', ['a'], 3);
      expect(splitComboConfidence(c1)).toBeLessThan(splitComboConfidence(c2));
    });
  });

  describe('buildSplitPresets', () => {
    const mem = makeMemoryWithCombos([combo1, combo2, combo3, comboOther]);

    it('returns presets for merchant', () => {
      const presets = buildSplitPresets('dabbah', mem, CATS, 3, NOW);
      expect(presets.length).toBeGreaterThan(0);
    });

    it('respects topN', () => {
      const presets = buildSplitPresets('dabbah', mem, CATS, 2, NOW);
      expect(presets.length).toBeLessThanOrEqual(2);
    });

    it('resolves category names', () => {
      const presets = buildSplitPresets('dabbah', mem, CATS, 3, NOW);
      for (const preset of presets) {
        expect(preset.categoryNames.length).toBeGreaterThan(0);
      }
    });

    it('ranked by count descending', () => {
      const presets = buildSplitPresets('dabbah', mem, CATS, 3, NOW);
      for (let i = 1; i < presets.length; i++) {
        expect(presets[i - 1].count).toBeGreaterThanOrEqual(presets[i].count);
      }
    });

    it('returns empty for unknown merchant', () => {
      expect(buildSplitPresets('unknown', mem, CATS, 3, NOW)).toEqual([]);
    });

    it('each preset has id, categoryIds, confidence', () => {
      const presets = buildSplitPresets('dabbah', mem, CATS, 3, NOW);
      for (const p of presets) {
        expect(typeof p.id).toBe('string');
        expect(Array.isArray(p.categoryIds)).toBe(true);
        expect(p.confidence).toBeGreaterThanOrEqual(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('hasSplitPresets', () => {
    it('true when combos exist for merchant', () => {
      const mem = makeMemoryWithCombos([combo1]);
      expect(hasSplitPresets('dabbah', mem)).toBe(true);
    });

    it('false when no combos', () => {
      expect(hasSplitPresets('dabbah', EMPTY_MEMORY)).toBe(false);
    });
  });

  describe('topSplitPreset', () => {
    it('returns the highest-ranked preset', () => {
      const mem = makeMemoryWithCombos([combo2, combo1]); // combo1 has count=5
      const top = topSplitPreset('dabbah', mem, CATS, NOW);
      expect(top?.count).toBe(5);
    });

    it('returns undefined when no combos', () => {
      expect(topSplitPreset('unknown', EMPTY_MEMORY, CATS, NOW)).toBeUndefined();
    });
  });
});
