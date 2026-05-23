/**
 * Tests for the Unified Input Understanding Pipeline.
 *
 * Coverage:
 *   - inputNormalizer: normalizeText, toMerchantKey, resolveAlias, amount utilities
 *   - tokenClassifier: classifyToken, tokenizeAndClassify
 *   - inputPipeline: parseInput (all 7 stages), ParserContext shape
 *   - parseQuickAdd: backward compatibility
 *
 * All tests are deterministic: same inputs → same outputs, always.
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  toMerchantKey,
  resolveAlias,
  isAmountString,
  parseAmountToken,
  stripCurrencySymbol,
  MERCHANT_ALIAS_MAP,
} from '@/features/expenses/engine/inputNormalizer';
import {
  classifyToken,
  tokenizeAndClassify,
} from '@/features/expenses/engine/tokenClassifier';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import { parseQuickAdd } from '@/features/expenses/utils/quickAddParser';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeMemory(merchantKey: string): SuggestionMemoryState {
  return {
    merchants: { [merchantKey]: [{ categoryId: 'food', count: 3, lastUsed: '2026-01-01' }] },
    recents: [],
    splitCombos: [],
    tagAssociations: [],
  };
}

const emptyMemory: SuggestionMemoryState = {
  merchants: {},
  recents: [],
  splitCombos: [],
  tagAssociations: [],
};

// ── inputNormalizer: normalizeText ────────────────────────────────────────────

describe('normalizeText', () => {
  it('lowercases input', () => {
    expect(normalizeText('DABBAH')).toBe('dabbah');
    expect(normalizeText('Зарплата')).toBe('зарплата');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeText('  coffee  ')).toBe('coffee');
  });

  it('collapses multiple internal spaces', () => {
    expect(normalizeText('dabbah  молоко  350')).toBe('dabbah молоко 350');
  });

  it('applies NFC normalization (idempotent on ASCII)', () => {
    expect(normalizeText('cafe')).toBe('cafe');
  });

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('');
  });
});

// ── inputNormalizer: alias resolution ────────────────────────────────────────

describe('resolveAlias', () => {
  it('maps dabah → dabbah', () => {
    expect(resolveAlias('dabah')).toBe('dabbah');
  });

  it('maps dabach → dabbah', () => {
    expect(resolveAlias('dabach')).toBe('dabbah');
  });

  it('passes through unknown tokens unchanged', () => {
    expect(resolveAlias('shufersal')).toBe('shufersal');
    expect(resolveAlias('кофе')).toBe('кофе');
  });

  it('every key in MERCHANT_ALIAS_MAP resolves to a non-empty value', () => {
    for (const [key, value] of Object.entries(MERCHANT_ALIAS_MAP)) {
      expect(value.length).toBeGreaterThan(0);
      expect(key).toBe(key.toLowerCase()); // keys must be pre-normalized
    }
  });
});

describe('toMerchantKey', () => {
  it('normalizes casing', () => {
    expect(toMerchantKey('SHUFERSAL')).toBe('shufersal');
  });

  it('resolves alias in one call', () => {
    expect(toMerchantKey('Dabah')).toBe('dabbah');
    expect(toMerchantKey('DABACH')).toBe('dabbah');
  });

  it('handles extra whitespace', () => {
    expect(toMerchantKey('  Coffee  ')).toBe('coffee');
  });
});

// ── inputNormalizer: amount utilities ────────────────────────────────────────

describe('isAmountString', () => {
  it('recognizes plain integers', () => {
    expect(isAmountString('350')).toBe(true);
    expect(isAmountString('0')).toBe(true);
  });

  it('recognizes decimal with period', () => {
    expect(isAmountString('18.50')).toBe(true);
    expect(isAmountString('3.99')).toBe(true);
  });

  it('recognizes decimal with comma (European)', () => {
    expect(isAmountString('18,50')).toBe(true);
  });

  it('recognizes currency-prefixed amounts', () => {
    expect(isAmountString('₪350')).toBe(true);
    expect(isAmountString('$18.50')).toBe(true);
    expect(isAmountString('€100')).toBe(true);
  });

  it('recognizes currency-suffixed amounts', () => {
    expect(isAmountString('350₪')).toBe(true);
    expect(isAmountString('50$')).toBe(true);
  });

  it('rejects non-numeric tokens', () => {
    expect(isAmountString('dabbah')).toBe(false);
    expect(isAmountString('молоко')).toBe(false);
    expect(isAmountString('')).toBe(false);
    expect(isAmountString('12abc')).toBe(false);
  });
});

describe('parseAmountToken', () => {
  it('parses integer', () => expect(parseAmountToken('350')).toBe(350));
  it('parses decimal period', () => expect(parseAmountToken('18.50')).toBeCloseTo(18.5));
  it('parses decimal comma', () => expect(parseAmountToken('18,50')).toBeCloseTo(18.5));
  it('parses currency-prefixed', () => expect(parseAmountToken('₪350')).toBe(350));
  it('parses currency-suffixed', () => expect(parseAmountToken('350₪')).toBe(350));
});

// ── tokenClassifier ───────────────────────────────────────────────────────────

describe('classifyToken', () => {
  it('classifies numeric tokens as amount', () => {
    expect(classifyToken('350').kind).toBe('amount');
    expect(classifyToken('18.50').kind).toBe('amount');
    expect(classifyToken('₪350').kind).toBe('amount');
  });

  it('classifies stop words as noise', () => {
    expect(classifyToken('в').kind).toBe('noise');
    expect(classifyToken('на').kind).toBe('noise');
    expect(classifyToken('the').kind).toBe('noise');
    expect(classifyToken('и').kind).toBe('noise');
  });

  it('classifies regular words as text', () => {
    expect(classifyToken('dabbah').kind).toBe('text');
    expect(classifyToken('молоко').kind).toBe('text');
    expect(classifyToken('shufersal').kind).toBe('text');
  });

  it('classifies amount and sets numericValue', () => {
    const token = classifyToken('350');
    expect(token.kind).toBe('amount');
    expect(token.numericValue).toBe(350);
  });
});

describe('tokenizeAndClassify', () => {
  it('splits and classifies correctly', () => {
    const tokens = tokenizeAndClassify('dabbah 350');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).toMatchObject({ kind: 'text', normalized: 'dabbah' });
    expect(tokens[1]).toMatchObject({ kind: 'amount', numericValue: 350 });
  });

  it('returns empty array for empty input', () => {
    expect(tokenizeAndClassify('')).toEqual([]);
  });

  it('filters noise tokens correctly', () => {
    const tokens = tokenizeAndClassify('кофе в офис 50');
    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toContain('text');
    expect(kinds).toContain('amount');
    const noiseTokens = tokens.filter((t) => t.kind === 'noise');
    expect(noiseTokens.length).toBeGreaterThan(0); // "в" is noise
  });
});

// ── inputPipeline: parseInput ─────────────────────────────────────────────────

describe('parseInput — basic extraction', () => {
  it('extracts amount and merchant from simple input', () => {
    const ctx = parseInput('Dabbah 350');
    expect(ctx.amount).toBe(350);
    expect(ctx.merchant).toBe('Dabbah');  // original casing preserved
    expect(ctx.merchantKey).toBe('dabbah'); // key is normalized
  });

  it('handles amount only', () => {
    const ctx = parseInput('350');
    expect(ctx.amount).toBe(350);
    expect(ctx.merchant).toBeUndefined();
  });

  it('handles merchant only (no amount)', () => {
    const ctx = parseInput('Groceries');
    expect(ctx.amount).toBeUndefined();
    expect(ctx.merchant).toBe('Groceries');
  });

  it('handles empty input', () => {
    const ctx = parseInput('');
    expect(ctx.amount).toBeUndefined();
    expect(ctx.merchant).toBeUndefined();
    expect(ctx.tags).toEqual([]);
  });

  it('handles whitespace-only input', () => {
    const ctx = parseInput('   ');
    expect(ctx.amount).toBeUndefined();
    expect(ctx.merchant).toBeUndefined();
  });

  it('extracts amount from middle of input', () => {
    // "Bus 7 morning" → amount=7, merchant="Bus morning"
    const ctx = parseInput('Bus 7 morning');
    expect(ctx.amount).toBe(7);
    expect(ctx.merchant).toBe('Bus morning');
  });
});

describe('parseInput — noisy input handling', () => {
  it('collapses extra whitespace', () => {
    const ctx = parseInput('Dabbah   350');
    expect(ctx.amount).toBe(350);
    expect(ctx.merchant).toBe('Dabbah');
  });

  it('handles leading/trailing whitespace', () => {
    const ctx = parseInput('  Coffee  150  ');
    expect(ctx.amount).toBe(150);
    expect(ctx.merchant).toBe('Coffee');
  });

  it('filters noise tokens from merchant', () => {
    // "кофе в офис 50" — "в" is noise, merchant = "кофе офис"
    const ctx = parseInput('кофе в офис 50');
    expect(ctx.amount).toBe(50);
    expect(ctx.merchant).toContain('кофе');
    expect(ctx.merchant).not.toContain(' в ');
  });

  it('handles currency-prefixed amounts', () => {
    const ctx = parseInput('Coffee ₪85');
    expect(ctx.amount).toBe(85);
    expect(ctx.merchant).toBe('Coffee');
  });

  it('handles decimal comma', () => {
    const ctx = parseInput('Coffee 18,50');
    expect(ctx.amount).toBeCloseTo(18.5);
  });
});

describe('parseInput — alias resolution (transliteration variants)', () => {
  it('resolves dabah → dabbah merchantKey', () => {
    const ctx = parseInput('dabah 350');
    expect(ctx.merchantKey).toBe('dabbah');
    expect(ctx.merchant).toBe('dabah'); // display form unchanged
  });

  it('resolves dabach → dabbah merchantKey', () => {
    const ctx = parseInput('dabach 350');
    expect(ctx.merchantKey).toBe('dabbah');
  });

  it('does not alter merchant display name (only key)', () => {
    const ctx = parseInput('Dabah 350');
    expect(ctx.merchant).toBe('Dabah');     // original casing preserved
    expect(ctx.merchantKey).toBe('dabbah'); // alias-resolved key
  });

  it('resolves Cyrillic store name variant', () => {
    const ctx = parseInput('Виктори 200');
    expect(ctx.merchantKey).toBe('victory');
    expect(ctx.merchant).toBe('Виктори'); // display unchanged
  });
});

describe('parseInput — tags', () => {
  it('produces tag array from merchantKey', () => {
    const ctx = parseInput('Dabbah 350');
    expect(ctx.tags).toEqual(['dabbah']);
  });

  it('alias-resolved key is used in tags', () => {
    const ctx = parseInput('dabah 350');
    expect(ctx.tags).toEqual(['dabbah']);
  });

  it('tags is empty when no merchant', () => {
    const ctx = parseInput('350');
    expect(ctx.tags).toEqual([]);
  });
});

describe('parseInput — memory-aware merchant detection', () => {
  it('splits merchant and item candidates when first token is known merchant', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah молоко 350', memory);
    expect(ctx.amount).toBe(350);
    expect(ctx.merchant).toBe('dabbah');
    expect(ctx.merchantKey).toBe('dabbah');
    expect(ctx.itemCandidates).toContain('молоко');
  });

  it('treats all text as merchant when first token is unknown', () => {
    const ctx = parseInput('Dabbah молоко 350', emptyMemory);
    expect(ctx.amount).toBe(350);
    expect(ctx.itemCandidates).toHaveLength(0);
  });

  it('treats all text as merchant when only one text token', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah 350', memory);
    expect(ctx.merchant).toBe('dabbah');
    expect(ctx.itemCandidates).toHaveLength(0);
  });

  it('works without memory (no crash)', () => {
    const ctx = parseInput('Dabbah молоко 350');
    expect(ctx.amount).toBe(350);
    expect(ctx.merchant).toBe('dabbah молоко');
  });
});

describe('parseInput — item candidates', () => {
  it('returns item candidates after known merchant', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah молоко хлеб 350', memory);
    expect(ctx.itemCandidates).toContain('молоко');
    expect(ctx.itemCandidates).toContain('хлеб');
    expect(ctx.itemCandidates).toHaveLength(2);
  });

  it('excludes noise tokens from item candidates', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah молоко и хлеб 350', memory);
    // "и" is noise
    expect(ctx.itemCandidates).not.toContain('и');
    expect(ctx.itemCandidates).toContain('молоко');
    expect(ctx.itemCandidates).toContain('хлеб');
  });
});

describe('parseInput — confidence signals', () => {
  it('includes amount_present when amount found', () => {
    const ctx = parseInput('Coffee 50');
    expect(ctx.confidenceSignals.some((s) => s.kind === 'amount_present')).toBe(true);
  });

  it('no amount_present when no amount', () => {
    const ctx = parseInput('Coffee');
    expect(ctx.confidenceSignals.some((s) => s.kind === 'amount_present')).toBe(false);
  });

  it('includes merchant_known when merchant found in memory', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah 350', memory);
    expect(ctx.confidenceSignals.some((s) => s.kind === 'merchant_known')).toBe(true);
    expect(ctx.confidenceSignals.find((s) => s.kind === 'merchant_known')?.detail).toBe('dabbah');
  });

  it('no merchant_known when merchant not in memory', () => {
    const ctx = parseInput('Dabbah 350', emptyMemory);
    expect(ctx.confidenceSignals.some((s) => s.kind === 'merchant_known')).toBe(false);
  });

  it('includes tag_reinforced when tag associations exist', () => {
    const memory: SuggestionMemoryState = {
      merchants: {},
      recents: [],
      splitCombos: [],
      tagAssociations: [
        { tag: 'dabbah', categoryId: 'food', usageCount: 2, lastUsedAt: '2026-01-01', source: 'split' },
      ],
    };
    const ctx = parseInput('Dabbah 350', memory);
    expect(ctx.confidenceSignals.some((s) => s.kind === 'tag_reinforced')).toBe(true);
  });

  it('includes item_candidates_found when item candidates detected', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah молоко 350', memory);
    expect(ctx.confidenceSignals.some((s) => s.kind === 'item_candidates_found')).toBe(true);
  });
});

describe('parseInput — split hints', () => {
  it('large_amount hint when amount >= 500', () => {
    const ctx = parseInput('Аренда 5000');
    expect(ctx.splitHints.some((h) => h.kind === 'large_amount')).toBe(true);
  });

  it('no large_amount hint when amount < 500', () => {
    const ctx = parseInput('Coffee 50');
    expect(ctx.splitHints.some((h) => h.kind === 'large_amount')).toBe(false);
  });

  it('multiple_items hint when 2+ item candidates', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah молоко хлеб 350', memory);
    expect(ctx.splitHints.some((h) => h.kind === 'multiple_items')).toBe(true);
  });

  it('no multiple_items hint with single item candidate', () => {
    const memory = makeMemory('dabbah');
    const ctx = parseInput('Dabbah молоко 350', memory);
    expect(ctx.splitHints.some((h) => h.kind === 'multiple_items')).toBe(false);
  });

  it('both hints can be present simultaneously', () => {
    const memory = makeMemory('shufersal');
    const ctx = parseInput('shufersal молоко хлеб 1200', memory);
    const kinds = ctx.splitHints.map((h) => h.kind);
    expect(kinds).toContain('large_amount');
    expect(kinds).toContain('multiple_items');
  });
});

// ── Mixed-language inputs ─────────────────────────────────────────────────────

describe('parseInput — mixed-language inputs', () => {
  it('handles Hebrew-script merchant name', () => {
    const ctx = parseInput('שופרסל 250');
    expect(ctx.amount).toBe(250);
    expect(ctx.merchant).toBe('שופרסל');
  });

  it('handles Cyrillic merchant + Latin amount', () => {
    const ctx = parseInput('Аптека 85');
    expect(ctx.amount).toBe(85);
    expect(ctx.merchant).toBe('аптека');
  });

  it('handles mixed Cyrillic + Latin tokens', () => {
    const ctx = parseInput('IKEA стол 1500');
    expect(ctx.amount).toBe(1500);
    expect(ctx.merchant).toBeDefined();
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('parseInput — determinism', () => {
  it('same inputs always produce identical output', () => {
    const inputs = [
      'Dabbah 350',
      'dabah молоко 350',
      '  Coffee  18,50  ',
      'зарплата 15000',
      '',
    ];
    for (const input of inputs) {
      const a = parseInput(input);
      const b = parseInput(input);
      expect(a).toEqual(b);
    }
  });

  it('same inputs with memory produce identical output', () => {
    const memory = makeMemory('dabbah');
    const a = parseInput('Dabbah молоко 350', memory);
    const b = parseInput('Dabbah молоко 350', memory);
    expect(a).toEqual(b);
  });
});

// ── parseQuickAdd backward compatibility ─────────────────────────────────────

describe('parseQuickAdd — backward compatibility', () => {
  it('returns amount and merchant like the old parser', () => {
    expect(parseQuickAdd('Dabbah 350')).toEqual({ amount: 350, merchant: 'dabbah' });
  });

  it('handles amount only', () => {
    expect(parseQuickAdd('350')).toEqual({ amount: 350 });
  });

  it('handles merchant only', () => {
    const result = parseQuickAdd('Groceries');
    expect(result.merchant).toBe('groceries');
    expect(result.amount).toBeUndefined();
  });

  it('handles empty string', () => {
    expect(parseQuickAdd('')).toEqual({});
  });

  it('handles amount in middle (Bus 7 morning)', () => {
    const result = parseQuickAdd('Bus 7 morning');
    expect(result.amount).toBe(7);
    expect(result.merchant).toContain('bus');
    expect(result.merchant).toContain('morning');
  });

  it('handles decimal comma', () => {
    const result = parseQuickAdd('Coffee 18,50');
    expect(result.amount).toBeCloseTo(18.5);
  });

  it('handles currency prefix', () => {
    const result = parseQuickAdd('Coffee ₪85');
    expect(result.amount).toBe(85);
    expect(result.merchant).toBe('coffee');
  });
});
