import { describe, it, expect } from 'vitest';
import {
  findMatchingSplitCombos,
  rankSplitCombos,
  buildSplitPresets,
  splitComboConfidence,
  hasSplitPresets,
  topSplitPreset,
} from '../features/expenses/engine/splitMemoryEngine';
import {
  initialQuickAddState,
  applyContextToQuickAdd,
  confirmSuggestion,
  confirmSplitPreset,
  resetQuickAdd,
  markParsing,
  isReadyToSave,
  hasSuggestions,
  isSplitPending,
} from '../features/expenses/types/quickAddState';
import { parseInput } from '../features/expenses/engine/inputPipeline';
import type { SuggestionMemoryState, SplitComboEntry } from '../features/expenses/store/suggestionMemorySlice';
import type { Category } from '../shared/types';
import type { ExpenseContext } from '../features/expenses/types/expenseContext';

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

/** Build a minimal ExpenseContext for testing quickAddState transitions. */
function makeTestContext(amount: number | null, categoryIds: string[] = ['groceries', 'home']): ExpenseContext {
  const input = amount !== null ? `coffee ${amount}` : 'coffee';
  const parserContext = parseInput(input);
  return {
    rawInput: input,
    amount,
    merchant: 'coffee',
    merchantKey: 'coffee',
    tokens: [],
    candidateCategories: categoryIds.map((id, i) => ({ categoryId: id, score: 0.8 - i * 0.1, reasons: [] })),
    confidence: { amount: amount !== null ? 0.95 : 0, merchant: 0.3, category: 0.5, overall: 0.5 },
    signals: [],
    parserContext,
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

// ── quickAddState ─────────────────────────────────────────────────────────────

describe('quickAddState', () => {
  const ctx = makeTestContext(45);

  describe('initialQuickAddState', () => {
    it('returns idle state with empty fields', () => {
      const state = initialQuickAddState();
      expect(state.status).toBe('idle');
      expect(state.rawInput).toBe('');
      expect(state.context).toBeNull();
      expect(state.liveSuggestions).toEqual([]);
      expect(state.splitPresets).toEqual([]);
      expect(state.pendingConfirmation).toBeNull();
    });
  });

  describe('markParsing', () => {
    it('sets status to parsing', () => {
      const state = markParsing(initialQuickAddState(), 'coffee');
      expect(state.status).toBe('parsing');
      expect(state.rawInput).toBe('coffee');
    });
  });

  describe('applyContextToQuickAdd', () => {
    it('sets status to suggesting when context has suggestions', () => {
      const state = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      expect(['suggesting', 'split_pending']).toContain(state.status);
    });

    it('attaches context to state', () => {
      const state = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      expect(state.context).toBe(ctx);
    });

    it('sets liveSuggestions from context candidates', () => {
      const state = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      expect(state.liveSuggestions.length).toBe(ctx.candidateCategories.length);
    });

    it('sets split_pending when presets provided and split hint active', () => {
      const largeCtx = makeTestContext(1500);
      const presets = [{ id: 'p1', categoryIds: ['groceries', 'home'], categoryNames: ['Groceries', 'Home'], count: 3, lastUsed: '', confidence: 0.6 }];
      const state = applyContextToQuickAdd(initialQuickAddState(), largeCtx, presets, NOW);
      expect(['suggesting', 'split_pending']).toContain(state.status);
    });
  });

  describe('confirmSuggestion', () => {
    it('sets status to confirmed', () => {
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      const s1 = confirmSuggestion(s0, 'health');
      expect(s1.status).toBe('confirmed');
    });

    it('sets pendingConfirmation with correct fields', () => {
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      const s1 = confirmSuggestion(s0, 'health');
      expect(s1.pendingConfirmation?.categoryId).toBe('health');
      expect(s1.pendingConfirmation?.amount).toBe(45);
    });

    it('no-ops when no context', () => {
      const s0 = initialQuickAddState();
      const s1 = confirmSuggestion(s0, 'health');
      expect(s1.status).toBe('idle');
    });

    it('no-ops when no amount in context', () => {
      const noAmountCtx = makeTestContext(null);
      const s0 = applyContextToQuickAdd(initialQuickAddState(), noAmountCtx, [], NOW);
      const s1 = confirmSuggestion(s0, 'health');
      expect(s1.pendingConfirmation).toBeNull();
    });
  });

  describe('confirmSplitPreset', () => {
    const preset = {
      id: 'p1', categoryIds: ['groceries', 'home'],
      categoryNames: ['Groceries', 'Home'],
      count: 3, lastUsed: '', confidence: 0.6,
    };

    it('sets confirmed status', () => {
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [preset], NOW);
      const s1 = confirmSplitPreset(s0, preset);
      expect(s1.status).toBe('confirmed');
    });

    it('sets splitCategoryIds on pending confirmation', () => {
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [preset], NOW);
      const s1 = confirmSplitPreset(s0, preset);
      expect(s1.pendingConfirmation?.splitCategoryIds).toEqual(['groceries', 'home']);
    });

    it('sets splitPresetId', () => {
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [preset], NOW);
      const s1 = confirmSplitPreset(s0, preset);
      expect(s1.pendingConfirmation?.splitPresetId).toBe('p1');
    });
  });

  describe('resetQuickAdd', () => {
    it('returns idle initial state', () => {
      resetQuickAdd();
      const s1 = resetQuickAdd();
      expect(s1).toEqual(initialQuickAddState());
    });
  });

  describe('query helpers', () => {
    it('isReadyToSave: true when confirmed + pendingConfirmation set', () => {
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      const s1 = confirmSuggestion(s0, 'health');
      expect(isReadyToSave(s1)).toBe(true);
    });

    it('isReadyToSave: false when idle', () => {
      expect(isReadyToSave(initialQuickAddState())).toBe(false);
    });

    it('hasSuggestions: returns boolean', () => {
      const state = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      expect(typeof hasSuggestions(state)).toBe('boolean');
    });

    it('isSplitPending: false when suggesting', () => {
      const state = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      if (state.status === 'suggesting') {
        expect(isSplitPending(state)).toBe(false);
      }
    });
  });

  describe('immutability', () => {
    it('applyContextToQuickAdd does not mutate input state', () => {
      const s0 = initialQuickAddState();
      const frozen = { ...s0 };
      applyContextToQuickAdd(s0, ctx, [], NOW);
      expect(s0.status).toBe(frozen.status);
      expect(s0.context).toBe(frozen.context);
    });

    it('confirmSuggestion does not mutate input state', () => {
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      const status = s0.status;
      confirmSuggestion(s0, 'health');
      expect(s0.status).toBe(status);
    });
  });
});
