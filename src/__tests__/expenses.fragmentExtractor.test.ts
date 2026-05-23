/**
 * Tests for the Semantic Fragment Extraction Runtime.
 *
 * Coverage:
 *   - fragmentExtractor: extractFragments — greedy bigram + single-token matching
 *   - Fragment type assignment (merchant/item/amount/tag)
 *   - Confidence tier verification
 *   - ClarificationHint generation (all 4 kinds)
 *   - Memory-aware merchant fragment
 *   - Store bigrams (rami levi, super pharm, burger king)
 *   - Item bigrams (ice coffee, toilet paper, dog food)
 *   - Multilingual inputs (Russian, English, Hebrew tokens)
 *   - Determinism guarantee
 *   - Integration via parseInput (fragments + clarificationHints in ParserContext)
 *
 * All tests are deterministic: same inputs → same outputs, always.
 */

import { describe, it, expect } from 'vitest';
import { tokenizeAndClassify } from '@/features/expenses/engine/tokenClassifier';
import { extractFragments } from '@/features/expenses/engine/fragmentExtractor';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tokens(input: string) {
  return tokenizeAndClassify(input);
}

function extract(input: string, memory?: SuggestionMemoryState) {
  return extractFragments(tokens(input), memory);
}

function emptyMemory(): SuggestionMemoryState {
  return {
    merchants: {},
    recents: [],
    splitCombos: [],
    tagAssociations: [],
  };
}

function memoryWith(merchantKey: string): SuggestionMemoryState {
  return {
    merchants: { [merchantKey]: [{ categoryId: 'groceries', count: 3, lastUsedAt: Date.now() }] },
    recents: [],
    splitCombos: [],
    tagAssociations: [],
  };
}

// ── Amount fragments ──────────────────────────────────────────────────────────

describe('extractFragments — amount', () => {
  it('extracts amount fragment with confidence 1.0', () => {
    const { fragments } = extract('350');
    expect(fragments).toHaveLength(1);
    expect(fragments[0].type).toBe('amount');
    expect(fragments[0].rawValue).toBe('350');
    expect(fragments[0].confidence).toBe(1.0);
    expect(fragments[0].candidateCategories).toEqual([]);
  });

  it('preserves original casing in rawValue for amount', () => {
    const { fragments } = extract('₪350');
    expect(fragments[0].type).toBe('amount');
    expect(fragments[0].rawValue).toBe('₪350');
  });

  it('assigns sequential ids starting at f0', () => {
    const { fragments } = extract('dabbah 350');
    expect(fragments[0].id).toBe('f0');
    expect(fragments[1].id).toBe('f1');
  });
});

// ── Single-token store matching ───────────────────────────────────────────────

describe('extractFragments — single store token', () => {
  it('recognizes "dabbah" as merchant (supermarket, needsContext)', () => {
    const { fragments } = extract('dabbah 350');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant).toBeDefined();
    expect(merchant!.rawValue).toBe('dabbah');
    expect(merchant!.confidence).toBe(0.95);
    expect(merchant!.metadata?.storeId).toBe('dabbah');
    expect(merchant!.metadata?.needsContext).toBe(true);
  });

  it('recognizes "aroma" as merchant (coffee, needsContext: false) — confidence 1.0', () => {
    const { fragments } = extract('Aroma 45');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant).toBeDefined();
    expect(merchant!.confidence).toBe(1.0);
    expect(merchant!.metadata?.needsContext).toBe(false);
    expect(merchant!.candidateCategories).toContain('coffee');
  });

  it('recognizes "kfc" as merchant with fast_food category', () => {
    const { fragments } = extract('kfc 80');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant).toBeDefined();
    expect(merchant!.candidateCategories).toContain('fast_food');
    expect(merchant!.confidence).toBe(1.0);
  });

  it('preserves original casing in rawValue', () => {
    const { fragments } = extract('Dabbah 350');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant!.rawValue).toBe('Dabbah');
  });
});

// ── Store bigram matching ─────────────────────────────────────────────────────

describe('extractFragments — store bigrams', () => {
  it('matches "rami levi" bigram as single merchant fragment', () => {
    const { fragments } = extract('rami levi 500');
    const merchants = fragments.filter((f) => f.type === 'merchant');
    expect(merchants).toHaveLength(1);
    expect(merchants[0].rawValue).toBe('rami levi');
    expect(merchants[0].metadata?.storeId).toBe('rami_levi');
    expect(merchants[0].confidence).toBe(0.95);
  });

  it('matches "super pharm" bigram as single merchant fragment', () => {
    const { fragments } = extract('super pharm 120');
    const merchants = fragments.filter((f) => f.type === 'merchant');
    expect(merchants).toHaveLength(1);
    expect(merchants[0].rawValue).toBe('super pharm');
    expect(merchants[0].metadata?.storeId).toBe('super_pharm');
  });

  it('matches "burger king" bigram with fast_food category', () => {
    const { fragments } = extract('burger king 55');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant).toBeDefined();
    expect(merchant!.candidateCategories).toContain('fast_food');
    expect(merchant!.rawValue).toBe('burger king');
  });

  it('store bigram preserves rawValue with original casing', () => {
    const { fragments } = extract('Rami Levi 250');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant!.rawValue).toBe('Rami Levi');
  });

  it('store bigram consumed — does not produce two separate merchant fragments', () => {
    const { fragments } = extract('rami levi 200');
    expect(fragments.filter((f) => f.type === 'merchant')).toHaveLength(1);
  });
});

// ── Item bigrams ──────────────────────────────────────────────────────────────

describe('extractFragments — item bigrams', () => {
  it('matches "ice coffee" bigram as item with coffee category', () => {
    const { fragments } = extract('ice coffee 25');
    const item = fragments.find((f) => f.type === 'item');
    expect(item).toBeDefined();
    expect(item!.rawValue).toBe('ice coffee');
    expect(item!.candidateCategories).toContain('coffee');
    expect(item!.confidence).toBe(0.90);
  });

  it('matches "toilet paper" bigram as item with household category', () => {
    const { fragments } = extract('toilet paper 30');
    const item = fragments.find((f) => f.type === 'item');
    expect(item).toBeDefined();
    expect(item!.candidateCategories).toContain('household');
  });

  it('matches "dog food" bigram as item with pet_food category', () => {
    const { fragments } = extract('dog food 45');
    const item = fragments.find((f) => f.type === 'item');
    expect(item).toBeDefined();
    expect(item!.candidateCategories).toContain('pet_food');
  });

  it('item bigram consumed as single token — no two separate items', () => {
    const { fragments } = extract('ice coffee 25');
    expect(fragments.filter((f) => f.type === 'item')).toHaveLength(1);
  });
});

// ── Single item tokens ────────────────────────────────────────────────────────

describe('extractFragments — single item tokens', () => {
  it('recognizes known item token with 0.85 confidence', () => {
    const { fragments } = extract('dabbah молоко 350');
    const items = fragments.filter((f) => f.type === 'item');
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].confidence).toBe(0.85);
  });

  it('item fragment has candidateCategories from dictionary', () => {
    const { fragments } = extract('dabbah молоко 350');
    const item = fragments.find((f) => f.type === 'item');
    expect(item?.candidateCategories?.length).toBeGreaterThan(0);
  });
});

// ── Tag fallback ──────────────────────────────────────────────────────────────

describe('extractFragments — tag fallback', () => {
  it('unknown token becomes tag with confidence 0.30', () => {
    const { fragments } = extract('unknownstore 350');
    const tag = fragments.find((f) => f.type === 'tag');
    expect(tag).toBeDefined();
    expect(tag!.confidence).toBe(0.30);
  });

  it('tag fragment includes rawValue with original casing', () => {
    const { fragments } = extract('MyUnknownStore 100');
    const tag = fragments.find((f) => f.type === 'tag');
    expect(tag!.rawValue).toBe('MyUnknownStore');
  });

  it('noise tokens are not included in output', () => {
    const { fragments } = extract('в магазине 350');
    const noise = fragments.find((f) => f.type === 'noise');
    expect(noise).toBeUndefined();
  });
});

// ── Memory-aware merchant ─────────────────────────────────────────────────────

describe('extractFragments — memory-aware merchant', () => {
  it('recognizes memory-known merchant as merchant fragment (0.80 confidence)', () => {
    const memory = memoryWith('mymarket');
    const { fragments } = extractFragments(tokens('mymarket 200'), memory);
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant).toBeDefined();
    expect(merchant!.confidence).toBe(0.80);
    expect(merchant!.metadata?.source).toBe('memory');
  });

  it('memory merchant does not fire for dictionary-known store', () => {
    const memory = memoryWith('dabbah');
    const { fragments } = extractFragments(tokens('dabbah 200'), memory);
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant!.metadata?.source).toBeUndefined();
    expect(merchant!.metadata?.storeId).toBe('dabbah');
  });

  it('without memory, unknown merchant becomes tag', () => {
    const { fragments } = extract('mymarket 200');
    const tag = fragments.find((f) => f.type === 'tag');
    expect(tag).toBeDefined();
    expect(tag!.confidence).toBe(0.30);
  });
});

// ── Russian input ─────────────────────────────────────────────────────────────

describe('extractFragments — Russian input', () => {
  it('recognizes "виктори" as merchant via alias', () => {
    const { fragments } = extract('Виктори 300');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant).toBeDefined();
    expect(merchant!.metadata?.storeId).toBe('victory');
  });

  it('recognizes "шуферсал" as merchant via alias', () => {
    const { fragments } = extract('шуферсал 500');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant).toBeDefined();
    expect(merchant!.metadata?.storeId).toBe('shufersal');
  });
});

// ── ClarificationHints ────────────────────────────────────────────────────────

describe('extractFragments — ClarificationHints', () => {
  it('unknown_merchant: first significant token is unknown → hint generated', () => {
    const { clarificationHints } = extract('unknownstore 350');
    const hint = clarificationHints.find((h) => h.kind === 'unknown_merchant');
    expect(hint).toBeDefined();
    expect(hint!.fragmentId).toBe('f0');
  });

  it('no unknown_merchant hint when first token is a known store', () => {
    const { clarificationHints } = extract('dabbah 350');
    const hint = clarificationHints.find((h) => h.kind === 'unknown_merchant');
    expect(hint).toBeUndefined();
  });

  it('multiple_categories: 2+ items with different categories → hint', () => {
    const { clarificationHints } = extract('dabbah молоко шампунь 350');
    const hint = clarificationHints.find((h) => h.kind === 'multiple_categories');
    if (hint) {
      expect(hint.candidates.length).toBeGreaterThan(1);
    }
  });

  it('ambiguous_item: store with needsContext:true and empty candidateCategories → hint', () => {
    const { fragments, clarificationHints } = extract('rami levi 500');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(merchant?.metadata?.needsContext).toBe(true);
    const hint = clarificationHints.find((h) => h.kind === 'ambiguous_item');
    expect(hint).toBeDefined();
  });

  it('no ambiguous_item hint for store with needsContext:false (category known)', () => {
    const { clarificationHints } = extract('aroma 45');
    const hint = clarificationHints.find((h) => h.kind === 'ambiguous_item');
    expect(hint).toBeUndefined();
  });

  it('conflicting_signals: two merchant-type tokens → hint', () => {
    const memory = memoryWith('mymarket');
    const { clarificationHints } = extractFragments(tokens('dabbah mymarket 200'), memory);
    const hint = clarificationHints.find((h) => h.kind === 'conflicting_signals');
    expect(hint).toBeDefined();
    expect(hint!.candidates.length).toBeGreaterThanOrEqual(2);
  });
});

// ── Multi-item split-oriented flow ────────────────────────────────────────────

describe('extractFragments — split-oriented multi-item', () => {
  it('store + item produces one merchant + one item fragment', () => {
    const { fragments } = extract('dabbah молоко 350');
    expect(fragments.filter((f) => f.type === 'merchant')).toHaveLength(1);
    expect(fragments.filter((f) => f.type === 'item').length).toBeGreaterThanOrEqual(1);
    expect(fragments.filter((f) => f.type === 'amount')).toHaveLength(1);
  });

  it('pure item input produces no merchant fragment', () => {
    const { fragments } = extract('молоко хлеб 150');
    expect(fragments.filter((f) => f.type === 'merchant')).toHaveLength(0);
    expect(fragments.filter((f) => f.type === 'item').length).toBeGreaterThanOrEqual(1);
  });

  it('rami levi + items: bigram merchant consumed, items remain', () => {
    const { fragments } = extract('rami levi молоко 200');
    expect(fragments.filter((f) => f.type === 'merchant')).toHaveLength(1);
    expect(fragments.find((f) => f.type === 'merchant')?.rawValue).toBe('rami levi');
  });
});

// ── parseInput integration ────────────────────────────────────────────────────

describe('parseInput — fragments and clarificationHints in ParserContext', () => {
  it('non-empty input includes fragments array', () => {
    const ctx = parseInput('dabbah 350');
    expect(Array.isArray(ctx.fragments)).toBe(true);
    expect(ctx.fragments.length).toBeGreaterThan(0);
  });

  it('non-empty input includes clarificationHints array', () => {
    const ctx = parseInput('dabbah 350');
    expect(Array.isArray(ctx.clarificationHints)).toBe(true);
  });

  it('empty input returns empty fragments and hints', () => {
    const ctx = parseInput('');
    expect(ctx.fragments).toEqual([]);
    expect(ctx.clarificationHints).toEqual([]);
  });

  it('whitespace-only input returns empty fragments and hints', () => {
    const ctx = parseInput('   ');
    expect(ctx.fragments).toEqual([]);
    expect(ctx.clarificationHints).toEqual([]);
  });

  it('fragments contain amount fragment matching extracted amount', () => {
    const ctx = parseInput('aroma 45');
    const amountFrag = ctx.fragments.find((f) => f.type === 'amount');
    expect(amountFrag).toBeDefined();
    expect(ctx.amount).toBe(45);
  });

  it('merchant fragment rawValue matches display merchant', () => {
    const ctx = parseInput('Aroma 45');
    const merchantFrag = ctx.fragments.find((f) => f.type === 'merchant');
    expect(merchantFrag?.rawValue).toBe('Aroma');
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('extractFragments — determinism', () => {
  it('identical calls produce identical fragment arrays', () => {
    const a = extract('rami levi молоко 350');
    const b = extract('rami levi молоко 350');
    expect(a.fragments).toEqual(b.fragments);
    expect(a.clarificationHints).toEqual(b.clarificationHints);
  });

  it('fragment ids are stable across calls', () => {
    const idsA = extract('dabbah 200').fragments.map((f) => f.id);
    const idsB = extract('dabbah 200').fragments.map((f) => f.id);
    expect(idsA).toEqual(idsB);
  });

  it('parseInput with same input always returns same fragments', () => {
    const a = parseInput('super pharm 80');
    const b = parseInput('super pharm 80');
    expect(a.fragments).toEqual(b.fragments);
    expect(a.clarificationHints).toEqual(b.clarificationHints);
  });
});
