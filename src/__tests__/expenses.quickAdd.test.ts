import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '@/features/expenses/utils/quickAddParser';
import { rankSuggestions } from '@/features/expenses/utils/suggestionRanking';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

// ── parseQuickAdd ─────────────────────────────────────────────────────────────

describe('parseQuickAdd', () => {
  it('parses merchant + amount', () => {
    expect(parseQuickAdd('Dabbah 350')).toEqual({ merchant: 'Dabbah', amount: 350 });
  });

  it('parses amount only', () => {
    expect(parseQuickAdd('350')).toEqual({ amount: 350 });
  });

  it('parses decimal amount', () => {
    expect(parseQuickAdd('Coffee 18.50')).toEqual({ merchant: 'Coffee', amount: 18.5 });
  });

  it('handles comma decimal separator', () => {
    expect(parseQuickAdd('Fuel 250,5')).toEqual({ merchant: 'Fuel', amount: 250.5 });
  });

  it('extracts last number as amount, rest as merchant', () => {
    expect(parseQuickAdd('Bus 7 morning')).toEqual({ merchant: 'Bus morning', amount: 7 });
  });

  it('returns merchant-only for text without numbers', () => {
    expect(parseQuickAdd('Groceries')).toEqual({ merchant: 'Groceries' });
  });

  it('handles multi-word merchant', () => {
    expect(parseQuickAdd('Super Store 1500')).toEqual({ merchant: 'Super Store', amount: 1500 });
  });

  it('returns empty for empty input', () => {
    expect(parseQuickAdd('')).toEqual({});
    expect(parseQuickAdd('   ')).toEqual({});
  });
});

// ── rankSuggestions ───────────────────────────────────────────────────────────

const emptyMemory: SuggestionMemoryState = { merchants: {}, recents: [], splitCombos: [], tagAssociations: [] };

const items = [
  { id: 'food', name: 'Еда' },
  { id: 'transport', name: 'Транспорт' },
  { id: 'health', name: 'Здоровье' },
  { id: 'home', name: 'Дом' },
];

describe('rankSuggestions', () => {
  it('returns topN items even with no memory', () => {
    const result = rankSuggestions(items, undefined, emptyMemory, 3);
    expect(result).toHaveLength(3);
  });

  it('is deterministic — same input same output', () => {
    const a = rankSuggestions(items, 'cafe', emptyMemory, 3);
    const b = rankSuggestions(items, 'cafe', emptyMemory, 3);
    expect(a).toEqual(b);
  });

  it('ranks merchant history match first', () => {
    const memory: SuggestionMemoryState = {
      merchants: {
        dabbah: [{ categoryId: 'food', count: 5, lastUsed: new Date().toISOString() }],
      },
      recents: [],
      splitCombos: [], tagAssociations: [],
    };
    const result = rankSuggestions(items, 'Dabbah', memory, 3);
    expect(result[0]).toBe('food');
  });

  it('ranks recent usage above cold categories', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [
        { categoryId: 'health', count: 3, lastUsed: new Date().toISOString() },
      ],
    };
    const result = rankSuggestions(items, undefined, memory, 3);
    expect(result[0]).toBe('health');
  });

  it('decays recency — old usage ranks lower', () => {
    const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const memoryOld: SuggestionMemoryState = {
      merchants: {},
      recents: [{ categoryId: 'health', count: 10, lastUsed: oldDate }],
    };
    const memoryFresh: SuggestionMemoryState = {
      merchants: {},
      recents: [{ categoryId: 'food', count: 1, lastUsed: new Date().toISOString() }],
    };
    const resultOld = rankSuggestions(items, undefined, memoryOld, 1);
    const resultFresh = rankSuggestions(items, undefined, memoryFresh, 1);
    // Fresh recent should win over old high-count
    expect(resultFresh[0]).toBe('food');
    // Old 40-day usage: decay = 0, so health should not win over cold items either
    expect(resultOld[0]).not.toBe('health');
  });

  it('never returns more than topN items', () => {
    const result = rankSuggestions(items, 'test', emptyMemory, 2);
    expect(result).toHaveLength(2);
  });

  it('handles empty items list', () => {
    expect(rankSuggestions([], 'test', emptyMemory, 3)).toEqual([]);
  });
});
