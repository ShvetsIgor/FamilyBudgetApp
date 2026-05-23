/**
 * Tests for the formal ranking pipeline:
 *   - habit signal (Phase 4)
 *   - SignalSet inspectability
 *   - pipeline determinism under all signal combinations
 *   - session stage branching (previousStage tracking)
 */
import { describe, it, expect } from 'vitest';
import {
  computeSuggestions,
  explainSuggestion,
  shortExplainSuggestion,
  isHabitSuggestion,
  hasConfidentSuggestion,
  getConfidenceLevel,
  type ScoredSuggestion,
} from '@/features/expenses/engine/suggestionEngine';
import { SCORING_POLICY } from '@/features/expenses/engine/scoringPolicy';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';
import { configureStore } from '@reduxjs/toolkit';
import inputSessionReducer, {
  setSession,
  advanceStage,
  markSaved,
  clearSession,
} from '@/features/expenses/store/inputSessionSlice';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const items = [
  { id: 'food', name: 'Еда' },
  { id: 'transport', name: 'Транспорт' },
  { id: 'health', name: 'Здоровье' },
];

const emptyMemory: SuggestionMemoryState = {
  merchants: {},
  recents: [],
  splitCombos: [], tagAssociations: [],
};

const today = new Date().toISOString().slice(0, 10);
const { frequencyThreshold } = SCORING_POLICY.signals.habit;

function makeMemoryWithUsage(merchantKey: string, categoryId: string, count: number): SuggestionMemoryState {
  return {
    merchants: { [merchantKey]: [{ categoryId, count, lastUsed: today }] },
    recents: [],
    splitCombos: [], tagAssociations: [],
  };
}

// ── Habit signal ──────────────────────────────────────────────────────────────

describe('habit signal', () => {
  it('fires when merchant usage meets frequencyThreshold', () => {
    const mem = makeMemoryWithUsage('shop', 'food', frequencyThreshold);
    const result = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const food = result.find((s) => s.categoryId === 'food')!;
    expect(food.reasons.some((r) => r.kind === 'habit')).toBe(true);
  });

  it('does not fire below frequencyThreshold', () => {
    const mem = makeMemoryWithUsage('shop', 'food', frequencyThreshold - 1);
    const result = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const food = result.find((s) => s.categoryId === 'food')!;
    expect(food.reasons.some((r) => r.kind === 'habit')).toBe(false);
    // merchant_history should still fire
    expect(food.reasons.some((r) => r.kind === 'merchant_history')).toBe(true);
  });

  it('habit takes display precedence over merchant_history', () => {
    const mem = makeMemoryWithUsage('shop', 'food', frequencyThreshold);
    const result = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const food = result.find((s) => s.categoryId === 'food')!;
    expect(food.reasons.some((r) => r.kind === 'habit')).toBe(true);
    expect(food.reasons.some((r) => r.kind === 'merchant_history')).toBe(false);
  });

  it('habit adds score on top of merchantHistory contribution', () => {
    const atThreshold = makeMemoryWithUsage('shop', 'food', frequencyThreshold);
    const belowThreshold = makeMemoryWithUsage('shop', 'food', frequencyThreshold - 1);

    const withHabit = computeSuggestions({ merchant: 'shop', items, memory: atThreshold });
    const withoutHabit = computeSuggestions({ merchant: 'shop', items, memory: belowThreshold });

    const scoreWith = withHabit.find((s) => s.categoryId === 'food')!.score;
    const scoreWithout = withoutHabit.find((s) => s.categoryId === 'food')!.score;

    // Difference includes merchantHistory slope + flat habit weight
    expect(scoreWith).toBeGreaterThan(scoreWithout);
    expect(scoreWith - scoreWithout).toBeGreaterThanOrEqual(SCORING_POLICY.signals.habit.weight);
  });

  it('habit at threshold makes suggestion confident (score >= confidentScore)', () => {
    const mem = makeMemoryWithUsage('shop', 'food', frequencyThreshold);
    const result = computeSuggestions({ merchant: 'shop', items, memory: mem });
    expect(hasConfidentSuggestion(result)).toBe(true);
  });

  it('isHabitSuggestion returns true only for habit suggestions', () => {
    const mem = makeMemoryWithUsage('shop', 'food', frequencyThreshold);
    const result = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const food = result.find((s) => s.categoryId === 'food')!;
    const transport = result.find((s) => s.categoryId === 'transport')!;
    expect(isHabitSuggestion(food)).toBe(true);
    expect(isHabitSuggestion(transport)).toBe(false);
  });
});

// ── explainSuggestion + shortExplainSuggestion for habit ─────────────────────

describe('explainSuggestion — habit', () => {
  const habitSuggestion: ScoredSuggestion = {
    categoryId: 'food',
    score: 60,
    reasons: [{ kind: 'habit', count: 5 }],
  };

  it('explains habit reason', () => {
    expect(explainSuggestion(habitSuggestion)).toBe('Часто здесь (5×)');
  });

  it('shortExplainSuggestion returns "привычка" for habit', () => {
    expect(shortExplainSuggestion(habitSuggestion)).toBe('привычка');
  });
});

// ── Pipeline determinism ──────────────────────────────────────────────────────

describe('ranking pipeline determinism', () => {
  it('same inputs always produce identical output (habit path)', () => {
    const mem = makeMemoryWithUsage('dabbah', 'food', 5);
    const a = computeSuggestions({ merchant: 'Dabbah', items, memory: mem });
    const b = computeSuggestions({ merchant: 'Dabbah', items, memory: mem });
    expect(a.map((s) => s.categoryId)).toEqual(b.map((s) => s.categoryId));
    expect(a.map((s) => s.score)).toEqual(b.map((s) => s.score));
  });

  it('multiple signals stack correctly', () => {
    const mem: SuggestionMemoryState = {
      merchants: { shop: [{ categoryId: 'food', count: 5, lastUsed: today }] },
      recents: [{ categoryId: 'food', count: 10, lastUsed: new Date().toISOString() }],
      splitCombos: [], tagAssociations: [],
    };
    const result = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const food = result.find((s) => s.categoryId === 'food')!;
    // habit + merchantHistory + recentUsage → reasons include habit + recent_usage
    expect(food.reasons.some((r) => r.kind === 'habit')).toBe(true);
    expect(food.reasons.some((r) => r.kind === 'recent_usage')).toBe(true);
    // merchant_history should NOT be in reasons (habit takes precedence)
    expect(food.reasons.some((r) => r.kind === 'merchant_history')).toBe(false);
  });

  it('tie-break by categoryId lexicographic order', () => {
    // All fallback → sort alphabetically
    const result = computeSuggestions({ merchant: undefined, items, memory: emptyMemory });
    const ids = result.map((s) => s.categoryId);
    expect(ids).toEqual([...ids].sort((a, b) => a.localeCompare(b)));
  });

  it('topN slice applied after ranking', () => {
    const mem = makeMemoryWithUsage('shop', 'food', 5);
    const all = computeSuggestions({ merchant: 'shop', items, memory: mem });
    const top2 = computeSuggestions({ merchant: 'shop', items, memory: mem, topN: 2 });
    expect(top2).toHaveLength(2);
    expect(top2[0].categoryId).toBe(all[0].categoryId);
  });
});

// ── Merchant history freshness decay ─────────────────────────────────────────

describe('merchant history freshness decay', () => {
  function makeMemoryWithAge(merchantKey: string, categoryId: string, count: number, ageDays: number): SuggestionMemoryState {
    const date = new Date(Date.now() - ageDays * 86_400_000).toISOString().slice(0, 10);
    return {
      merchants: { [merchantKey]: [{ categoryId, count, lastUsed: date }] },
      recents: [],
      splitCombos: [], tagAssociations: [],
    };
  }

  it('recent entry (0 days old) gets full merchant history score', () => {
    const fresh = makeMemoryWithAge('shop', 'food', 5, 0);
    const stale = makeMemoryWithAge('shop', 'food', 5, 89); // 89/90 decay
    const freshResult = computeSuggestions({ merchant: 'shop', items, memory: fresh });
    const staleResult = computeSuggestions({ merchant: 'shop', items, memory: stale });
    const freshScore = freshResult.find((s) => s.categoryId === 'food')!.score;
    const staleScore = staleResult.find((s) => s.categoryId === 'food')!.score;
    expect(freshScore).toBeGreaterThan(staleScore);
  });

  it('entry older than decayDays (90 days) contributes 0 from merchant history', () => {
    const { decayDays } = SCORING_POLICY.signals.merchantHistory;
    const expired = makeMemoryWithAge('shop', 'food', 5, decayDays + 1);
    const result = computeSuggestions({ merchant: 'shop', items, memory: expired });
    const food = result.find((s) => s.categoryId === 'food')!;
    // merchant_history is fully decayed; habit may still fire if count >= threshold
    // but base merchant_history contribution is 0
    const noMerchantScore = SCORING_POLICY.signals.habit.weight; // only habit if count >= threshold
    expect(food.score).toBeLessThanOrEqual(noMerchantScore);
  });

  it('habit signal is NOT decayed (confirmed habits remain valid after gaps)', () => {
    const { decayDays } = SCORING_POLICY.signals.merchantHistory;
    const { frequencyThreshold } = SCORING_POLICY.signals.habit;
    // Old entry with enough count to qualify as habit
    const oldHabit = makeMemoryWithAge('shop', 'food', frequencyThreshold, decayDays + 1);
    const result = computeSuggestions({ merchant: 'shop', items, memory: oldHabit });
    const food = result.find((s) => s.categoryId === 'food')!;
    // Habit reason should still fire even though merchant history is fully decayed
    expect(food.reasons.some((r) => r.kind === 'habit')).toBe(true);
  });

  it('45-day-old entry contributes ~50% of a fresh entry (same count)', () => {
    const { decayDays } = SCORING_POLICY.signals.merchantHistory;
    // Use count=1 (below habit threshold) so only merchantHistory fires — clean comparison
    const halfLife = makeMemoryWithAge('shop', 'food', 1, decayDays / 2);
    const fresh = makeMemoryWithAge('shop', 'food', 1, 0);
    const halfScore = computeSuggestions({ merchant: 'shop', items, memory: halfLife })
      .find((s) => s.categoryId === 'food')!.score;
    const freshScore = computeSuggestions({ merchant: 'shop', items, memory: fresh })
      .find((s) => s.categoryId === 'food')!.score;
    // At decayDays/2, freshness = 0.5 → half score
    expect(halfScore).toBeGreaterThan(freshScore * 0.4);
    expect(halfScore).toBeLessThan(freshScore * 0.65);
  });
});

// ── getConfidenceLevel ────────────────────────────────────────────────────────

describe('getConfidenceLevel', () => {
  it('returns low for empty suggestions', () => {
    expect(getConfidenceLevel([])).toBe('low');
  });

  it('returns low when top score is below confidentScore threshold', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 5, reasons: [{ kind: 'fallback' }] },
    ];
    expect(getConfidenceLevel(suggestions)).toBe('low');
  });

  it('returns high when top suggestion has habit signal', () => {
    const mem = makeMemoryWithUsage('shop', 'food', frequencyThreshold);
    const result = computeSuggestions({ merchant: 'shop', items, memory: mem });
    expect(getConfidenceLevel(result)).toBe('high');
  });

  it('returns high when second score is less than 30% of top score (dominant winner)', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 60, reasons: [{ kind: 'merchant_history', count: 5 }] },
      { categoryId: 'transport', score: 5, reasons: [{ kind: 'fallback' }] },
    ];
    expect(getConfidenceLevel(suggestions)).toBe('high');
  });

  it('returns medium when confident but real competitor exists (second >= 30% of top)', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 50, reasons: [{ kind: 'merchant_history', count: 5 }] },
      { categoryId: 'transport', score: 25, reasons: [{ kind: 'recent_usage', daysSince: 1 }] },
    ];
    expect(getConfidenceLevel(suggestions)).toBe('medium');
  });

  it('returns high even when second is present but has zero score', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 60, reasons: [{ kind: 'merchant_history', count: 5 }] },
      { categoryId: 'transport', score: 0, reasons: [{ kind: 'fallback' }] },
    ];
    expect(getConfidenceLevel(suggestions)).toBe('high');
  });
});

// ── Session stage branching (Phase 3) ────────────────────────────────────────

describe('inputSessionSlice — branch tracking', () => {
  function makeStore() {
    return configureStore({ reducer: { inputSession: inputSessionReducer } });
  }

  const baseSession = {
    rawInput: 'shop 500',
    detectedMerchant: 'shop',
    detectedAmount: 500,
    suggestions: [],
    stage: 'clarification' as const,
  };

  it('advanceStage records previousStage', () => {
    const store = makeStore();
    store.dispatch(setSession(baseSession));
    store.dispatch(advanceStage('split'));
    const s = store.getState().inputSession.session!;
    expect(s.stage).toBe('split');
    expect(s.previousStage).toBe('clarification');
  });

  it('markSaved records previousStage', () => {
    const store = makeStore();
    store.dispatch(setSession({ ...baseSession, stage: 'confirm' }));
    store.dispatch(markSaved());
    const s = store.getState().inputSession.session!;
    expect(s.stage).toBe('saved');
    expect(s.previousStage).toBe('confirm');
  });

  it('clearSession fully resets — no stale branch state', () => {
    const store = makeStore();
    store.dispatch(setSession(baseSession));
    store.dispatch(advanceStage('split'));
    store.dispatch(clearSession());
    expect(store.getState().inputSession.session).toBeNull();
  });

  it('setSession resets previousStage (fresh session has no branch history)', () => {
    const store = makeStore();
    store.dispatch(setSession(baseSession));
    store.dispatch(advanceStage('split'));
    store.dispatch(setSession({ ...baseSession, rawInput: 'new 100' }));
    const s = store.getState().inputSession.session!;
    expect(s.previousStage).toBeUndefined();
  });
});
