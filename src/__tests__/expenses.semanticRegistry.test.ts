/**
 * Tests for semantic registry architecture:
 *   - semanticRegistryBuilder.ts — getSemanticRegistry()
 *   - semanticRegistry.ts        — computePrecedence(), REGISTRY_PRECEDENCE
 *   - parserInspector.ts         — inspectParserOutput(), derivePhraseMatchRule()
 *
 * Coverage:
 *   - Registry builds without errors
 *   - Precedence rules: merchant > phrase > item > modifier > tag
 *   - Longer phrases rank higher than shorter
 *   - Payment phrases outrank item phrases of same length
 *   - Conflict detection: phrase_overlap, merchant_item_conflict, modifier_item_conflict
 *   - Alias index populated correctly
 *   - Parser inspector: phrase explanations, match rules, outcome
 *   - Determinism
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSemanticRegistry,
  resetRegistry,
} from '@/features/expenses/engine/semanticRegistryBuilder';
import {
  computePrecedence,
  REGISTRY_PRECEDENCE,
  type RegistryEntryKind,
  type RegistrySource,
} from '@/features/expenses/engine/semanticRegistry';
import {
  inspectParserOutput,
  explainPhraseMatches,
  listAppliedRules,
  derivePhraseMatchRule,
} from '@/features/expenses/engine/parserInspector';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type { SemanticPhrase } from '@/features/expenses/engine/semanticPhrase';

// ── computePrecedence ─────────────────────────────────────────────────────────

describe('computePrecedence', () => {
  it('merchant > item for same token count and source', () => {
    const merchant = computePrecedence('merchant', 'store_dictionary', 1);
    const item = computePrecedence('item', 'item_dictionary', 1);
    expect(merchant).toBeGreaterThan(item);
  });

  it('item > modifier for same token count', () => {
    const item = computePrecedence('item', 'item_dictionary', 1);
    const modifier = computePrecedence('modifier', 'modifier_set', 1);
    expect(item).toBeGreaterThan(modifier);
  });

  it('modifier > tag for same token count', () => {
    const modifier = computePrecedence('modifier', 'modifier_set', 1);
    const tag = computePrecedence('tag', 'modifier_set', 1);
    expect(modifier).toBeGreaterThan(tag);
  });

  it('bigram (tokenCount=2) > single (tokenCount=1) for same kind', () => {
    const single = computePrecedence('merchant', 'store_dictionary', 1);
    const bigram = computePrecedence('merchant', 'store_dictionary', 2);
    expect(bigram).toBeGreaterThan(single);
    expect(bigram - single).toBe(REGISTRY_PRECEDENCE.tokenCountBonus);
  });

  it('trigram (tokenCount=3) > bigram > single', () => {
    const single = computePrecedence('phrase', 'phrase_table', 1);
    const bigram = computePrecedence('phrase', 'phrase_table', 2);
    const trigram = computePrecedence('phrase', 'phrase_table', 3);
    expect(trigram).toBeGreaterThan(bigram);
    expect(bigram).toBeGreaterThan(single);
  });

  it('payment phrase outranks item phrase of same length', () => {
    const payment = computePrecedence('phrase', 'phrase_table', 2, { isPaymentPhrase: true });
    const item = computePrecedence('phrase', 'phrase_table', 2, { isPaymentPhrase: false });
    expect(payment).toBeGreaterThan(item);
    expect(payment - item).toBe(REGISTRY_PRECEDENCE.paymentPhraseBonus);
  });

  it('user_defined source outranks store_dictionary', () => {
    const userDefined = computePrecedence('merchant', 'user_defined', 1);
    const storeDict = computePrecedence('merchant', 'store_dictionary', 1);
    expect(userDefined).toBeGreaterThan(storeDict);
  });

  it('archived entry has reduced precedence', () => {
    const live = computePrecedence('merchant', 'store_dictionary', 1);
    const archived = computePrecedence('merchant', 'store_dictionary', 1, { archived: true });
    expect(live).toBeGreaterThan(archived);
    expect(live - archived).toBe(REGISTRY_PRECEDENCE.archivedPenalty);
  });

  it('alias outranks tag with same source', () => {
    const alias = computePrecedence('alias', 'alias_map', 1);
    const tag = computePrecedence('tag', 'alias_map', 1);
    expect(alias).toBeGreaterThan(tag);
  });
});

// ── Registry build ────────────────────────────────────────────────────────────

describe('getSemanticRegistry — structure', () => {
  beforeEach(() => resetRegistry());

  it('builds without error', () => {
    expect(() => getSemanticRegistry()).not.toThrow();
  });

  it('returns same instance on repeated calls (singleton)', () => {
    const r1 = getSemanticRegistry();
    const r2 = getSemanticRegistry();
    expect(r1).toBe(r2);
  });

  it('has entries array with merchant, alias, phrase, item, modifier entries', () => {
    const { entries } = getSemanticRegistry();
    const kinds = new Set(entries.map((e) => e.kind));
    expect(kinds.has('merchant')).toBe(true);
    expect(kinds.has('alias')).toBe(true);
    expect(kinds.has('phrase')).toBe(true);
    expect(kinds.has('item')).toBe(true);
    expect(kinds.has('modifier')).toBe(true);
  });

  it('all entries have non-empty tokens[]', () => {
    const { entries } = getSemanticRegistry();
    for (const entry of entries) {
      expect(entry.tokens.length).toBeGreaterThan(0);
    }
  });

  it('all entries have non-negative precedence', () => {
    const { entries } = getSemanticRegistry();
    for (const entry of entries) {
      expect(entry.precedence).toBeGreaterThanOrEqual(0);
    }
  });

  it('all entries have id strings', () => {
    const { entries } = getSemanticRegistry();
    for (const entry of entries) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.length).toBeGreaterThan(0);
    }
  });

  it('no entries are archived by default', () => {
    const { entries } = getSemanticRegistry();
    expect(entries.every((e) => !e.archived)).toBe(true);
  });
});

// ── Index lookups ─────────────────────────────────────────────────────────────

describe('getSemanticRegistry — indexes', () => {
  beforeEach(() => resetRegistry());

  it('singleIndex contains item keywords', () => {
    const { singleIndex } = getSemanticRegistry();
    // milk, bread, coffee are common items in dictionaries
    const hasItemEntry = Object.values(singleIndex).some((e) => e.kind === 'item');
    expect(hasItemEntry).toBe(true);
  });

  it('bigramIndex contains item bigrams', () => {
    const { bigramIndex } = getSemanticRegistry();
    // ice cream is in ITEM_BIGRAM_TABLE
    expect(bigramIndex['ice cream']).toBeDefined();
    expect(bigramIndex['ice cream'].kind).toBe('phrase');
  });

  it('bigramIndex contains payment phrases', () => {
    const { bigramIndex } = getSemanticRegistry();
    expect(bigramIndex['credit card']).toBeDefined();
    expect(bigramIndex['credit card'].kind).toBe('phrase');
    // @ts-expect-error phraseType only on PhraseEntry
    expect(bigramIndex['credit card'].phraseType).toBe('payment');
  });

  it('bigramIndex: credit card is payment, not item (payment has higher precedence)', () => {
    const { bigramIndex } = getSemanticRegistry();
    const entry = bigramIndex['credit card'];
    // @ts-expect-error phraseType only on PhraseEntry
    expect(entry.phraseType).toBe('payment');
  });

  it('aliasIndex contains transliteration aliases', () => {
    const { aliasIndex } = getSemanticRegistry();
    expect(aliasIndex['dabah']).toBe('dabbah');
    expect(aliasIndex['dabach']).toBe('dabbah');
    expect(aliasIndex['виктори']).toBe('victory');
  });

  it('singleIndex: merchant entry outranks item entry for same token', () => {
    const { singleIndex, entries } = getSemanticRegistry();
    // Find any token that appears as both merchant and item
    const merchantTokens = new Set(
      entries.filter((e) => e.kind === 'merchant' && e.tokens.length === 1).map((e) => e.tokens[0]),
    );
    const itemTokens = new Set(
      entries.filter((e) => e.kind === 'item').map((e) => e.tokens[0]),
    );
    const conflicts = [...merchantTokens].filter((t) => itemTokens.has(t));
    for (const token of conflicts) {
      expect(singleIndex[token].kind).toBe('merchant');
    }
  });
});

// ── Conflict detection ────────────────────────────────────────────────────────

describe('getSemanticRegistry — conflicts', () => {
  beforeEach(() => resetRegistry());

  it('conflicts array is an array', () => {
    const { conflicts } = getSemanticRegistry();
    expect(Array.isArray(conflicts)).toBe(true);
  });

  it('phrase_overlap detected for credit card (in both payment and item bigram tables)', () => {
    const { conflicts } = getSemanticRegistry();
    const overlap = conflicts.filter((c) => c.kind === 'phrase_overlap');
    const creditCard = overlap.find((c) => c.tokens.join(' ') === 'credit card');
    // credit card exists in both PAYMENT_PHRASE_TABLE and ITEM_BIGRAM_TABLE → overlap
    expect(creditCard).toBeDefined();
    expect(creditCard!.winnerId).toBeDefined();
  });

  it('phrase_overlap winner has higher precedence than losers', () => {
    const { conflicts, entries } = getSemanticRegistry();
    const overlapConflicts = conflicts.filter(
      (c) => c.kind === 'phrase_overlap' && c.winnerId,
    );
    for (const conflict of overlapConflicts) {
      const winner = entries.find((e) => e.id === conflict.winnerId)!;
      const losers = entries.filter(
        (e) => conflict.entryIds.includes(e.id) && e.id !== conflict.winnerId,
      );
      for (const loser of losers) {
        expect(winner.precedence).toBeGreaterThanOrEqual(loser.precedence);
      }
    }
  });

  it('all conflicts have non-empty message', () => {
    const { conflicts } = getSemanticRegistry();
    for (const c of conflicts) {
      expect(typeof c.message).toBe('string');
      expect(c.message.length).toBeGreaterThan(0);
    }
  });

  it('all conflicts have entryIds array', () => {
    const { conflicts } = getSemanticRegistry();
    for (const c of conflicts) {
      expect(Array.isArray(c.entryIds)).toBe(true);
    }
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('getSemanticRegistry — determinism', () => {
  it('two builds produce identical entry count', () => {
    resetRegistry();
    const r1 = getSemanticRegistry();
    const count1 = r1.entries.length;
    resetRegistry();
    const r2 = getSemanticRegistry();
    expect(r2.entries.length).toBe(count1);
  });

  it('two builds produce identical conflict count', () => {
    resetRegistry();
    const c1 = getSemanticRegistry().conflicts.length;
    resetRegistry();
    const c2 = getSemanticRegistry().conflicts.length;
    expect(c1).toBe(c2);
  });
});

// ── Parser inspector — derivePhraseMatchRule ──────────────────────────────────

describe('derivePhraseMatchRule', () => {
  function makePhrase(
    type: SemanticPhrase['type'],
    tokenCount: number,
    meta: Record<string, unknown> = {},
  ): SemanticPhrase {
    return {
      id: 'p0',
      type,
      rawText: 'test',
      normalizedText: 'test',
      tokenIndexes: Array.from({ length: tokenCount }, (_, i) => i),
      confidence: 0.85,
      metadata: meta,
    };
  }

  it('amount_phrase → amount_token', () => {
    expect(derivePhraseMatchRule(makePhrase('amount_phrase', 1))).toBe('amount_token');
  });

  it('noise_phrase → noise_token', () => {
    expect(derivePhraseMatchRule(makePhrase('noise_phrase', 1))).toBe('noise_token');
  });

  it('merchant_phrase single → store_single', () => {
    expect(derivePhraseMatchRule(makePhrase('merchant_phrase', 1))).toBe('store_single');
  });

  it('merchant_phrase bigram → store_bigram', () => {
    expect(derivePhraseMatchRule(makePhrase('merchant_phrase', 2))).toBe('store_bigram');
  });

  it('merchant_phrase trigram → store_trigram', () => {
    expect(derivePhraseMatchRule(makePhrase('merchant_phrase', 3))).toBe('store_trigram');
  });

  it('merchant_phrase from memory → memory_merchant', () => {
    expect(derivePhraseMatchRule(makePhrase('merchant_phrase', 1, { source: 'memory' }))).toBe(
      'memory_merchant',
    );
  });

  it('payment_phrase → payment_phrase_table', () => {
    expect(derivePhraseMatchRule(makePhrase('payment_phrase', 2))).toBe('payment_phrase_table');
  });

  it('item_phrase single → item_dictionary', () => {
    expect(derivePhraseMatchRule(makePhrase('item_phrase', 1))).toBe('item_dictionary');
  });

  it('item_phrase bigram → item_bigram_table', () => {
    expect(derivePhraseMatchRule(makePhrase('item_phrase', 2))).toBe('item_bigram_table');
  });

  it('modifier_phrase single → standalone_modifier', () => {
    expect(derivePhraseMatchRule(makePhrase('modifier_phrase', 1))).toBe('standalone_modifier');
  });

  it('modifier_phrase bigram → modifier_text_prefix (default)', () => {
    expect(derivePhraseMatchRule(makePhrase('modifier_phrase', 2))).toBe('modifier_text_prefix');
  });

  it('modifier_phrase bigram with prefixKind:noise → modifier_noise_prefix', () => {
    expect(
      derivePhraseMatchRule(makePhrase('modifier_phrase', 2, { prefixKind: 'noise' })),
    ).toBe('modifier_noise_prefix');
  });

  it('tag_phrase → unknown_fallback', () => {
    expect(derivePhraseMatchRule(makePhrase('tag_phrase', 1))).toBe('unknown_fallback');
  });
});

// ── Parser inspector — inspectParserOutput ────────────────────────────────────

describe('inspectParserOutput', () => {
  it('"молоко 100" → phrase explanations non-empty', () => {
    const ctx = parseInput('молоко 100');
    const report = inspectParserOutput(ctx);
    expect(report.phraseExplanations.length).toBeGreaterThan(0);
  });

  it('"молоко 100" → amount_token rule appears in appliedRules', () => {
    const ctx = parseInput('молоко 100');
    const report = inspectParserOutput(ctx);
    expect(report.appliedRules).toContain('amount_token');
  });

  it('empty input → outcome: empty', () => {
    const ctx = parseInput('');
    const report = inspectParserOutput(ctx);
    expect(report.outcome).toBe('empty');
  });

  it('input with clarification hint → outcome: ambiguous', () => {
    // An unknown word with amount triggers unknown_merchant clarification
    const ctx = parseInput('xyzunknown 350');
    const report = inspectParserOutput(ctx);
    // If clarification was triggered, outcome is ambiguous
    if (ctx.clarificationHints.length > 0) {
      expect(report.outcome).toBe('ambiguous');
    } else {
      expect(report.outcome).toBe('confident');
    }
  });

  it('"ice cream 50" → phrase explanations contain item_bigram_table rule', () => {
    const ctx = parseInput('ice cream 50');
    const report = inspectParserOutput(ctx);
    const hasItemBigram = report.phraseExplanations.some(
      (e) => e.matchedRule === 'item_bigram_table',
    );
    expect(hasItemBigram).toBe(true);
  });

  it('"credit card 100" → phrase explanations contain payment_phrase_table rule', () => {
    const ctx = parseInput('credit card 100');
    const report = inspectParserOutput(ctx);
    const hasPayment = report.phraseExplanations.some(
      (e) => e.matchedRule === 'payment_phrase_table',
    );
    expect(hasPayment).toBe(true);
  });

  it('"rami levi milk 200" → store_bigram rule in appliedRules', () => {
    const ctx = parseInput('rami levi milk 200');
    const report = inspectParserOutput(ctx);
    expect(report.appliedRules).toContain('store_bigram');
  });

  it('fragment explanations length matches fragments length', () => {
    const ctx = parseInput('milk 100');
    const report = inspectParserOutput(ctx);
    expect(report.fragmentExplanations.length).toBe(ctx.fragments.length);
  });

  it('scope explanations length matches scopes length', () => {
    const ctx = parseInput('milk without sugar 100');
    const report = inspectParserOutput(ctx);
    expect(report.scopeExplanations.length).toBe(ctx.scopes.length);
  });

  it('raw field preserved in report', () => {
    const input = 'coffee 250';
    const ctx = parseInput(input);
    const report = inspectParserOutput(ctx);
    expect(report.raw).toBe(input);
  });

  it('report is deterministic — same input → same report', () => {
    const input = 'ice cream without sugar 150';
    const ctx1 = parseInput(input);
    const ctx2 = parseInput(input);
    const r1 = inspectParserOutput(ctx1);
    const r2 = inspectParserOutput(ctx2);
    expect(r1).toEqual(r2);
  });
});

// ── explainPhraseMatches ──────────────────────────────────────────────────────

describe('explainPhraseMatches', () => {
  it('returns array of PhraseExplanation', () => {
    const ctx = parseInput('milk 100');
    const explanations = explainPhraseMatches(ctx);
    expect(Array.isArray(explanations)).toBe(true);
    expect(explanations.length).toBe(ctx.phrases.length);
  });

  it('each explanation has phraseId matching ctx.phrases', () => {
    const ctx = parseInput('milk 100');
    const explanations = explainPhraseMatches(ctx);
    const phraseIds = ctx.phrases.map((p) => p.id);
    for (const exp of explanations) {
      expect(phraseIds).toContain(exp.phraseId);
    }
  });
});

// ── listAppliedRules ──────────────────────────────────────────────────────────

describe('listAppliedRules', () => {
  it('returns unique rules only (no duplicates)', () => {
    const ctx = parseInput('milk milk 100');
    const rules = listAppliedRules(ctx);
    expect(rules.length).toBe(new Set(rules).size);
  });

  it('empty input → empty rules', () => {
    const ctx = parseInput('');
    const rules = listAppliedRules(ctx);
    expect(rules).toHaveLength(0);
  });
});
