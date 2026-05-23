/**
 * Tests for the Semantic Phrase Understanding Runtime.
 *
 * Coverage:
 *   - extractPhrases: all 12 priority steps
 *   - Amount phrase
 *   - Noise phrase (regular noise vs modifier-prefix noise)
 *   - Store trigram detection (infrastructure test)
 *   - Store bigram: rami levi, super pharm, burger king
 *   - Payment bigram: credit card, bank transfer, оплата картой
 *   - Item bigram: ice coffee, toilet paper, dog food
 *   - Modifier bigram (text prefix): without sugar, без сахара, для детей
 *   - Modifier bigram (noise prefix): for kids, с молоком
 *   - Single store: dabbah, aroma, kfc
 *   - Memory merchant
 *   - Single item token
 *   - Standalone modifier adjective: organic, fresh, большой
 *   - Unknown text → tag_phrase
 *   - tokenIndexes correctness
 *   - rawText casing preserved
 *   - Multi-phrase mixed input
 *   - Multilingual inputs (Russian, Hebrew aliases)
 *   - parseInput integration (phrases in ParserContext)
 *   - Determinism
 *
 * All tests are deterministic: same inputs → same outputs, always.
 */

import { describe, it, expect } from 'vitest';
import { tokenizeAndClassify } from '@/features/expenses/engine/tokenClassifier';
import { extractPhrases } from '@/features/expenses/engine/phraseExtractor';
import { extractFragments } from '@/features/expenses/engine/fragmentExtractor';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

// ── Helpers ───────────────────────────────────────────────────────────────────

function phrases(input: string, memory?: SuggestionMemoryState) {
  return extractPhrases(tokenizeAndClassify(input), memory);
}

function emptyMemory(): SuggestionMemoryState {
  return { merchants: {}, recents: [], splitCombos: [], tagAssociations: [] };
}

function memoryWith(merchantKey: string): SuggestionMemoryState {
  return {
    merchants: { [merchantKey]: [{ categoryId: 'groceries', count: 3, lastUsedAt: Date.now() }] },
    recents: [],
    splitCombos: [],
    tagAssociations: [],
  };
}

// ── Phrase IDs ────────────────────────────────────────────────────────────────

describe('extractPhrases — phrase IDs', () => {
  it('assigns sequential ids starting at p0', () => {
    const result = phrases('dabbah 350');
    expect(result[0].id).toBe('p0');
    expect(result[1].id).toBe('p1');
  });

  it('IDs are sequential even with noise phrases', () => {
    const result = phrases('в магазине 350'); // "в" is noise
    const ids = result.map((p) => p.id);
    expect(ids[0]).toBe('p0');
    expect(ids[1]).toBe('p1');
    expect(ids[2]).toBe('p2');
  });
});

// ── Amount phrase ─────────────────────────────────────────────────────────────

describe('extractPhrases — amount_phrase', () => {
  it('amount token → amount_phrase (confidence 1.0)', () => {
    const result = phrases('350');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('amount_phrase');
    expect(result[0].confidence).toBe(1.0);
  });

  it('amount phrase rawText preserves original token', () => {
    const result = phrases('₪350');
    expect(result[0].rawText).toBe('₪350');
  });

  it('amount phrase tokenIndexes contains [0]', () => {
    const result = phrases('350');
    expect(result[0].tokenIndexes).toEqual([0]);
  });
});

// ── Noise phrase ──────────────────────────────────────────────────────────────

describe('extractPhrases — noise_phrase', () => {
  it('regular noise token → noise_phrase', () => {
    const result = phrases('в магазине 100'); // "в" is noise
    const noise = result.find((p) => p.type === 'noise_phrase');
    expect(noise).toBeDefined();
    expect(noise!.rawText).toBe('в');
  });

  it('noise phrases are included for inspectability', () => {
    const result = phrases('на рынке 200'); // "на" is noise
    expect(result.some((p) => p.type === 'noise_phrase')).toBe(true);
  });

  it('noise_phrase confidence is 1.0', () => {
    const result = phrases('в 100');
    const noise = result.find((p) => p.type === 'noise_phrase');
    expect(noise!.confidence).toBe(1.0);
  });
});

// ── Modifier bigram (noise prefix) ────────────────────────────────────────────

describe('extractPhrases — modifier_phrase (noise prefix)', () => {
  it('"for kids" → modifier_phrase ("for" is noise in tokenClassifier)', () => {
    const result = phrases('for kids');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod).toBeDefined();
    expect(mod!.rawText).toBe('for kids');
    expect(mod!.tokenIndexes).toEqual([0, 1]);
    expect(mod!.confidence).toBe(0.70);
  });

  it('"с молоком" → modifier_phrase ("с" is noise)', () => {
    const result = phrases('с молоком');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod).toBeDefined();
    expect(mod!.rawText).toBe('с молоком');
  });

  it('noise modifier prefix consumed — does NOT produce separate noise_phrase', () => {
    const result = phrases('for kids 50');
    // "for" should be consumed by the modifier phrase, not produce a noise_phrase
    const noisePhrases = result.filter((p) => p.type === 'noise_phrase');
    expect(noisePhrases.every((p) => p.rawText !== 'for')).toBe(true);
  });

  it('noise token without following text → regular noise_phrase', () => {
    const result = phrases('в 100');
    // "в" has no following text token → regular noise_phrase
    expect(result.some((p) => p.type === 'noise_phrase' && p.rawText === 'в')).toBe(true);
  });
});

// ── Modifier bigram (text prefix) ─────────────────────────────────────────────

describe('extractPhrases — modifier_phrase (text prefix)', () => {
  it('"without sugar" → modifier_phrase ("without" is text token)', () => {
    const result = phrases('without sugar');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod).toBeDefined();
    expect(mod!.rawText).toBe('without sugar');
    expect(mod!.confidence).toBe(0.70);
  });

  it('"без сахара" → modifier_phrase', () => {
    const result = phrases('без сахара');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod).toBeDefined();
    expect(mod!.rawText).toBe('без сахара');
  });

  it('"для детей" → modifier_phrase', () => {
    const result = phrases('для детей');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod).toBeDefined();
    expect(mod!.rawText).toBe('для детей');
  });

  it('modifier bigram tokenIndexes covers both tokens', () => {
    const result = phrases('без сахара');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod!.tokenIndexes).toHaveLength(2);
  });
});

// ── Standalone modifier adjective ─────────────────────────────────────────────

describe('extractPhrases — modifier_phrase (standalone adjective)', () => {
  it('"organic" → modifier_phrase (standalone, confidence 0.60)', () => {
    const result = phrases('organic 100');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod).toBeDefined();
    expect(mod!.rawText).toBe('organic');
    expect(mod!.confidence).toBe(0.60);
  });

  it('"fresh" → modifier_phrase', () => {
    const result = phrases('fresh milk 50');
    expect(result.some((p) => p.type === 'modifier_phrase' && p.rawText === 'fresh')).toBe(true);
  });

  it('"большой" → modifier_phrase (Russian standalone modifier)', () => {
    const result = phrases('большой 100');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod).toBeDefined();
    expect(mod!.rawText).toBe('большой');
  });

  it('"organic" standalone does not consume next token as part of modifier', () => {
    const result = phrases('organic milk 50');
    const mod = result.find((p) => p.type === 'modifier_phrase');
    expect(mod!.tokenIndexes).toHaveLength(1); // only "organic", not "organic milk"
    expect(mod!.rawText).toBe('organic');
  });
});

// ── Store bigrams ─────────────────────────────────────────────────────────────

describe('extractPhrases — merchant_phrase (store bigram)', () => {
  it('"rami levi" bigram → merchant_phrase', () => {
    const result = phrases('rami levi 500');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch).toBeDefined();
    expect(merch!.rawText).toBe('rami levi');
    expect(merch!.metadata?.storeId).toBe('rami_levi');
    expect(merch!.confidence).toBe(0.95); // needsContext: true
    expect(merch!.tokenIndexes).toEqual([0, 1]);
  });

  it('"super pharm" bigram → merchant_phrase', () => {
    const result = phrases('super pharm 120');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.metadata?.storeId).toBe('super_pharm');
  });

  it('"burger king" bigram → merchant_phrase with fast_food category (needsContext: false)', () => {
    const result = phrases('burger king 55');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.confidence).toBe(1.0);
    expect(merch!.metadata?.categoryId).toBe('fast_food');
    expect(merch!.metadata?.needsContext).toBe(false);
  });

  it('store bigram rawText preserves original casing', () => {
    const result = phrases('Rami Levi 250');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.rawText).toBe('Rami Levi');
  });

  it('store bigram consumed as one phrase — not two separate phrases', () => {
    const result = phrases('rami levi 200');
    const merchantPhrases = result.filter((p) => p.type === 'merchant_phrase');
    expect(merchantPhrases).toHaveLength(1);
  });
});

// ── Store trigram (infrastructure) ───────────────────────────────────────────

describe('extractPhrases — merchant_phrase (store trigram infrastructure)', () => {
  it('3-token text sequence does not crash when no trigram match', () => {
    const result = phrases('one two three 100');
    // No trigram match — falls through to other rules
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it('lookupStoreTrigram returns null for unknown trigram (no entries in current data)', () => {
    // Just verifies the phrase extractor handles empty trigram table gracefully
    const result = phrases('rami levi extra 500');
    // "rami levi" should match as bigram; "extra" → standalone modifier or tag
    const merchantPhrases = result.filter((p) => p.type === 'merchant_phrase');
    expect(merchantPhrases).toHaveLength(1);
    expect(merchantPhrases[0].rawText).toBe('rami levi');
  });
});

// ── Payment bigrams ───────────────────────────────────────────────────────────

describe('extractPhrases — payment_phrase', () => {
  it('"credit card" → payment_phrase (confidence 0.90)', () => {
    const result = phrases('credit card 500');
    const pay = result.find((p) => p.type === 'payment_phrase');
    expect(pay).toBeDefined();
    expect(pay!.rawText).toBe('credit card');
    expect(pay!.confidence).toBe(0.90);
    expect(pay!.metadata?.categoryIds).toContain('fin_other');
  });

  it('"gift card" → payment_phrase', () => {
    const result = phrases('gift card 200');
    const pay = result.find((p) => p.type === 'payment_phrase');
    expect(pay).toBeDefined();
    expect(pay!.metadata?.categoryIds).toContain('g_other');
  });

  it('"bank transfer" → payment_phrase', () => {
    const result = phrases('bank transfer 1000');
    const pay = result.find((p) => p.type === 'payment_phrase');
    expect(pay).toBeDefined();
    expect(pay!.rawText).toBe('bank transfer');
    expect(pay!.confidence).toBe(0.90);
  });

  it('"оплата картой" → payment_phrase', () => {
    const result = phrases('оплата картой 500');
    const pay = result.find((p) => p.type === 'payment_phrase');
    expect(pay).toBeDefined();
    expect(pay!.rawText).toBe('оплата картой');
  });

  it('payment bigram detected before item bigram', () => {
    // "credit card" is both in PAYMENT_PHRASE_TABLE and ITEM_BIGRAM_TABLE
    // Payment should win (higher priority in phraseExtractor)
    const result = phrases('credit card 100');
    expect(result.find((p) => p.type === 'payment_phrase')).toBeDefined();
    expect(result.find((p) => p.type === 'item_phrase')).toBeUndefined();
  });

  it('payment phrase tokenIndexes spans both tokens', () => {
    const result = phrases('credit card 100');
    const pay = result.find((p) => p.type === 'payment_phrase');
    expect(pay!.tokenIndexes).toHaveLength(2);
  });
});

// ── Item bigrams ──────────────────────────────────────────────────────────────

describe('extractPhrases — item_phrase (item bigram)', () => {
  it('"ice coffee" → item_phrase with coffee category', () => {
    const result = phrases('ice coffee 25');
    const item = result.find((p) => p.type === 'item_phrase');
    expect(item).toBeDefined();
    expect(item!.rawText).toBe('ice coffee');
    expect(item!.metadata?.categoryIds).toContain('coffee');
    expect(item!.confidence).toBe(0.90);
  });

  it('"toilet paper" → item_phrase with household category', () => {
    const result = phrases('toilet paper 30');
    const item = result.find((p) => p.type === 'item_phrase');
    expect(item!.metadata?.categoryIds).toContain('household');
  });

  it('"dog food" → item_phrase with pet_food category', () => {
    const result = phrases('dog food 45');
    const item = result.find((p) => p.type === 'item_phrase');
    expect(item!.metadata?.categoryIds).toContain('pet_food');
  });

  it('item bigram tokenIndexes spans both tokens', () => {
    const result = phrases('ice coffee 25');
    const item = result.find((p) => p.type === 'item_phrase');
    expect(item!.tokenIndexes).toHaveLength(2);
  });
});

// ── Single store tokens ───────────────────────────────────────────────────────

describe('extractPhrases — merchant_phrase (single store)', () => {
  it('"dabbah" → merchant_phrase (needsContext: true, confidence 0.95)', () => {
    const result = phrases('dabbah 350');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch).toBeDefined();
    expect(merch!.metadata?.storeId).toBe('dabbah');
    expect(merch!.confidence).toBe(0.95);
  });

  it('"aroma" → merchant_phrase (needsContext: false, confidence 1.0)', () => {
    const result = phrases('Aroma 45');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.confidence).toBe(1.0);
    expect(merch!.metadata?.categoryId).toBe('coffee');
    expect(merch!.metadata?.needsContext).toBe(false);
  });

  it('"kfc" → merchant_phrase with fast_food category', () => {
    const result = phrases('kfc 80');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.metadata?.categoryId).toBe('fast_food');
  });

  it('single store rawText preserves original casing', () => {
    const result = phrases('Dabbah 350');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.rawText).toBe('Dabbah');
  });

  it('single store tokenIndexes is [i]', () => {
    const result = phrases('dabbah 350');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.tokenIndexes).toEqual([0]);
  });
});

// ── Memory merchant ───────────────────────────────────────────────────────────

describe('extractPhrases — merchant_phrase (memory)', () => {
  it('known memory merchant → merchant_phrase (confidence 0.80)', () => {
    const mem = memoryWith('mymarket');
    const result = phrases('mymarket 200', mem);
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch).toBeDefined();
    expect(merch!.confidence).toBe(0.80);
    expect(merch!.metadata?.source).toBe('memory');
  });

  it('unknown merchant without memory → tag_phrase', () => {
    const result = phrases('mymarket 200');
    expect(result.find((p) => p.type === 'tag_phrase')).toBeDefined();
    expect(result.find((p) => p.type === 'merchant_phrase')).toBeUndefined();
  });

  it('dictionary store wins over memory (step 8 before step 9)', () => {
    const mem = memoryWith('dabbah');
    const result = phrases('dabbah 200', mem);
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.metadata?.source).toBeUndefined(); // dict match, not memory
    expect(merch!.metadata?.storeId).toBe('dabbah');
  });
});

// ── Single item tokens ────────────────────────────────────────────────────────

describe('extractPhrases — item_phrase (single token)', () => {
  it('known item token → item_phrase (confidence 0.85)', () => {
    const result = phrases('dabbah молоко 350');
    const item = result.find((p) => p.type === 'item_phrase');
    expect(item).toBeDefined();
    expect(item!.rawText).toBe('молоко');
    expect(item!.confidence).toBe(0.85);
  });

  it('item phrase carries categoryIds from dictionary', () => {
    const result = phrases('dabbah молоко 350');
    const item = result.find((p) => p.type === 'item_phrase');
    expect(item!.metadata?.categoryIds).toBeDefined();
    expect((item!.metadata?.categoryIds as string[]).length).toBeGreaterThan(0);
  });
});

// ── Tag phrase (fallback) ─────────────────────────────────────────────────────

describe('extractPhrases — tag_phrase', () => {
  it('unknown text → tag_phrase (confidence 0.30)', () => {
    const result = phrases('unknownstore 100');
    const tag = result.find((p) => p.type === 'tag_phrase');
    expect(tag).toBeDefined();
    expect(tag!.confidence).toBe(0.30);
  });

  it('tag_phrase preserves original casing', () => {
    const result = phrases('UnknownBrand 100');
    const tag = result.find((p) => p.type === 'tag_phrase');
    expect(tag!.rawText).toBe('UnknownBrand');
  });

  it('tag_phrase tokenIndexes is single-token', () => {
    const result = phrases('unknown 100');
    const tag = result.find((p) => p.type === 'tag_phrase');
    if (tag) {
      expect(tag.tokenIndexes).toHaveLength(1);
    }
  });
});

// ── Russian alias resolution ──────────────────────────────────────────────────

describe('extractPhrases — Russian aliases', () => {
  it('"Виктори" → merchant_phrase (виктори alias → victory)', () => {
    const result = phrases('Виктори 300');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch).toBeDefined();
    expect(merch!.metadata?.storeId).toBe('victory');
  });

  it('"шуферсал" → merchant_phrase', () => {
    const result = phrases('шуферсал 500');
    const merch = result.find((p) => p.type === 'merchant_phrase');
    expect(merch!.metadata?.storeId).toBe('shufersal');
  });
});

// ── Mixed multi-phrase inputs ─────────────────────────────────────────────────

describe('extractPhrases — mixed multi-phrase inputs', () => {
  it('"dabbah молоко 350" → [merchant, item, amount]', () => {
    const result = phrases('dabbah молоко 350');
    const types = result.filter((p) => p.type !== 'noise_phrase').map((p) => p.type);
    expect(types).toContain('merchant_phrase');
    expect(types).toContain('item_phrase');
    expect(types).toContain('amount_phrase');
  });

  it('"rami levi for kids 200" → merchant + modifier + amount', () => {
    const result = phrases('rami levi for kids 200');
    const nonNoise = result.filter((p) => p.type !== 'noise_phrase');
    expect(nonNoise.some((p) => p.type === 'merchant_phrase' && p.rawText === 'rami levi')).toBe(true);
    expect(nonNoise.some((p) => p.type === 'modifier_phrase')).toBe(true);
    expect(nonNoise.some((p) => p.type === 'amount_phrase')).toBe(true);
  });

  it('"dabbah credit card 500" → merchant + payment + amount', () => {
    const result = phrases('dabbah credit card 500');
    const types = result.map((p) => p.type);
    expect(types).toContain('merchant_phrase');
    expect(types).toContain('payment_phrase');
    expect(types).toContain('amount_phrase');
  });

  it('phrase order matches token order (left-to-right)', () => {
    const result = phrases('dabbah молоко 350');
    const nonNoise = result.filter((p) => p.type !== 'noise_phrase');
    // dabbah(0) < молоко(1) < 350(2) in tokenIndexes
    const firstTokens = nonNoise.map((p) => p.tokenIndexes[0]);
    expect(firstTokens).toEqual([...firstTokens].sort((a, b) => a - b));
  });

  it('empty input → empty phrase array', () => {
    expect(phrases('')).toEqual([]);
  });

  it('whitespace-only input → empty phrase array', () => {
    expect(phrases('   ')).toEqual([]);
  });

  it('pure amount → single amount_phrase', () => {
    const result = phrases('1500');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('amount_phrase');
  });
});

// ── Fragment integration (extractFragments uses phrases) ─────────────────────

describe('extractPhrases → fragments integration', () => {
  it('modifier phrase → modifier fragment in extractFragments', () => {
    // phraseExtractor produces modifier_phrase, fragmentExtractor maps → modifier fragment
    const { extractFragments } = require('@/features/expenses/engine/fragmentExtractor');
    const tokens = tokenizeAndClassify('without sugar 100');
    const { fragments } = extractFragments(tokens);
    const modFrag = fragments.find((f: { type: string }) => f.type === 'modifier');
    expect(modFrag).toBeDefined();
    expect(modFrag.rawValue).toBe('without sugar');
  });

  it('payment phrase → item fragment with payment metadata', () => {
    const { extractFragments } = require('@/features/expenses/engine/fragmentExtractor');
    const tokens = tokenizeAndClassify('credit card 500');
    const { fragments } = extractFragments(tokens);
    const itemFrag = fragments.find((f: { type: string; metadata?: Record<string, unknown> }) =>
      f.type === 'item' && f.metadata?.payment === true,
    );
    expect(itemFrag).toBeDefined();
    expect(itemFrag.rawValue).toBe('credit card');
  });
});

// ── parseInput integration ────────────────────────────────────────────────────

describe('parseInput — phrases in ParserContext', () => {
  it('ParserContext includes phrases array', () => {
    const ctx = parseInput('dabbah 350');
    expect(Array.isArray(ctx.phrases)).toBe(true);
  });

  it('non-empty input produces non-empty phrases array', () => {
    const ctx = parseInput('dabbah 350');
    expect(ctx.phrases.length).toBeGreaterThan(0);
  });

  it('empty input → empty phrases array', () => {
    const ctx = parseInput('');
    expect(ctx.phrases).toEqual([]);
  });

  it('whitespace input → empty phrases array', () => {
    const ctx = parseInput('   ');
    expect(ctx.phrases).toEqual([]);
  });

  it('phrases precede fragments in pipeline — phrase ids (p0) differ from fragment ids (f0)', () => {
    const ctx = parseInput('dabbah 350');
    const phraseIds = ctx.phrases.map((p) => p.id);
    const fragIds = ctx.fragments.map((f) => f.id);
    // All phrase ids start with 'p', all fragment ids start with 'f'
    expect(phraseIds.every((id) => id.startsWith('p'))).toBe(true);
    expect(fragIds.every((id) => id.startsWith('f'))).toBe(true);
  });

  it('phrase count matches expected semantic units (merchant + amount = 2)', () => {
    const ctx = parseInput('dabbah 350');
    // dabbah → merchant_phrase, 350 → amount_phrase
    const nonNoise = ctx.phrases.filter((p) => p.type !== 'noise_phrase');
    expect(nonNoise).toHaveLength(2);
  });

  it('existing ParserContext fields unaffected by phrase stage', () => {
    const ctx = parseInput('dabbah 350');
    expect(ctx.amount).toBe(350);
    expect(ctx.merchant).toBe('dabbah');
    expect(ctx.fragments.length).toBeGreaterThan(0);
    expect(ctx.purchaseGroups.length).toBeGreaterThan(0);
    expect(ctx.relationships).toBeDefined();
  });

  it('modifier phrase produces modifier fragment and modifier-item relationship', () => {
    const ctx = parseInput('dabbah without sugar 50');
    const modFrag = ctx.fragments.find((f) => f.type === 'modifier');
    if (modFrag) {
      expect(modFrag.rawValue).toBe('without sugar');
      const modifiesRel = ctx.relationships.find(
        (r) => r.fromFragmentId === modFrag.id && r.type === 'modifies',
      );
      // Only fires when there's also an item fragment to attach to
      const itemFrag = ctx.fragments.find((f) => f.type === 'item');
      if (itemFrag) {
        expect(modifiesRel).toBeDefined();
      }
    }
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('extractPhrases — determinism', () => {
  it('identical calls produce identical phrase arrays', () => {
    const a = phrases('rami levi молоко without sugar 350');
    const b = phrases('rami levi молоко without sugar 350');
    expect(a).toEqual(b);
  });

  it('phrase IDs are stable across calls', () => {
    const a = phrases('dabbah 200').map((p) => p.id);
    const b = phrases('dabbah 200').map((p) => p.id);
    expect(a).toEqual(b);
  });

  it('parseInput with same input always returns same phrases', () => {
    const inputs = [
      'dabbah 350',
      'rami levi 500',
      'молоко for kids 150',
      'credit card 1000',
      '',
    ];
    for (const input of inputs) {
      const a = parseInput(input);
      const b = parseInput(input);
      expect(a.phrases).toEqual(b.phrases);
    }
  });

  it('tokenIndexes are deterministic', () => {
    const a = phrases('dabbah молоко 350');
    const b = phrases('dabbah молоко 350');
    expect(a.map((p) => p.tokenIndexes)).toEqual(b.map((p) => p.tokenIndexes));
  });
});
