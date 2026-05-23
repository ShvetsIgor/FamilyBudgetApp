/**
 * Tests for the Semantic Relationship & Grouping Runtime.
 *
 * Coverage:
 *   - buildRelationships: all 4 relationship rules (shares_merchant, shares_amount,
 *     related_item, modifies) with edge cases
 *   - buildPurchaseGroups: group shape, merchantFragmentId, amountFragmentId,
 *     itemFragmentIds, modifierFragmentIds, suggestedSplit, confidenceSignals
 *   - parseInput integration: purchaseGroups + relationships in ParserContext
 *   - Fragment ID referential integrity
 *   - Determinism guarantee
 *
 * All tests are deterministic: same inputs → same outputs, always.
 */

import { describe, it, expect } from 'vitest';
import { tokenizeAndClassify } from '@/features/expenses/engine/tokenClassifier';
import { extractFragments } from '@/features/expenses/engine/fragmentExtractor';
import {
  buildRelationships,
  buildPurchaseGroups,
} from '@/features/expenses/engine/purchaseGrouper';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type {
  SemanticFragment,
  ClarificationHint,
} from '@/features/expenses/engine/semanticFragment';
import type { SuggestionMemoryState } from '@/features/expenses/store/suggestionMemorySlice';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extract(input: string, memory?: SuggestionMemoryState) {
  return extractFragments(tokenizeAndClassify(input), memory);
}

function groupsFor(input: string, memory?: SuggestionMemoryState) {
  const { fragments, clarificationHints } = extract(input, memory);
  return {
    groups: buildPurchaseGroups(fragments, clarificationHints),
    relationships: buildRelationships(fragments),
    fragments,
    clarificationHints,
  };
}

function makeFragment(
  id: string,
  type: SemanticFragment['type'],
  rawValue: string,
  categoryIds: string[] = [],
  confidence = 0.85,
): SemanticFragment {
  return {
    id,
    type,
    rawValue,
    normalizedValue: rawValue.toLowerCase(),
    confidence,
    candidateCategories: categoryIds,
  };
}

// ── buildPurchaseGroups: basic shape ──────────────────────────────────────────

describe('buildPurchaseGroups — basic shape', () => {
  it('returns exactly one group for non-empty input', () => {
    const { groups } = groupsFor('dabbah молоко 350');
    expect(groups).toHaveLength(1);
  });

  it('group id is always g0', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].id).toBe('g0');
  });

  it('returns empty array for empty fragment list', () => {
    expect(buildPurchaseGroups([], [])).toEqual([]);
  });

  it('returns empty array for whitespace-only input (no fragments)', () => {
    const { fragments, clarificationHints } = extract('   ');
    expect(buildPurchaseGroups(fragments, clarificationHints)).toEqual([]);
  });

  it('returns one group even for amount-only input', () => {
    const { groups } = groupsFor('500');
    expect(groups).toHaveLength(1);
  });
});

// ── buildPurchaseGroups: merchantFragmentId ───────────────────────────────────

describe('buildPurchaseGroups — merchantFragmentId', () => {
  it('sets merchantFragmentId when a merchant fragment exists', () => {
    const { groups, fragments } = groupsFor('dabbah молоко 350');
    const merchant = fragments.find((f) => f.type === 'merchant');
    expect(groups[0].merchantFragmentId).toBe(merchant!.id);
  });

  it('merchantFragmentId is undefined when no merchant fragment', () => {
    const { groups } = groupsFor('молоко хлеб 150');
    expect(groups[0].merchantFragmentId).toBeUndefined();
  });

  it('uses first merchant fragment id', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop1'),
      makeFragment('f1', 'merchant', 'shop2'),
    ];
    const groups = buildPurchaseGroups(frags, []);
    expect(groups[0].merchantFragmentId).toBe('f0');
  });
});

// ── buildPurchaseGroups: amountFragmentId ─────────────────────────────────────

describe('buildPurchaseGroups — amountFragmentId', () => {
  it('sets amountFragmentId when an amount fragment exists', () => {
    const { groups, fragments } = groupsFor('dabbah 350');
    const amount = fragments.find((f) => f.type === 'amount');
    expect(groups[0].amountFragmentId).toBe(amount!.id);
  });

  it('amountFragmentId is undefined when no amount in input', () => {
    const { groups } = groupsFor('молоко хлеб');
    expect(groups[0].amountFragmentId).toBeUndefined();
  });

  it('uses first amount fragment id', () => {
    const frags = [
      makeFragment('f0', 'amount', '100', [], 1.0),
      makeFragment('f1', 'amount', '200', [], 1.0),
    ];
    const groups = buildPurchaseGroups(frags, []);
    expect(groups[0].amountFragmentId).toBe('f0');
  });
});

// ── buildPurchaseGroups: itemFragmentIds ──────────────────────────────────────

describe('buildPurchaseGroups — itemFragmentIds', () => {
  it('collects all item fragment ids in order', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'item', 'milk', ['dairy']),
      makeFragment('f2', 'item', 'bread', ['bakery']),
      makeFragment('f3', 'amount', '150', [], 1.0),
    ];
    const groups = buildPurchaseGroups(frags, []);
    expect(groups[0].itemFragmentIds).toEqual(['f1', 'f2']);
  });

  it('itemFragmentIds is empty when no item fragments exist', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].itemFragmentIds).toEqual([]);
  });

  it('single item included in itemFragmentIds', () => {
    const { groups, fragments } = groupsFor('dabbah молоко 350');
    const item = fragments.find((f) => f.type === 'item');
    if (item) {
      expect(groups[0].itemFragmentIds).toContain(item.id);
    }
  });
});

// ── buildPurchaseGroups: modifierFragmentIds ──────────────────────────────────

describe('buildPurchaseGroups — modifierFragmentIds', () => {
  it('collects modifier fragment ids', () => {
    const frags = [
      makeFragment('f0', 'item', 'coffee', ['coffee']),
      makeFragment('f1', 'modifier', 'iced', [], 0.70),
    ];
    const groups = buildPurchaseGroups(frags, []);
    expect(groups[0].modifierFragmentIds).toEqual(['f1']);
  });

  it('modifierFragmentIds is empty when no modifiers', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].modifierFragmentIds).toEqual([]);
  });
});

// ── buildPurchaseGroups: suggestedSplit ───────────────────────────────────────

describe('buildPurchaseGroups — suggestedSplit', () => {
  it('false for merchant+amount only (no items)', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].suggestedSplit).toBe(false);
  });

  it('false for single item', () => {
    const frags = [
      makeFragment('f0', 'item', 'milk', ['dairy']),
    ];
    expect(buildPurchaseGroups(frags, [])[0].suggestedSplit).toBe(false);
  });

  it('true via multiple_categories clarification hint', () => {
    const frags = [
      makeFragment('f0', 'item', 'milk', ['dairy']),
      makeFragment('f1', 'item', 'shampoo', ['cosmetics']),
    ];
    const hint: ClarificationHint = {
      kind: 'multiple_categories',
      fragmentId: 'f0',
      candidates: ['dairy', 'cosmetics'],
    };
    expect(buildPurchaseGroups(frags, [hint])[0].suggestedSplit).toBe(true);
  });

  it('true via different candidateCategories without hint', () => {
    const frags = [
      makeFragment('f0', 'item', 'a', ['catA']),
      makeFragment('f1', 'item', 'b', ['catB']),
    ];
    expect(buildPurchaseGroups(frags, [])[0].suggestedSplit).toBe(true);
  });

  it('false when 2+ items share identical candidateCategories', () => {
    const frags = [
      makeFragment('f0', 'item', 'a', ['groceries']),
      makeFragment('f1', 'item', 'b', ['groceries']),
    ];
    expect(buildPurchaseGroups(frags, [])[0].suggestedSplit).toBe(false);
  });

  it('false when item fragments have empty candidateCategories', () => {
    const frags = [
      makeFragment('f0', 'item', 'a', []),
      makeFragment('f1', 'item', 'b', []),
    ];
    expect(buildPurchaseGroups(frags, [])[0].suggestedSplit).toBe(false);
  });

  it('true when one item has category and another has different category', () => {
    const frags = [
      makeFragment('f0', 'item', 'milk', ['dairy']),
      makeFragment('f1', 'item', 'drill', ['tools']),
    ];
    expect(buildPurchaseGroups(frags, [])[0].suggestedSplit).toBe(true);
  });
});

// ── buildPurchaseGroups: confidenceSignals ────────────────────────────────────

describe('buildPurchaseGroups — confidenceSignals', () => {
  it('includes merchant_identified when merchant exists', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].confidenceSignals).toContain('merchant_identified');
  });

  it('excludes merchant_identified when no merchant', () => {
    const { groups } = groupsFor('350');
    expect(groups[0].confidenceSignals).not.toContain('merchant_identified');
  });

  it('includes amount_present when amount exists', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].confidenceSignals).toContain('amount_present');
  });

  it('excludes amount_present when no amount', () => {
    const { groups } = groupsFor('молоко хлеб');
    expect(groups[0].confidenceSignals).not.toContain('amount_present');
  });

  it('includes items_found when item fragments exist', () => {
    const { groups } = groupsFor('dabbah молоко 350');
    expect(groups[0].confidenceSignals).toContain('items_found');
  });

  it('excludes items_found when no items', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].confidenceSignals).not.toContain('items_found');
  });

  it('includes split_recommended when suggestedSplit is true', () => {
    const frags = [
      makeFragment('f0', 'item', 'a', ['catA']),
      makeFragment('f1', 'item', 'b', ['catB']),
    ];
    expect(buildPurchaseGroups(frags, [])[0].confidenceSignals).toContain('split_recommended');
  });

  it('excludes split_recommended when suggestedSplit is false', () => {
    const { groups } = groupsFor('dabbah 350');
    expect(groups[0].confidenceSignals).not.toContain('split_recommended');
  });

  it('all four signals present for full purchase with split', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'item', 'a', ['catA']),
      makeFragment('f2', 'item', 'b', ['catB']),
      makeFragment('f3', 'amount', '100', [], 1.0),
    ];
    const signals = buildPurchaseGroups(frags, [])[0].confidenceSignals;
    expect(signals).toContain('merchant_identified');
    expect(signals).toContain('amount_present');
    expect(signals).toContain('items_found');
    expect(signals).toContain('split_recommended');
  });

  it('signals appear in deterministic order', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'item', 'a', ['catA']),
      makeFragment('f2', 'item', 'b', ['catB']),
      makeFragment('f3', 'amount', '100', [], 1.0),
    ];
    const signals = buildPurchaseGroups(frags, [])[0].confidenceSignals;
    expect(signals).toEqual([
      'merchant_identified',
      'amount_present',
      'items_found',
      'split_recommended',
    ]);
  });
});

// ── buildRelationships: shares_merchant ──────────────────────────────────────

describe('buildRelationships — shares_merchant', () => {
  it('item → merchant edge for each item fragment', () => {
    const { relationships, fragments } = groupsFor('dabbah молоко 350');
    const merchant = fragments.find((f) => f.type === 'merchant');
    const items = fragments.filter((f) => f.type === 'item');
    if (merchant && items.length > 0) {
      for (const item of items) {
        const edge = relationships.find(
          (r) =>
            r.fromFragmentId === item.id &&
            r.toFragmentId === merchant.id &&
            r.type === 'shares_merchant',
        );
        expect(edge).toBeDefined();
        expect(edge!.confidence).toBe(0.90);
      }
    }
  });

  it('no shares_merchant edges when no merchant fragment', () => {
    const { relationships } = groupsFor('молоко хлеб 150');
    expect(relationships.filter((r) => r.type === 'shares_merchant')).toHaveLength(0);
  });

  it('shares_merchant count equals item fragment count', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'item', 'milk', ['dairy']),
      makeFragment('f2', 'item', 'bread', ['bakery']),
      makeFragment('f3', 'amount', '150', [], 1.0),
    ];
    const rels = buildRelationships(frags);
    expect(rels.filter((r) => r.type === 'shares_merchant')).toHaveLength(2);
  });
});

// ── buildRelationships: shares_amount ────────────────────────────────────────

describe('buildRelationships — shares_amount', () => {
  it('every non-amount fragment has a shares_amount edge to the amount', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'item', 'milk', ['dairy']),
      makeFragment('f2', 'amount', '100', [], 1.0),
    ];
    const rels = buildRelationships(frags);
    const amountEdges = rels.filter((r) => r.type === 'shares_amount');
    expect(amountEdges).toHaveLength(2); // f0→f2, f1→f2
    for (const edge of amountEdges) {
      expect(edge.toFragmentId).toBe('f2');
      expect(edge.confidence).toBe(1.0);
    }
  });

  it('no shares_amount edges when no amount fragment', () => {
    const { relationships } = groupsFor('молоко хлеб');
    expect(relationships.filter((r) => r.type === 'shares_amount')).toHaveLength(0);
  });

  it('amount fragment itself has no outgoing shares_amount edge', () => {
    const frags = [
      makeFragment('f0', 'amount', '100', [], 1.0),
      makeFragment('f1', 'item', 'milk', ['dairy']),
    ];
    const rels = buildRelationships(frags);
    const selfEdge = rels.find(
      (r) => r.fromFragmentId === 'f0' && r.type === 'shares_amount',
    );
    expect(selfEdge).toBeUndefined();
  });

  it('shares_amount count equals non-amount fragment count', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'item', 'a', ['catA']),
      makeFragment('f2', 'item', 'b', ['catB']),
      makeFragment('f3', 'amount', '200', [], 1.0),
    ];
    const rels = buildRelationships(frags);
    // 3 non-amount fragments → 3 edges
    expect(rels.filter((r) => r.type === 'shares_amount')).toHaveLength(3);
  });
});

// ── buildRelationships: related_item ─────────────────────────────────────────

describe('buildRelationships — related_item', () => {
  it('bidirectional edges between each item pair (confidence 0.70)', () => {
    const frags = [
      makeFragment('f0', 'item', 'milk', ['dairy']),
      makeFragment('f1', 'item', 'bread', ['bakery']),
    ];
    const rels = buildRelationships(frags);
    const fwd = rels.find((r) => r.fromFragmentId === 'f0' && r.toFragmentId === 'f1' && r.type === 'related_item');
    const rev = rels.find((r) => r.fromFragmentId === 'f1' && r.toFragmentId === 'f0' && r.type === 'related_item');
    expect(fwd).toBeDefined();
    expect(rev).toBeDefined();
    expect(fwd!.confidence).toBe(0.70);
    expect(rev!.confidence).toBe(0.70);
  });

  it('no related_item edges when only one item', () => {
    const frags = [makeFragment('f0', 'item', 'milk', ['dairy'])];
    const rels = buildRelationships(frags);
    expect(rels.filter((r) => r.type === 'related_item')).toHaveLength(0);
  });

  it('related_item count is n*(n-1) for n items', () => {
    const frags = [
      makeFragment('f0', 'item', 'a', ['catA']),
      makeFragment('f1', 'item', 'b', ['catB']),
      makeFragment('f2', 'item', 'c', ['catC']),
    ];
    const rels = buildRelationships(frags);
    // 3 items → 3 pairs × 2 directions = 6
    expect(rels.filter((r) => r.type === 'related_item')).toHaveLength(6);
  });

  it('no related_item edges when no item fragments', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'amount', '100', [], 1.0),
    ];
    const rels = buildRelationships(frags);
    expect(rels.filter((r) => r.type === 'related_item')).toHaveLength(0);
  });
});

// ── buildRelationships: modifies ─────────────────────────────────────────────

describe('buildRelationships — modifies', () => {
  it('modifier attaches to nearest item by fragment index', () => {
    // item(f0), item(f1), modifier(f2) — f2 distance 2 from f0, distance 1 from f1
    const frags = [
      makeFragment('f0', 'item', 'bread', ['bakery']),
      makeFragment('f1', 'item', 'milk', ['dairy']),
      makeFragment('f2', 'modifier', 'fat', [], 0.70),
    ];
    const rels = buildRelationships(frags);
    const edge = rels.find((r) => r.type === 'modifies' && r.fromFragmentId === 'f2');
    expect(edge).toBeDefined();
    expect(edge!.toFragmentId).toBe('f1'); // distance 1 vs 2
    expect(edge!.confidence).toBe(0.80);
  });

  it('lower-index item wins on tie (equidistant)', () => {
    // item(f0), modifier(f1), item(f2) — f1 equidistant from f0 and f2
    const frags = [
      makeFragment('f0', 'item', 'coffee', ['coffee']),
      makeFragment('f1', 'modifier', 'iced', [], 0.70),
      makeFragment('f2', 'item', 'milk', ['dairy']),
    ];
    const rels = buildRelationships(frags);
    const edge = rels.find((r) => r.type === 'modifies' && r.fromFragmentId === 'f1');
    expect(edge!.toFragmentId).toBe('f0'); // f0 wins (lower index)
  });

  it('no modifies edge when no item fragments exist', () => {
    const frags = [
      makeFragment('f0', 'merchant', 'shop'),
      makeFragment('f1', 'modifier', 'online', [], 0.70),
    ];
    const rels = buildRelationships(frags);
    expect(rels.filter((r) => r.type === 'modifies')).toHaveLength(0);
  });

  it('modifier attaches to only item when single item', () => {
    const frags = [
      makeFragment('f0', 'modifier', 'iced', [], 0.70),
      makeFragment('f1', 'item', 'coffee', ['coffee']),
    ];
    const rels = buildRelationships(frags);
    const edge = rels.find((r) => r.type === 'modifies');
    expect(edge!.fromFragmentId).toBe('f0');
    expect(edge!.toFragmentId).toBe('f1');
  });

  it('multiple modifiers each attach to their nearest item', () => {
    // modifier(f0), item(f1), item(f2), modifier(f3)
    const frags = [
      makeFragment('f0', 'modifier', 'mod1', [], 0.70),
      makeFragment('f1', 'item', 'itemA', ['catA']),
      makeFragment('f2', 'item', 'itemB', ['catB']),
      makeFragment('f3', 'modifier', 'mod2', [], 0.70),
    ];
    const rels = buildRelationships(frags);
    const edge0 = rels.find((r) => r.type === 'modifies' && r.fromFragmentId === 'f0');
    const edge3 = rels.find((r) => r.type === 'modifies' && r.fromFragmentId === 'f3');
    expect(edge0!.toFragmentId).toBe('f1'); // f0 closer to f1 (dist 1) than f2 (dist 2)
    expect(edge3!.toFragmentId).toBe('f2'); // f3 closer to f2 (dist 1) than f1 (dist 2)
  });
});

// ── buildRelationships: empty input ──────────────────────────────────────────

describe('buildRelationships — empty cases', () => {
  it('returns empty array for empty fragment list', () => {
    expect(buildRelationships([])).toEqual([]);
  });

  it('returns empty array for amount-only input (no non-amount possible)', () => {
    // Single amount fragment — no non-amount fragment to connect to
    const frags = [makeFragment('f0', 'amount', '100', [], 1.0)];
    expect(buildRelationships(frags)).toEqual([]);
  });
});

// ── parseInput integration ─────────────────────────────────────────────────────

describe('parseInput — purchaseGroups and relationships in ParserContext', () => {
  it('ParserContext includes purchaseGroups array', () => {
    expect(Array.isArray(parseInput('dabbah 350').purchaseGroups)).toBe(true);
  });

  it('ParserContext includes relationships array', () => {
    expect(Array.isArray(parseInput('dabbah 350').relationships)).toBe(true);
  });

  it('empty input returns empty purchaseGroups', () => {
    expect(parseInput('').purchaseGroups).toEqual([]);
  });

  it('empty input returns empty relationships', () => {
    expect(parseInput('').relationships).toEqual([]);
  });

  it('whitespace-only input returns empty purchaseGroups', () => {
    expect(parseInput('   ').purchaseGroups).toEqual([]);
  });

  it('non-empty input produces one purchase group with id g0', () => {
    const ctx = parseInput('dabbah 350');
    expect(ctx.purchaseGroups).toHaveLength(1);
    expect(ctx.purchaseGroups[0].id).toBe('g0');
  });

  it('purchaseGroups fragment references are valid fragment ids', () => {
    const ctx = parseInput('dabbah молоко 350');
    const fragIds = new Set(ctx.fragments.map((f) => f.id));
    const g = ctx.purchaseGroups[0];
    if (g.merchantFragmentId) expect(fragIds.has(g.merchantFragmentId)).toBe(true);
    if (g.amountFragmentId) expect(fragIds.has(g.amountFragmentId)).toBe(true);
    for (const id of g.itemFragmentIds) expect(fragIds.has(id)).toBe(true);
    for (const id of g.modifierFragmentIds) expect(fragIds.has(id)).toBe(true);
  });

  it('all relationship fragment references point to valid fragment ids', () => {
    const ctx = parseInput('dabbah молоко 350');
    const fragIds = new Set(ctx.fragments.map((f) => f.id));
    for (const r of ctx.relationships) {
      expect(fragIds.has(r.fromFragmentId)).toBe(true);
      expect(fragIds.has(r.toFragmentId)).toBe(true);
    }
  });

  it('existing ParserContext fields are unaffected by the new stage', () => {
    const ctx = parseInput('dabbah 350');
    expect(ctx.amount).toBe(350);
    expect(ctx.merchant).toBe('dabbah');
    expect(ctx.fragments.length).toBeGreaterThan(0);
    expect(ctx.clarificationHints).toBeDefined();
    expect(ctx.splitHints).toBeDefined();
    expect(ctx.confidenceSignals).toBeDefined();
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('buildRelationships produces identical output on repeated calls', () => {
    const { fragments } = extract('dabbah молоко шампунь 350');
    expect(buildRelationships(fragments)).toEqual(buildRelationships(fragments));
  });

  it('buildPurchaseGroups produces identical output on repeated calls', () => {
    const { fragments, clarificationHints } = extract('dabbah молоко шампунь 350');
    expect(buildPurchaseGroups(fragments, clarificationHints))
      .toEqual(buildPurchaseGroups(fragments, clarificationHints));
  });

  it('parseInput returns same purchaseGroups and relationships on repeated calls', () => {
    const inputs = ['dabbah молоко 350', 'rami levi 500', 'молоко хлеб 150', ''];
    for (const input of inputs) {
      const a = parseInput(input);
      const b = parseInput(input);
      expect(a.purchaseGroups).toEqual(b.purchaseGroups);
      expect(a.relationships).toEqual(b.relationships);
    }
  });

  it('relationship ordering is stable across calls', () => {
    const key = (r: { fromFragmentId: string; type: string; toFragmentId: string }) =>
      `${r.fromFragmentId}:${r.type}:${r.toFragmentId}`;
    const a = parseInput('dabbah молоко хлеб 350').relationships;
    const b = parseInput('dabbah молоко хлеб 350').relationships;
    expect(a.map(key)).toEqual(b.map(key));
  });
});
