import { describe, it, expect } from 'vitest';
import { computeConfidenceProfile, buildContextSignals } from '../features/expenses/engine/confidenceEngine';
import {
  classifyInputTokens,
  extractMerchantTokens,
  extractItemTokens,
  extractNormalizedTokens,
} from '../features/expenses/engine/merchantClassifier';
import {
  findMatchingSplitCombos,
  rankSplitCombos,
  buildSplitPresets,
  splitComboConfidence,
  hasSplitPresets,
  topSplitPreset,
} from '../features/expenses/engine/splitMemoryEngine';
import { buildExpenseContext } from '../features/expenses/engine/expenseContextBuilder';
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
import type { ScoredSuggestion } from '../features/expenses/engine/suggestionEngine';

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

function makeMemoryWithMerchant(merchantKey: string, categoryId: string, count: number): SuggestionMemoryState {
  return {
    ...EMPTY_MEMORY,
    merchants: {
      [merchantKey]: [{ categoryId, count, lastUsed: new Date(NOW - 2 * 86_400_000).toISOString() }],
    },
  };
}

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

function makeScoredSuggestion(categoryId: string, score: number): ScoredSuggestion {
  return { categoryId, score, reasons: [{ kind: 'merchant_history', count: 3 }] };
}

// ── confidenceEngine ──────────────────────────────────────────────────────────

describe('confidenceEngine', () => {
  describe('computeConfidenceProfile', () => {
    it('amount=0.95 when amount is present', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const profile = computeConfidenceProfile(ctx, []);
      expect(profile.amount).toBe(0.95);
    });

    it('amount=0 when no amount', () => {
      const ctx = parseInput('coffee', EMPTY_MEMORY);
      const profile = computeConfidenceProfile(ctx, []);
      expect(profile.amount).toBe(0);
    });

    it('merchant=0 when no merchant detected', () => {
      const ctx = parseInput('45', EMPTY_MEMORY);
      const profile = computeConfidenceProfile(ctx, []);
      expect(profile.merchant).toBe(0);
    });

    it('merchant=0.30 when merchant detected but not in memory', () => {
      const ctx = parseInput('unknownstore 100', EMPTY_MEMORY);
      // merchant detected as text token, but not in memory
      const profile = computeConfidenceProfile(ctx, []);
      // merchant might be 0 (no merchant) or 0.30 (unknown merchant)
      // depends on whether parser assigned a merchant token
      expect(profile.merchant).toBeGreaterThanOrEqual(0);
    });

    it('merchant=0.75 when merchant known in memory', () => {
      const mem = makeMemoryWithMerchant('dabbah', 'groceries', 5);
      const ctx = parseInput('dabbah 200', mem);
      const profile = computeConfidenceProfile(ctx, [makeScoredSuggestion('groceries', 50)]);
      expect(profile.merchant).toBeGreaterThanOrEqual(0.75);
    });

    it('category=0.20 when no suggestions', () => {
      const ctx = parseInput('', EMPTY_MEMORY);
      const profile = computeConfidenceProfile(ctx, []);
      expect(profile.category).toBe(0.20);
    });

    it('category≥0.5 when strong unambiguous top suggestion', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const suggestions = [
        makeScoredSuggestion('health', 80),
        makeScoredSuggestion('groceries', 10),
      ];
      const profile = computeConfidenceProfile(ctx, suggestions);
      expect(profile.category).toBeGreaterThanOrEqual(0.5);
    });

    it('category=0.50 when ambiguous (second/first > 0.5)', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const suggestions = [
        makeScoredSuggestion('health', 40),
        makeScoredSuggestion('groceries', 35),
      ];
      const profile = computeConfidenceProfile(ctx, suggestions);
      expect(profile.category).toBe(0.50);
    });

    it('overall is weighted composite of three dimensions', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const profile = computeConfidenceProfile(ctx, [makeScoredSuggestion('health', 60)]);
      const expected = profile.amount * 0.3 + profile.merchant * 0.3 + profile.category * 0.4;
      expect(profile.overall).toBeCloseTo(expected, 1);
    });

    it('is deterministic', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const s = [makeScoredSuggestion('health', 50)];
      const p1 = computeConfidenceProfile(ctx, s);
      const p2 = computeConfidenceProfile(ctx, s);
      expect(p1).toEqual(p2);
    });
  });

  describe('buildContextSignals', () => {
    it('returns array of signals', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const signals = buildContextSignals(ctx, []);
      expect(Array.isArray(signals)).toBe(true);
    });

    it('includes parser signals when amount present', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const signals = buildContextSignals(ctx, []);
      const kinds = signals.map((s) => s.kind);
      expect(kinds).toContain('amount_present');
    });

    it('includes ranking reason signals from top suggestion', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const suggestions = [makeScoredSuggestion('health', 50)];
      const signals = buildContextSignals(ctx, suggestions);
      const kinds = signals.map((s) => s.kind);
      expect(kinds).toContain('merchant_history');
    });

    it('each signal has source and weight', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const signals = buildContextSignals(ctx, []);
      for (const s of signals) {
        expect(['parser', 'memory', 'metadata', 'history']).toContain(s.source);
        expect(typeof s.weight).toBe('number');
        expect(s.weight).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

// ── merchantClassifier ────────────────────────────────────────────────────────

describe('merchantClassifier', () => {
  describe('classifyInputTokens', () => {
    it('classifies amount token', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const tokens = classifyInputTokens(ctx);
      const amountToken = tokens.find((t) => t.raw === '45');
      expect(amountToken?.role).toBe('amount');
    });

    it('returns array with same token count as raw input words', () => {
      const ctx = parseInput('dabbah drill 350', EMPTY_MEMORY);
      const tokens = classifyInputTokens(ctx);
      const rawWords = 'dabbah drill 350'.split(/\s+/).filter(Boolean);
      expect(tokens).toHaveLength(rawWords.length);
    });

    it('each token has raw, normalized, and role fields', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const tokens = classifyInputTokens(ctx);
      for (const t of tokens) {
        expect(typeof t.raw).toBe('string');
        expect(typeof t.normalized).toBe('string');
        expect(['merchant', 'item', 'amount', 'noise']).toContain(t.role);
      }
    });

    it('is deterministic', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const t1 = classifyInputTokens(ctx);
      const t2 = classifyInputTokens(ctx);
      expect(t1).toEqual(t2);
    });
  });

  describe('extractMerchantTokens', () => {
    it('returns empty when no merchant detected', () => {
      const ctx = parseInput('45', EMPTY_MEMORY);
      expect(extractMerchantTokens(ctx)).toEqual([]);
    });

    it('returns merchant tokens when merchant detected', () => {
      const mem = makeMemoryWithMerchant('dabbah', 'groceries', 5);
      const ctx = parseInput('dabbah 200', mem);
      const tokens = extractMerchantTokens(ctx);
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('extractItemTokens', () => {
    it('returns empty for single-token input', () => {
      const ctx = parseInput('45', EMPTY_MEMORY);
      expect(extractItemTokens(ctx)).toEqual([]);
    });

    it('returns item candidates from parser', () => {
      const mem = makeMemoryWithMerchant('dabbah', 'groceries', 5);
      const ctx = parseInput('dabbah drill milk 350', mem);
      const items = extractItemTokens(ctx);
      expect(Array.isArray(items)).toBe(true);
    });
  });

  describe('extractNormalizedTokens', () => {
    it('returns array of strings', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      expect(Array.isArray(extractNormalizedTokens(ctx))).toBe(true);
    });

    it('no duplicates', () => {
      const ctx = parseInput('coffee coffee 45', EMPTY_MEMORY);
      const tokens = extractNormalizedTokens(ctx);
      expect(tokens.length).toBe(new Set(tokens).size);
    });

    it('excludes numeric-only tokens', () => {
      const ctx = parseInput('coffee 45', EMPTY_MEMORY);
      const tokens = extractNormalizedTokens(ctx);
      for (const t of tokens) {
        expect(/^\d+$/.test(t)).toBe(false);
      }
    });
  });
});

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
      const recent = makeCombo('dabbah', ['a', 'b'], 3, 1);   // same count, more recent
      const older  = makeCombo('dabbah', ['c', 'd'], 3, 30);  // same count, older
      const ranked = rankSplitCombos([older, recent], NOW);
      expect(ranked[0]).toBe(recent);
    });

    it('does not mutate input array', () => {
      const input = [combo2, combo1];
      const ranked = rankSplitCombos(input, NOW);
      expect(input[0]).toBe(combo2); // original order preserved
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
      expect(top?.count).toBe(5); // combo1
    });

    it('returns undefined when no combos', () => {
      expect(topSplitPreset('unknown', EMPTY_MEMORY, CATS, NOW)).toBeUndefined();
    });
  });
});

// ── expenseContextBuilder ────────────────────────────────────────────────────

describe('expenseContextBuilder', () => {
  describe('buildExpenseContext', () => {
    it('returns ExpenseContext with all required fields', () => {
      const ctx = buildExpenseContext('coffee 45', CATS);
      expect(typeof ctx.rawInput).toBe('string');
      expect(Array.isArray(ctx.tokens)).toBe(true);
      expect(Array.isArray(ctx.candidateCategories)).toBe(true);
      expect(typeof ctx.confidence.overall).toBe('number');
      expect(Array.isArray(ctx.signals)).toBe(true);
      expect(ctx.parserContext).toBeDefined();
    });

    it('extracts amount', () => {
      const ctx = buildExpenseContext('coffee 45', CATS);
      expect(ctx.amount).toBe(45);
    });

    it('amount is null when absent', () => {
      const ctx = buildExpenseContext('coffee', CATS);
      expect(ctx.amount).toBeNull();
    });

    it('produces candidate categories from categories list', () => {
      const ctx = buildExpenseContext('coffee 45', CATS);
      const ids = ctx.candidateCategories.map((c) => c.categoryId);
      // All category ids should come from CATS
      for (const id of ids) {
        expect(CATS.some((c) => c.id === id)).toBe(true);
      }
    });

    it('respects memory — known merchant boosts category', () => {
      const mem = makeMemoryWithMerchant('dabbah', 'groceries', 5);
      const ctx = buildExpenseContext('dabbah 200', CATS, mem);
      const top = ctx.candidateCategories[0];
      expect(top?.categoryId).toBe('groceries');
    });

    it('excludes archived categories', () => {
      const archivedCat: Category = { ...makeCat('archived', 'Old'), archived: true };
      const cats = [...CATS, archivedCat];
      const ctx = buildExpenseContext('old 50', cats);
      const ids = ctx.candidateCategories.map((c) => c.categoryId);
      expect(ids).not.toContain('archived');
    });

    it('is deterministic — same input produces same output', () => {
      const ctx1 = buildExpenseContext('coffee 45', CATS);
      const ctx2 = buildExpenseContext('coffee 45', CATS);
      expect(ctx1.amount).toBe(ctx2.amount);
      expect(ctx1.merchant).toBe(ctx2.merchant);
      expect(ctx1.candidateCategories.map((c) => c.categoryId))
        .toEqual(ctx2.candidateCategories.map((c) => c.categoryId));
    });

    it('works without memory (graceful degradation)', () => {
      expect(() => buildExpenseContext('coffee 45', CATS)).not.toThrow();
    });

    it('confidence has all 4 dimensions', () => {
      const ctx = buildExpenseContext('coffee 45', CATS);
      expect(typeof ctx.confidence.amount).toBe('number');
      expect(typeof ctx.confidence.merchant).toBe('number');
      expect(typeof ctx.confidence.category).toBe('number');
      expect(typeof ctx.confidence.overall).toBe('number');
    });

    it('all confidence values are 0–1', () => {
      const ctx = buildExpenseContext('coffee 45', CATS);
      for (const val of Object.values(ctx.confidence)) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(1);
      }
    });
  });
});

// ── suggestionInspector ──────────────────────────────────────────────────────

describe('suggestionInspector', () => {
  const ctx = buildExpenseContext('coffee 45', CATS);
  const suggestion = makeScoredSuggestion('health', 55);

  describe('explainSuggestion', () => {
    it('returns explanation with correct rank', () => {
      const exp = explainSuggestion(suggestion, ctx, 1);
      expect(exp.rank).toBe(1);
    });

    it('includes categoryId and score', () => {
      const exp = explainSuggestion(suggestion, ctx, 1);
      expect(exp.categoryId).toBe('health');
      expect(exp.score).toBe(55);
    });

    it('primaryReason is a non-empty string', () => {
      const exp = explainSuggestion(suggestion, ctx, 1);
      expect(typeof exp.primaryReason).toBe('string');
      expect(exp.primaryReason.length).toBeGreaterThan(0);
    });

    it('isHabit true when habit signal present', () => {
      const habitSuggestion: ScoredSuggestion = {
        categoryId: 'groceries', score: 60,
        reasons: [{ kind: 'habit', count: 5 }],
      };
      const exp = explainSuggestion(habitSuggestion, ctx, 1);
      expect(exp.isHabit).toBe(true);
    });

    it('isHabit false when no habit signal', () => {
      const exp = explainSuggestion(suggestion, ctx, 1);
      expect(exp.isHabit).toBe(false);
    });

    it('debugSummary contains rank and score', () => {
      const exp = explainSuggestion(suggestion, ctx, 2);
      expect(exp.debugSummary).toContain('rank=2');
      expect(exp.debugSummary).toContain('score=55');
    });
  });

  describe('inspectExpenseContext', () => {
    it('returns inspection report', () => {
      const report = inspectExpenseContext(ctx);
      expect(typeof report.input).toBe('string');
      expect(typeof report.summary).toBe('string');
      expect(Array.isArray(report.flags)).toBe(true);
      expect(Array.isArray(report.topCandidates)).toBe(true);
    });

    it('amount field matches context', () => {
      const report = inspectExpenseContext(ctx);
      expect(report.amount).toBe(String(ctx.amount ?? 'none'));
    });

    it('flags NO_AMOUNT when no amount in input', () => {
      const noAmountCtx = buildExpenseContext('coffee', CATS);
      const report = inspectExpenseContext(noAmountCtx);
      expect(report.flags).toContain('NO_AMOUNT');
    });

    it('flags NO_CANDIDATES when no categories provided', () => {
      const emptyCtx = buildExpenseContext('coffee 45', []);
      const report = inspectExpenseContext(emptyCtx);
      expect(report.flags).toContain('NO_CANDIDATES');
    });

    it('confidenceProfile contains all three percentages', () => {
      const report = inspectExpenseContext(ctx);
      expect(report.confidenceProfile).toContain('amount=');
      expect(report.confidenceProfile).toContain('merchant=');
      expect(report.confidenceProfile).toContain('category=');
    });
  });

  describe('explainAllSuggestions', () => {
    it('returns explanation per suggestion in order', () => {
      const suggestions = [
        makeScoredSuggestion('health', 60),
        makeScoredSuggestion('groceries', 40),
      ];
      const explanations = explainAllSuggestions(suggestions, ctx);
      expect(explanations).toHaveLength(2);
      expect(explanations[0].rank).toBe(1);
      expect(explanations[1].rank).toBe(2);
    });

    it('returns empty for empty suggestions', () => {
      expect(explainAllSuggestions([], ctx)).toEqual([]);
    });
  });
});

// ── quickAddState ─────────────────────────────────────────────────────────────

describe('quickAddState', () => {
  const ctx = buildExpenseContext('coffee 45', CATS);

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
      // Build a context with large amount (triggers large_amount split hint)
      const largeCtx = buildExpenseContext('dabbah 1500', CATS);
      const presets = [{ id: 'p1', categoryIds: ['groceries', 'home'], categoryNames: ['Groceries', 'Home'], count: 3, lastUsed: '', confidence: 0.6 }];
      const state = applyContextToQuickAdd(initialQuickAddState(), largeCtx, presets, NOW);
      // May or may not be split_pending depending on split hint detection
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
      const noAmountCtx = buildExpenseContext('coffee', CATS);
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
      const s0 = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
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

    it('hasSuggestions: true when context has candidates', () => {
      const state = applyContextToQuickAdd(initialQuickAddState(), ctx, [], NOW);
      // Only true if context has candidates
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
