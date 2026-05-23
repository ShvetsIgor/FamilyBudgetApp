/**
 * Tests for scopeResolver.ts — Semantic Scope & Phrase Resolution Runtime.
 *
 * Coverage:
 *  - Single root phrase → single scope
 *  - Multiple roots → each becomes a scope
 *  - Modifier attaches to nearest root
 *  - Equidistant modifier → ambiguous_modifier_target hint + lower-index wins
 *  - No roots + modifier → orphan_modifier hint
 *  - Tag phrases attach as relatedPhraseIds
 *  - amount_phrase and noise_phrase are ignored
 *  - Mixed real-world inputs via parseInput integration
 *  - Determinism
 */

import { describe, it, expect } from 'vitest';
import { buildSemanticScopes } from '@/features/expenses/engine/scopeResolver';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type { SemanticPhrase } from '@/features/expenses/engine/semanticPhrase';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePhrase(
  id: string,
  type: SemanticPhrase['type'],
  rawText: string,
  confidence = 0.85,
): SemanticPhrase {
  return {
    id,
    type,
    rawText,
    normalizedText: rawText.toLowerCase(),
    tokenIndexes: [],
    confidence,
  };
}

// ── Single scope ──────────────────────────────────────────────────────────────

describe('buildSemanticScopes — single root', () => {
  it('single item_phrase → one item_scope', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk', 0.85),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].id).toBe('s0');
    expect(scopes[0].type).toBe('item_scope');
    expect(scopes[0].rootPhraseId).toBe('p0');
    expect(scopes[0].modifierPhraseIds).toEqual([]);
    expect(scopes[0].relatedPhraseIds).toEqual([]);
    expect(scopes[0].confidence).toBe(0.85);
    expect(scopeHints).toHaveLength(0);
  });

  it('single payment_phrase → one payment_scope', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'payment_phrase', 'credit card', 0.90),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].type).toBe('payment_scope');
    expect(scopes[0].confidence).toBe(0.90);
  });

  it('single merchant_phrase → one merchant_scope', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'merchant_phrase', 'Walmart', 1.0),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].type).toBe('merchant_scope');
  });

  it('amount_phrase alone → no scopes, no hints', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'amount_phrase', '350', 1.0),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(0);
    expect(scopeHints).toHaveLength(0);
  });

  it('noise_phrase alone → no scopes, no hints', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'noise_phrase', 'the', 1.0),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(0);
    expect(scopeHints).toHaveLength(0);
  });

  it('empty phrase array → empty result', () => {
    const { scopes, scopeHints } = buildSemanticScopes([]);
    expect(scopes).toHaveLength(0);
    expect(scopeHints).toHaveLength(0);
  });
});

// ── Multiple roots ────────────────────────────────────────────────────────────

describe('buildSemanticScopes — multiple roots', () => {
  it('two item phrases → two scopes', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'item_phrase', 'bread'),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(2);
    expect(scopes[0].id).toBe('s0');
    expect(scopes[1].id).toBe('s1');
    expect(scopes[0].rootPhraseId).toBe('p0');
    expect(scopes[1].rootPhraseId).toBe('p1');
  });

  it('merchant + item → two scopes (merchant_scope + item_scope)', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'merchant_phrase', 'Walmart', 1.0),
      makePhrase('p1', 'item_phrase', 'milk', 0.85),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(2);
    expect(scopes[0].type).toBe('merchant_scope');
    expect(scopes[1].type).toBe('item_scope');
  });

  it('scopes preserve phrase order', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'coffee', 0.85),
      makePhrase('p1', 'payment_phrase', 'credit card', 0.90),
      makePhrase('p2', 'item_phrase', 'bread', 0.85),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes.map((s) => s.rootPhraseId)).toEqual(['p0', 'p1', 'p2']);
    expect(scopes.map((s) => s.type)).toEqual(['item_scope', 'payment_scope', 'item_scope']);
  });
});

// ── Modifier attachment ───────────────────────────────────────────────────────

describe('buildSemanticScopes — modifier attachment', () => {
  it('modifier after single item → attached to that item scope', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'coffee'),
      makePhrase('p1', 'modifier_phrase', 'without sugar'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes[0].modifierPhraseIds).toEqual(['p1']);
    expect(scopeHints).toHaveLength(0);
  });

  it('modifier before single item → attached to that item scope', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'modifier_phrase', 'organic'),
      makePhrase('p1', 'item_phrase', 'milk'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes[0].modifierPhraseIds).toEqual(['p0']);
    expect(scopeHints).toHaveLength(0);
  });

  it('modifier between two items → attaches to nearest (lower distance wins)', () => {
    // p0=item(index0), p1=modifier(index1), p2=item(index2)
    // dist to p0 = 1, dist to p2 = 1 → equidistant → lower index (p0) wins + hint
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'modifier_phrase', 'organic'),
      makePhrase('p2', 'item_phrase', 'bread'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    // Lower-index root wins
    expect(scopes[0].modifierPhraseIds).toContain('p1');
    expect(scopes[1].modifierPhraseIds).not.toContain('p1');
    // Ambiguous hint emitted
    expect(scopeHints).toHaveLength(1);
    expect(scopeHints[0].kind).toBe('ambiguous_modifier_target');
    expect(scopeHints[0].phraseId).toBe('p1');
  });

  it('modifier closer to second item → attaches to second item', () => {
    // p0=item(index0), p1=item(index1), p2=modifier(index2)
    // dist p2→p0 = 2, dist p2→p1 = 1 → p1 wins, no hint
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'item_phrase', 'bread'),
      makePhrase('p2', 'modifier_phrase', 'without crust'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes[0].modifierPhraseIds).toEqual([]);
    expect(scopes[1].modifierPhraseIds).toEqual(['p2']);
    expect(scopeHints).toHaveLength(0);
  });

  it('modifier closer to first item → attaches to first item', () => {
    // p0=modifier(index0), p1=item(index1), p2=item(index2)
    // dist p0→p1 = 1, dist p0→p2 = 2 → p1 wins
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'modifier_phrase', 'small'),
      makePhrase('p1', 'item_phrase', 'milk'),
      makePhrase('p2', 'item_phrase', 'bread'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes[0].modifierPhraseIds).toEqual(['p0']);
    expect(scopes[1].modifierPhraseIds).toEqual([]);
    expect(scopeHints).toHaveLength(0);
  });

  it('multiple modifiers — each attaches independently', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'modifier_phrase', 'organic'),
      makePhrase('p1', 'item_phrase', 'milk'),
      makePhrase('p2', 'modifier_phrase', 'without sugar'),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    // p0: dist to p1 = 1; p2: dist to p1 = 1 → both attach to p1 (only scope)
    expect(scopes[0].modifierPhraseIds).toContain('p0');
    expect(scopes[0].modifierPhraseIds).toContain('p2');
  });

  it('modifier with no scopes → orphan_modifier hint', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'modifier_phrase', 'organic'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(0);
    expect(scopeHints).toHaveLength(1);
    expect(scopeHints[0].kind).toBe('orphan_modifier');
    expect(scopeHints[0].phraseId).toBe('p0');
    expect(scopeHints[0].candidates).toEqual([]);
  });

  it('modifier after amount_phrase only → orphan_modifier hint', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'amount_phrase', '100'),
      makePhrase('p1', 'modifier_phrase', 'organic'),
    ];
    const { scopeHints } = buildSemanticScopes(phrases);
    expect(scopeHints).toHaveLength(1);
    expect(scopeHints[0].kind).toBe('orphan_modifier');
  });
});

// ── Tag phrase attachment ─────────────────────────────────────────────────────

describe('buildSemanticScopes — tag phrase attachment', () => {
  it('tag_phrase after single item → relatedPhraseIds', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'tag_phrase', 'неизвестно'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes[0].relatedPhraseIds).toEqual(['p1']);
    expect(scopeHints).toHaveLength(0);
  });

  it('tag_phrase alone → not added (no scopes)', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'tag_phrase', 'xyz'),
    ];
    const { scopes, scopeHints } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(0);
    expect(scopeHints).toHaveLength(0);
  });

  it('tag between two items → attaches to lower-index on tie', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'tag_phrase', 'xyz'),
      makePhrase('p2', 'item_phrase', 'bread'),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes[0].relatedPhraseIds).toContain('p1');
    expect(scopes[1].relatedPhraseIds).not.toContain('p1');
  });

  it('tag after item + merchant → attaches to nearest', () => {
    // p0=merchant(index0), p1=item(index1), p2=tag(index2)
    // dist p2→p0 = 2, dist p2→p1 = 1 → p1
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'merchant_phrase', 'Walmart', 1.0),
      makePhrase('p1', 'item_phrase', 'milk'),
      makePhrase('p2', 'tag_phrase', 'bio'),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    const itemScope = scopes.find((s) => s.type === 'item_scope')!;
    expect(itemScope.relatedPhraseIds).toContain('p2');
    const merchantScope = scopes.find((s) => s.type === 'merchant_scope')!;
    expect(merchantScope.relatedPhraseIds).not.toContain('p2');
  });
});

// ── Ambiguous modifier target hint ────────────────────────────────────────────

describe('buildSemanticScopes — ambiguous_modifier_target hint', () => {
  it('hint contains both candidates', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'modifier_phrase', 'organic'),
      makePhrase('p2', 'item_phrase', 'bread'),
    ];
    const { scopeHints } = buildSemanticScopes(phrases);
    expect(scopeHints[0].candidates).toContain('p0');
    expect(scopeHints[0].candidates).toContain('p2');
  });

  it('hint has message string', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'modifier_phrase', 'organic'),
      makePhrase('p2', 'item_phrase', 'bread'),
    ];
    const { scopeHints } = buildSemanticScopes(phrases);
    expect(typeof scopeHints[0].message).toBe('string');
    expect(scopeHints[0].message!.length).toBeGreaterThan(0);
  });

  it('no hint when modifier is clearly closer to one scope', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'item_phrase', 'bread'),
      makePhrase('p2', 'modifier_phrase', 'sliced'),
    ];
    const { scopeHints } = buildSemanticScopes(phrases);
    expect(scopeHints).toHaveLength(0);
  });

  it('single scope + modifier → no hint even if modifier is far', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'coffee'),
      makePhrase('p1', 'noise_phrase', 'и'),
      makePhrase('p2', 'modifier_phrase', 'без сахара'),
    ];
    const { scopeHints } = buildSemanticScopes(phrases);
    expect(scopeHints).toHaveLength(0);
  });
});

// ── amount/noise phrases are ignored ─────────────────────────────────────────

describe('buildSemanticScopes — ignored phrase types', () => {
  it('amount_phrase + item_phrase → one scope only', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'amount_phrase', '350', 1.0),
      makePhrase('p1', 'item_phrase', 'milk', 0.85),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes).toHaveLength(1);
    expect(scopes[0].rootPhraseId).toBe('p1');
  });

  it('noise_phrase does not block modifier attachment', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'coffee'),
      makePhrase('p1', 'noise_phrase', 'the'),
      makePhrase('p2', 'modifier_phrase', 'hot'),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes[0].modifierPhraseIds).toContain('p2');
  });
});

// ── Real-world inputs via parseInput ─────────────────────────────────────────

describe('parseInput integration — scopes field', () => {
  it('"ice coffee without sugar 250" → item_scope with modifier', () => {
    const ctx = parseInput('ice coffee without sugar 250');
    expect(ctx.scopes.length).toBeGreaterThanOrEqual(1);
    const itemScope = ctx.scopes.find((s) => s.type === 'item_scope');
    expect(itemScope).toBeDefined();
    expect(itemScope!.modifierPhraseIds.length).toBeGreaterThanOrEqual(1);
  });

  it('"small dog food 200" → item_scope with modifier', () => {
    const ctx = parseInput('small dog food 200');
    const itemScope = ctx.scopes.find((s) => s.type === 'item_scope');
    expect(itemScope).toBeDefined();
    expect(itemScope!.modifierPhraseIds.length).toBeGreaterThanOrEqual(1);
  });

  it('"Walmart milk bread 300" → merchant_scope + item scopes', () => {
    const ctx = parseInput('Walmart milk bread 300');
    expect(ctx.scopes.length).toBeGreaterThanOrEqual(1);
    const merchantScope = ctx.scopes.find((s) => s.type === 'merchant_scope');
    expect(merchantScope).toBeDefined();
  });

  it('empty input → empty scopes and scopeHints', () => {
    const ctx = parseInput('');
    expect(ctx.scopes).toEqual([]);
    expect(ctx.scopeHints).toEqual([]);
  });

  it('"350" (amount only) → empty scopes', () => {
    const ctx = parseInput('350');
    expect(ctx.scopes).toHaveLength(0);
  });

  it('parseInput returns scopeHints array', () => {
    const ctx = parseInput('milk organic bread 100');
    expect(Array.isArray(ctx.scopes)).toBe(true);
    expect(Array.isArray(ctx.scopeHints)).toBe(true);
  });
});

// ── Scope IDs ─────────────────────────────────────────────────────────────────

describe('buildSemanticScopes — scope ID format', () => {
  it('scope IDs are s0, s1, s2...', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'item_phrase', 'bread'),
      makePhrase('p2', 'merchant_phrase', 'Walmart'),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes.map((s) => s.id)).toEqual(['s0', 's1', 's2']);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('buildSemanticScopes — determinism', () => {
  it('same phrases → same result on repeated calls', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk'),
      makePhrase('p1', 'modifier_phrase', 'organic'),
      makePhrase('p2', 'item_phrase', 'bread'),
    ];
    const result1 = buildSemanticScopes(phrases);
    const result2 = buildSemanticScopes(phrases);
    expect(result1).toEqual(result2);
  });

  it('parseInput determinism — same input → same scopes', () => {
    const input = 'ice coffee without sugar 100';
    const ctx1 = parseInput(input);
    const ctx2 = parseInput(input);
    expect(ctx1.scopes).toEqual(ctx2.scopes);
    expect(ctx1.scopeHints).toEqual(ctx2.scopeHints);
  });
});

// ── Confidence inheritance ────────────────────────────────────────────────────

describe('buildSemanticScopes — confidence inheritance', () => {
  it('scope inherits root phrase confidence', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'item_phrase', 'milk', 0.90),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes[0].confidence).toBe(0.90);
  });

  it('merchant scope inherits 1.0 confidence from store lookup', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'merchant_phrase', 'Walmart', 1.0),
    ];
    const { scopes } = buildSemanticScopes(phrases);
    expect(scopes[0].confidence).toBe(1.0);
  });
});

// ── Orphan modifier message content ──────────────────────────────────────────

describe('buildSemanticScopes — orphan modifier message', () => {
  it('orphan hint message contains rawText', () => {
    const phrases: SemanticPhrase[] = [
      makePhrase('p0', 'modifier_phrase', 'без сахара'),
    ];
    const { scopeHints } = buildSemanticScopes(phrases);
    expect(scopeHints[0].message).toContain('без сахара');
  });
});
