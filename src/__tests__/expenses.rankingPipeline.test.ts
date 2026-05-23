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
  splitCombos: [],
};

const today = new Date().toISOString().slice(0, 10);
const { frequencyThreshold } = SCORING_POLICY.signals.habit;

function makeMemoryWithUsage(merchantKey: string, categoryId: string, count: number): SuggestionMemoryState {
  return {
    merchants: { [merchantKey]: [{ categoryId, count, lastUsed: today }] },
    recents: [],
    splitCombos: [],
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
      splitCombos: [],
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
