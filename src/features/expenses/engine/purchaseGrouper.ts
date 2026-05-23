/**
 * LAYER: purchase grouper — relationship extraction and fragment grouping.
 *
 * Two pure functions:
 *   buildRelationships  — constructs directed edges between SemanticFragments
 *   buildPurchaseGroups — assembles fragments into one (or future: many) PurchaseGroup(s)
 *
 * Architecture invariants:
 *   - Pure functions: same inputs → same output, always (deterministic).
 *   - No ML, no probabilistic logic — all confidence values are rule-assigned constants.
 *   - Additive: does not modify fragments; produces new data structures alongside them.
 *   - Multi-group ready: returning PurchaseGroup[] allows future OCR/receipt expansion
 *     by simply returning more groups without changing consumer interfaces.
 *
 * Relationship confidence values (deterministic — assigned by rule, not by ML):
 *   shares_amount   1.00
 *   shares_merchant 0.90
 *   modifies        0.80
 *   related_item    0.70
 */

import type { SemanticFragment, ClarificationHint, FragmentRelationship } from './semanticFragment';
import type { PurchaseGroup } from './purchaseGroup';

// ── buildRelationships ────────────────────────────────────────────────────────

/**
 * Build all semantic edges between fragments in a single input.
 *
 * Rules applied (all rules run independently):
 *
 *   1. shares_merchant (0.90):
 *      item → merchant (first merchant fragment)
 *      Fires for every item fragment when a merchant fragment exists.
 *
 *   2. shares_amount (1.00):
 *      non-amount → amount (first amount fragment)
 *      Fires for every non-amount fragment when an amount fragment exists.
 *
 *   3. related_item (0.70):
 *      item[i] → item[j] and item[j] → item[i] for every pair i < j.
 *      Fires only when 2+ item fragments exist.
 *
 *   4. modifies (0.80):
 *      modifier → nearest item (by fragment array index, minimum absolute distance).
 *      When 2+ items are equidistant, the lower-indexed item wins (stable tie-break).
 *      Fires only when at least one item fragment exists.
 */
export function buildRelationships(
  fragments: SemanticFragment[],
): FragmentRelationship[] {
  const relationships: FragmentRelationship[] = [];

  if (fragments.length === 0) return relationships;

  const merchantFragment = fragments.find((f) => f.type === 'merchant') ?? null;
  const amountFragment = fragments.find((f) => f.type === 'amount') ?? null;
  const itemFragments = fragments.filter((f) => f.type === 'item');
  const modifierFragments = fragments.filter((f) => f.type === 'modifier');

  // Rule 1: shares_merchant — every item → the merchant
  if (merchantFragment) {
    for (const item of itemFragments) {
      relationships.push({
        fromFragmentId: item.id,
        toFragmentId: merchantFragment.id,
        type: 'shares_merchant',
        confidence: 0.90,
      });
    }
  }

  // Rule 2: shares_amount — every non-amount → the amount
  if (amountFragment) {
    for (const f of fragments) {
      if (f.type !== 'amount') {
        relationships.push({
          fromFragmentId: f.id,
          toFragmentId: amountFragment.id,
          type: 'shares_amount',
          confidence: 1.0,
        });
      }
    }
  }

  // Rule 3: related_item — bidirectional pairs between all item fragments
  for (let i = 0; i < itemFragments.length; i++) {
    for (let j = i + 1; j < itemFragments.length; j++) {
      relationships.push({
        fromFragmentId: itemFragments[i].id,
        toFragmentId: itemFragments[j].id,
        type: 'related_item',
        confidence: 0.70,
      });
      relationships.push({
        fromFragmentId: itemFragments[j].id,
        toFragmentId: itemFragments[i].id,
        type: 'related_item',
        confidence: 0.70,
      });
    }
  }

  // Rule 4: modifies — each modifier attaches to nearest item by fragment array index
  // Tie-break: lower array index wins (strict less-than update means first found stays)
  if (itemFragments.length > 0) {
    for (const modifier of modifierFragments) {
      const modifierIndex = fragments.findIndex((f) => f.id === modifier.id);
      let nearestItem = itemFragments[0];
      let nearestDistance = Math.abs(
        fragments.findIndex((f) => f.id === nearestItem.id) - modifierIndex,
      );
      for (let k = 1; k < itemFragments.length; k++) {
        const itemIndex = fragments.findIndex((f) => f.id === itemFragments[k].id);
        const distance = Math.abs(itemIndex - modifierIndex);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestItem = itemFragments[k];
        }
      }
      relationships.push({
        fromFragmentId: modifier.id,
        toFragmentId: nearestItem.id,
        type: 'modifies',
        confidence: 0.80,
      });
    }
  }

  return relationships;
}

// ── buildPurchaseGroups ───────────────────────────────────────────────────────

/**
 * Assemble fragments into one or more PurchaseGroups.
 *
 * Current behavior (single-input model):
 *   - Returns [] when fragments is empty (no purchase detected).
 *   - Returns [g0] containing all fragments otherwise.
 *
 * suggestedSplit is true when:
 *   - a 'multiple_categories' ClarificationHint is present, OR
 *   - 2+ item fragments carry different candidateCategories (union size > 1).
 *
 * confidenceSignals labels (appended in fixed order for determinism):
 *   'merchant_identified' — a merchant fragment was found
 *   'amount_present'      — an amount fragment was found
 *   'items_found'         — at least one item fragment was found
 *   'split_recommended'   — suggestedSplit is true
 */
export function buildPurchaseGroups(
  fragments: SemanticFragment[],
  clarificationHints: ClarificationHint[],
): PurchaseGroup[] {
  if (fragments.length === 0) return [];

  const merchantFragment = fragments.find((f) => f.type === 'merchant') ?? null;
  const amountFragment = fragments.find((f) => f.type === 'amount') ?? null;
  const itemFragments = fragments.filter((f) => f.type === 'item');
  const modifierFragments = fragments.filter((f) => f.type === 'modifier');

  // Determine suggestedSplit
  const hasMultipleCategoriesHint = clarificationHints.some(
    (h) => h.kind === 'multiple_categories',
  );
  let suggestedSplit = hasMultipleCategoriesHint;
  if (!suggestedSplit && itemFragments.length >= 2) {
    const categoryUnion = new Set(
      itemFragments.flatMap((f) => f.candidateCategories ?? []),
    );
    if (categoryUnion.size > 1) {
      suggestedSplit = true;
    }
  }

  // Build confidence signal labels (deterministic order)
  const confidenceSignals: string[] = [];
  if (merchantFragment) confidenceSignals.push('merchant_identified');
  if (amountFragment) confidenceSignals.push('amount_present');
  if (itemFragments.length > 0) confidenceSignals.push('items_found');
  if (suggestedSplit) confidenceSignals.push('split_recommended');

  const group: PurchaseGroup = {
    id: 'g0',
    merchantFragmentId: merchantFragment?.id,
    amountFragmentId: amountFragment?.id,
    itemFragmentIds: itemFragments.map((f) => f.id),
    modifierFragmentIds: modifierFragments.map((f) => f.id),
    confidenceSignals,
    suggestedSplit,
  };

  return [group];
}
