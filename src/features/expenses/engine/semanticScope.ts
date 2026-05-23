/**
 * LAYER: semantic scope — phrase ownership model.
 *
 * A SemanticScope groups a root phrase (item / payment / merchant) with the
 * modifier and related phrases that semantically belong to it.
 *
 * Produced by scopeResolver.ts after phrases are extracted.
 * Consumed by the clarification layer and, in the future, by split pre-population.
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - Phrase IDs reference SemanticPhrase.id ('p0', 'p1', ...).
 *   - Confidence is deterministic (no AI, no probabilistic logic).
 */

export type ScopeType = 'item_scope' | 'payment_scope' | 'merchant_scope';

export type ScopeHintKind =
  | 'orphan_modifier'          // modifier phrase has no scope to attach to
  | 'ambiguous_modifier_target'; // modifier is equidistant from 2+ scopes

export interface ScopeHint {
  kind: ScopeHintKind;
  phraseId: string;
  candidates: string[]; // scope root phraseIds that are candidates
  message?: string;
}

/**
 * A scope groups one root phrase with zero or more modifier / related phrases.
 *
 * rootPhraseId    — the item/payment/merchant phrase this scope is anchored to
 * modifierPhraseIds — modifier phrases attached to this scope (nearest by index)
 * relatedPhraseIds  — tag phrases associated with this scope (nearest by index)
 * type            — derived from root phrase type
 * confidence      — inherited from root phrase confidence
 */
export interface SemanticScope {
  id: string;             // 's0', 's1', ...
  rootPhraseId: string;
  modifierPhraseIds: string[];
  relatedPhraseIds: string[];
  type: ScopeType;
  confidence: number;
}
