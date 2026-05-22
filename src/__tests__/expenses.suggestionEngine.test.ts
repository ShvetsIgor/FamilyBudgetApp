import { describe, it, expect } from 'vitest';
import {
  computeSuggestions,
  explainSuggestion,
  hasConfidentSuggestion,
  isSuggestionAmbiguous,
  type ScoredSuggestion,
} from '@/features/expenses/engine/suggestionEngine';
import { inferStage, SPLIT_AMOUNT_THRESHOLD } from '@/features/expenses/hooks/useInputSession';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

const emptyMemory: SuggestionMemoryState = { merchants: {}, recents: [], splitCombos: [] };

const items = [
  { id: 'food', name: 'Еда' },
  { id: 'transport', name: 'Транспорт' },
  { id: 'health', name: 'Здоровье' },
  { id: 'home', name: 'Дом' },
];

// ── computeSuggestions ────────────────────────────────────────────────────────

describe('computeSuggestions', () => {
  it('returns scored suggestions for all items', () => {
    const result = computeSuggestions({ merchant: undefined, items, memory: emptyMemory });
    expect(result).toHaveLength(items.length);
    result.forEach((s) => {
      expect(s).toHaveProperty('categoryId');
      expect(s).toHaveProperty('score');
      expect(s).toHaveProperty('reasons');
      expect(s.reasons.length).toBeGreaterThan(0);
    });
  });

  it('marks items with no signal as fallback', () => {
    const result = computeSuggestions({ merchant: undefined, items, memory: emptyMemory });
    expect(result.every((s) => s.reasons[0].kind === 'fallback')).toBe(true);
  });

  it('gives merchant_history reason when merchant matches', () => {
    const memory: SuggestionMemoryState = {
      merchants: { dabbah: [{ categoryId: 'food', count: 3, lastUsed: new Date().toISOString() }] },
      recents: [],
    };
    const result = computeSuggestions({ merchant: 'Dabbah', items, memory, topN: 4 });
    const foodResult = result.find((s) => s.categoryId === 'food');
    expect(foodResult?.reasons.some((r) => r.kind === 'merchant_history')).toBe(true);
  });

  it('gives recent_usage reason for recently used category', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [{ categoryId: 'health', count: 5, lastUsed: new Date().toISOString() }],
      splitCombos: [],
    };
    const result = computeSuggestions({ merchant: undefined, items, memory });
    const healthResult = result.find((s) => s.categoryId === 'health');
    expect(healthResult?.reasons.some((r) => r.kind === 'recent_usage')).toBe(true);
  });

  it('gives name_match reason when merchant name matches category name', () => {
    const healthItems = [{ id: 'health', name: 'Health' }];
    const memory: SuggestionMemoryState = { merchants: {}, recents: [], splitCombos: [] };
    const result = computeSuggestions({ merchant: 'health', items: healthItems, memory });
    expect(result[0].reasons.some((r) => r.kind === 'name_match')).toBe(true);
  });

  it('merchant history ranks category first', () => {
    const memory: SuggestionMemoryState = {
      merchants: { store: [{ categoryId: 'transport', count: 5, lastUsed: new Date().toISOString() }] },
      recents: [],
      splitCombos: [],
    };
    const result = computeSuggestions({ merchant: 'store', items, memory });
    expect(result[0].categoryId).toBe('transport');
  });

  it('is deterministic — same inputs produce same output', () => {
    const a = computeSuggestions({ merchant: 'cafe', items, memory: emptyMemory });
    const b = computeSuggestions({ merchant: 'cafe', items, memory: emptyMemory });
    expect(a.map((s) => s.categoryId)).toEqual(b.map((s) => s.categoryId));
  });

  it('respects topN', () => {
    const result = computeSuggestions({ merchant: undefined, items, memory: emptyMemory, topN: 2 });
    expect(result).toHaveLength(2);
  });

  it('decays recency score for old usage', () => {
    const oldDate = new Date(Date.now() - 35 * 86_400_000).toISOString();
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [{ categoryId: 'food', count: 10, lastUsed: oldDate }],
    };
    const result = computeSuggestions({ merchant: undefined, items, memory, topN: 4 });
    const foodResult = result.find((s) => s.categoryId === 'food');
    // 35 days > 30-day window: decay = 0, score contribution = 0
    expect(foodResult?.reasons[0].kind).toBe('fallback');
  });
});

// ── explainSuggestion ─────────────────────────────────────────────────────────

describe('explainSuggestion', () => {
  it('explains merchant history', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 50,
      reasons: [{ kind: 'merchant_history', count: 5 }],
    };
    expect(explainSuggestion(s)).toBe('История покупок (5×)');
  });

  it('explains recent usage today', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 20,
      reasons: [{ kind: 'recent_usage', daysSince: 0 }],
    };
    expect(explainSuggestion(s)).toBe('Сегодня');
  });

  it('explains recent usage N days ago', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 15,
      reasons: [{ kind: 'recent_usage', daysSince: 3 }],
    };
    expect(explainSuggestion(s)).toBe('Недавно (3 дн.)');
  });

  it('explains name match', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 10,
      reasons: [{ kind: 'name_match' }],
    };
    expect(explainSuggestion(s)).toBe('Совпадение названия');
  });

  it('explains fallback', () => {
    const s: ScoredSuggestion = {
      categoryId: 'food',
      score: 0,
      reasons: [{ kind: 'fallback' }],
    };
    expect(explainSuggestion(s)).toBe('По умолчанию');
  });
});

// ── hasConfidentSuggestion / isSuggestionAmbiguous ────────────────────────────

describe('hasConfidentSuggestion', () => {
  it('returns true when top score >= threshold', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 50, reasons: [{ kind: 'merchant_history', count: 5 }] },
    ];
    expect(hasConfidentSuggestion(suggestions, 30)).toBe(true);
  });

  it('returns false when top score < threshold', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 15, reasons: [{ kind: 'recent_usage', daysSince: 5 }] },
    ];
    expect(hasConfidentSuggestion(suggestions, 30)).toBe(false);
  });

  it('returns false for empty suggestions', () => {
    expect(hasConfidentSuggestion([], 30)).toBe(false);
  });
});

describe('isSuggestionAmbiguous', () => {
  it('returns true when second score is close to first', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 20, reasons: [{ kind: 'recent_usage', daysSince: 1 }] },
      { categoryId: 'home', score: 15, reasons: [{ kind: 'recent_usage', daysSince: 2 }] },
    ];
    expect(isSuggestionAmbiguous(suggestions)).toBe(true);
  });

  it('returns false when scores are zero', () => {
    const suggestions: ScoredSuggestion[] = [
      { categoryId: 'food', score: 0, reasons: [{ kind: 'fallback' }] },
      { categoryId: 'home', score: 0, reasons: [{ kind: 'fallback' }] },
    ];
    expect(isSuggestionAmbiguous(suggestions)).toBe(false);
  });
});

// ── inferStage ────────────────────────────────────────────────────────────────

describe('inferStage', () => {
  const fallbackSuggestion: ScoredSuggestion = {
    categoryId: 'food',
    score: 0,
    reasons: [{ kind: 'fallback' }],
  };

  const confidentSuggestion: ScoredSuggestion = {
    categoryId: 'food',
    score: 50,
    reasons: [{ kind: 'merchant_history', count: 5 }],
  };

  const weakSuggestion: ScoredSuggestion = {
    categoryId: 'food',
    score: 15,
    reasons: [{ kind: 'recent_usage', daysSince: 5 }],
  };

  it('returns parsing when amount is missing', () => {
    expect(inferStage(undefined, [confidentSuggestion])).toBe('parsing');
    expect(inferStage(0, [confidentSuggestion])).toBe('parsing');
  });

  it('returns confirm when top suggestion is confident', () => {
    expect(inferStage(100, [confidentSuggestion])).toBe('confirm');
  });

  it('returns editing when no memory signal at all', () => {
    expect(inferStage(100, [fallbackSuggestion])).toBe('editing');
  });

  it('returns split for large amount without confident suggestion', () => {
    expect(inferStage(SPLIT_AMOUNT_THRESHOLD, [weakSuggestion, fallbackSuggestion])).toBe('split');
  });

  it('returns confirm even for large amount if suggestion is confident', () => {
    expect(inferStage(SPLIT_AMOUNT_THRESHOLD + 100, [confidentSuggestion])).toBe('confirm');
  });

  it('returns clarification for ambiguous weak suggestions', () => {
    const secondSuggestion: ScoredSuggestion = {
      categoryId: 'home',
      score: 12,
      reasons: [{ kind: 'recent_usage', daysSince: 3 }],
    };
    expect(inferStage(100, [weakSuggestion, secondSuggestion])).toBe('clarification');
  });
});
