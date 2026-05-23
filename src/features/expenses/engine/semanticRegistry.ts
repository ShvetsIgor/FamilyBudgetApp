/**
 * LAYER: semantic registry — unified knowledge ownership model.
 *
 * Provides structured, inspectable ownership over all semantic knowledge used
 * by the input pipeline. Replaces scattered lookup data with controlled registry
 * entries that carry source attribution, precedence, and conflict metadata.
 *
 * Registry entities:
 *   MerchantEntry  — store / merchant phrase from the store dictionary
 *   AliasEntry     — transliteration or shorthand alias (alias map)
 *   PhraseEntry    — multi-token item or payment phrase (bigram/trigram tables)
 *   ItemEntry      — single-token item keyword (item dictionary)
 *   ModifierEntry  — modifier prefix or standalone modifier adjective
 *   TagEntry       — learned or curated contextual tag
 *
 * Precedence rules (centralized):
 *   1. Merchant phrases outrank all generic phrases.
 *   2. Longer phrases outrank shorter phrases of the same kind.
 *   3. Explicit aliases outrank learned tags.
 *   4. user_defined source ranks highest — overrides everything.
 *   5. Archived entries remain resolvable but have reduced precedence.
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - All fields are deterministically computed from source data.
 *   - No AI, no embeddings, no probabilistic logic.
 */

// ── Entry kinds and sources ───────────────────────────────────────────────────

export type RegistryEntryKind =
  | 'merchant'   // store / merchant phrase
  | 'alias'      // transliteration or shorthand alias
  | 'phrase'     // multi-token item or payment phrase
  | 'item'       // single-token item keyword
  | 'modifier'   // modifier prefix or standalone adjective
  | 'tag';       // learned or curated contextual tag

export type RegistrySource =
  | 'store_dictionary'  // STORES from chat/parser/dictionaries
  | 'item_dictionary'   // ITEMS from chat/parser/dictionaries
  | 'alias_map'         // MERCHANT_ALIAS_MAP from inputNormalizer
  | 'phrase_table'      // ITEM_BIGRAM_TABLE or PAYMENT_PHRASE_TABLE
  | 'modifier_set'      // MODIFIER_PREFIXES or STANDALONE_MODIFIERS
  | 'memory'            // runtime SuggestionMemoryState
  | 'user_defined';     // future: manually added via constructor UI

// ── Precedence model ──────────────────────────────────────────────────────────

/**
 * Centralized precedence rules.
 * Final precedence = kindBase + tokenCountBonus + sourceBonus − archivedPenalty.
 * Higher value = wins in conflicts.
 */
export const REGISTRY_PRECEDENCE = {
  kindBase: {
    merchant: 100,
    alias:     90,
    phrase:    75,   // further split by phraseType in builder
    item:      60,
    modifier:  50,
    tag:       30,
  } as Record<RegistryEntryKind, number>,

  // +15 per extra token beyond 1 (bigram +15, trigram +30)
  tokenCountBonus: 15,

  sourceBonus: {
    user_defined:     30,
    store_dictionary: 20,
    alias_map:        15,
    item_dictionary:  10,
    phrase_table:      5,
    modifier_set:      0,
    memory:          -10,
  } as Record<RegistrySource, number>,

  // Payment phrases rank higher than item phrases
  paymentPhraseBonus: 10,

  // Archived entries are still resolvable but deprioritized
  archivedPenalty: 40,
} as const;

export function computePrecedence(
  kind: RegistryEntryKind,
  source: RegistrySource,
  tokenCount: number,
  options: { isPaymentPhrase?: boolean; archived?: boolean } = {},
): number {
  const base = REGISTRY_PRECEDENCE.kindBase[kind];
  const tokenBonus = (tokenCount - 1) * REGISTRY_PRECEDENCE.tokenCountBonus;
  const srcBonus = REGISTRY_PRECEDENCE.sourceBonus[source];
  const paymentBonus = options.isPaymentPhrase ? REGISTRY_PRECEDENCE.paymentPhraseBonus : 0;
  const archivedPenalty = options.archived ? REGISTRY_PRECEDENCE.archivedPenalty : 0;
  return base + tokenBonus + srcBonus + paymentBonus - archivedPenalty;
}

// ── Base entry ────────────────────────────────────────────────────────────────

export interface SemanticEntry {
  id: string;
  kind: RegistryEntryKind;
  source: RegistrySource;
  /** Normalized token(s) this entry covers (already lowercase). */
  tokens: string[];
  /** Candidate category IDs for this entry. Empty for aliases and merchants with fixed category. */
  categoryIds: string[];
  confidence: number;
  /** Deterministic precedence score — higher wins in conflicts. */
  precedence: number;
  archived: boolean;
  metadata?: Record<string, unknown>;
}

// ── Concrete entry types ──────────────────────────────────────────────────────

export interface MerchantEntry extends SemanticEntry {
  kind: 'merchant';
  storeId: string;
  storeGroup?: string;
  needsContext: boolean;
  /** All normalized aliases that map to this merchant. */
  aliases: string[];
}

export interface AliasEntry extends SemanticEntry {
  kind: 'alias';
  /** Canonical normalized key this alias resolves to. */
  canonical: string;
}

export interface PhraseEntry extends SemanticEntry {
  kind: 'phrase';
  phraseType: 'item' | 'payment';
}

export interface ItemEntry extends SemanticEntry {
  kind: 'item';
}

export interface ModifierEntry extends SemanticEntry {
  kind: 'modifier';
  modifierRole: 'prefix' | 'standalone';
}

export interface TagEntry extends SemanticEntry {
  kind: 'tag';
}

export type AnyRegistryEntry =
  | MerchantEntry
  | AliasEntry
  | PhraseEntry
  | ItemEntry
  | ModifierEntry
  | TagEntry;

// ── Conflict model ────────────────────────────────────────────────────────────

export type RegistryConflictKind =
  | 'phrase_overlap'         // two entries cover the exact same token sequence
  | 'alias_duplicate'        // alias key maps to different canonical targets
  | 'merchant_item_conflict' // token is registered as both merchant and item
  | 'modifier_item_conflict' // modifier prefix is also an item keyword
  | 'orphan_alias';          // alias has no matching merchant in the registry

export interface RegistryConflict {
  kind: RegistryConflictKind;
  entryIds: string[];
  tokens: string[];
  message: string;
  /** Higher-precedence entry wins. */
  winnerId?: string;
}

// ── Full registry ─────────────────────────────────────────────────────────────

export interface SemanticRegistry {
  /** All entries in source order (merchants first, then items, aliases, etc.). */
  entries: AnyRegistryEntry[];
  /** Detected conflicts (computed at build time). */
  conflicts: RegistryConflict[];
  /** Fast token-key lookup: single-token → entry (highest-precedence wins). */
  singleIndex: Record<string, AnyRegistryEntry>;
  /** Fast token-key lookup: 'tok1 tok2' → entry (highest-precedence wins). */
  bigramIndex: Record<string, AnyRegistryEntry>;
  /** Fast token-key lookup: 'tok1 tok2 tok3' → entry (highest-precedence wins). */
  trigramIndex: Record<string, AnyRegistryEntry>;
  /** Alias → canonical key. */
  aliasIndex: Record<string, string>;
}
