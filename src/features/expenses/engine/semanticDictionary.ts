/**
 * LAYER: semantic dictionary — unified, deterministic knowledge access.
 *
 * Single access point for all semantic lookup in the fragment extractor.
 * Consolidates:
 *   - STORES from chat parser dictionaries (store entries with aliases)
 *   - ITEMS  from chat parser dictionaries (keyword → categoryId)
 *   - MERCHANT_ALIAS_MAP from inputNormalizer (transliteration variants)
 *   - ITEM_BIGRAMS (curated multi-token item phrases)
 *
 * Architecture invariant:
 *   Only this file imports from chat/parser/dictionaries.
 *   fragmentExtractor imports from here — not directly from chat dictionaries.
 *
 * All lookups are O(1) hash-table operations (pre-built at module load).
 * No fuzzy matching, no probabilistic logic.
 */

import { STORES, ITEMS } from '@/features/chat/parser/dictionaries';
import type { StoreEntry } from '@/features/chat/parser/dictionaries';
import { resolveAlias } from './inputNormalizer';

export type { StoreEntry };

// ── Store index ───────────────────────────────────────────────────────────────
//
// Built from STORES.aliases at module load.
// Single-token aliases go to STORE_SINGLE.
// Exactly two-token aliases go to STORE_BIGRAM.
// 3+ token aliases are skipped (none exist in current data).

const STORE_SINGLE: Record<string, StoreEntry> = {};
const STORE_BIGRAM: Record<string, StoreEntry> = {};
const STORE_TRIGRAM: Record<string, StoreEntry> = {};

for (const store of STORES) {
  for (const alias of store.aliases) {
    const lower = alias.toLowerCase();
    const parts = lower.split(' ');
    if (parts.length === 1) {
      STORE_SINGLE[lower] = store;
    } else if (parts.length === 2) {
      STORE_BIGRAM[lower] = store;
    } else if (parts.length === 3) {
      STORE_TRIGRAM[lower] = store;
    }
    // 4+ token aliases: not indexed (no current entries require it)
  }
}

// ── Payment phrases ───────────────────────────────────────────────────────────
//
// Structured payment-method bigrams. Checked BEFORE item bigrams in phraseExtractor
// so that "credit card" → payment_phrase (not item_phrase).
// These phrases are also retained in ITEM_BIGRAM_TABLE for backward-compat lookups.

const PAYMENT_PHRASE_TABLE: Record<string, { categoryIds: string[]; confidence: number }> = {
  'credit card':       { categoryIds: ['fin_other'], confidence: 0.90 },
  'gift card':         { categoryIds: ['g_other'],   confidence: 0.85 },
  'bank transfer':     { categoryIds: ['fin_other'], confidence: 0.90 },
  'wire transfer':     { categoryIds: ['fin_other'], confidence: 0.90 },
  'cash payment':      { categoryIds: ['fin_other'], confidence: 0.80 },
  'оплата картой':     { categoryIds: ['fin_other'], confidence: 0.90 },
  'банковский перевод':{ categoryIds: ['fin_other'], confidence: 0.90 },
};

// ── Item bigrams ──────────────────────────────────────────────────────────────
//
// Curated multi-token item phrases with confidence scores.
// Keys: two normalized tokens joined with a space (already lowercase).

const ITEM_BIGRAM_TABLE: Record<string, { categoryIds: string[]; confidence: number }> = {
  // Food / drinks
  'ice cream':         { categoryIds: ['snacks'],       confidence: 0.90 },
  'ice coffee':        { categoryIds: ['coffee'],       confidence: 0.90 },
  'iced coffee':       { categoryIds: ['coffee'],       confidence: 0.90 },
  'cold coffee':       { categoryIds: ['coffee'],       confidence: 0.85 },
  'olive oil':         { categoryIds: ['groceries'],    confidence: 0.85 },
  'mineral water':     { categoryIds: ['groceries'],    confidence: 0.85 },
  'sparkling water':   { categoryIds: ['groceries'],    confidence: 0.85 },

  // Household
  'toilet paper':      { categoryIds: ['household'],   confidence: 0.90 },
  'paper towel':       { categoryIds: ['household'],   confidence: 0.85 },
  'paper towels':      { categoryIds: ['household'],   confidence: 0.85 },
  'dish soap':         { categoryIds: ['household'],   confidence: 0.85 },
  'hand soap':         { categoryIds: ['household'],   confidence: 0.85 },
  'laundry detergent': { categoryIds: ['household'],   confidence: 0.85 },
  'washing powder':    { categoryIds: ['household'],   confidence: 0.85 },

  // Pets
  'dog food':          { categoryIds: ['pet_food'],    confidence: 0.90 },
  'cat food':          { categoryIds: ['pet_food'],    confidence: 0.90 },
  'cat litter':        { categoryIds: ['pet_supplies'],confidence: 0.90 },

  // Car
  'car wash':          { categoryIds: ['car_wash'],    confidence: 0.90 },
  'motor oil':         { categoryIds: ['car_service'], confidence: 0.85 },

  // Beauty / health
  'face cream':        { categoryIds: ['cosmetics'],   confidence: 0.85 },
  'shaving cream':     { categoryIds: ['cosmetics'],   confidence: 0.85 },
  'dental floss':      { categoryIds: ['pharmacy'],    confidence: 0.85 },
  'contact lenses':    { categoryIds: ['pharmacy'],    confidence: 0.85 },

  // Finance modifiers
  'credit card':       { categoryIds: ['fin_other'],   confidence: 0.70 },
  'gift card':         { categoryIds: ['g_other'],     confidence: 0.70 },

  // Russian food bigrams
  'туалетная бумага':  { categoryIds: ['household'],   confidence: 0.90 },
  'оливковое масло':   { categoryIds: ['groceries'],   confidence: 0.85 },
  'кошачий корм':      { categoryIds: ['pet_food'],    confidence: 0.90 },
  'собачий корм':      { categoryIds: ['pet_food'],    confidence: 0.90 },
  'собачий токой':     { categoryIds: ['pet_food'],    confidence: 0.85 },
  'стиральный порошок':{ categoryIds: ['household'],   confidence: 0.85 },
  'мясной фарш':       { categoryIds: ['meat_fish'],   confidence: 0.85 },
  'куриное филе':      { categoryIds: ['meat_fish'],   confidence: 0.85 },
  'куриная грудка':    { categoryIds: ['meat_fish'],   confidence: 0.85 },
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a single-token alias against the store index.
 * Input must already be normalized (lowercase, alias-resolved via resolveAlias).
 */
export function lookupStore(normalizedToken: string): StoreEntry | null {
  return STORE_SINGLE[resolveAlias(normalizedToken)] ?? STORE_SINGLE[normalizedToken] ?? null;
}

/**
 * Look up a two-token sequence against the store bigram index.
 * Inputs must already be normalized (lowercase).
 */
export function lookupStoreBigram(n1: string, n2: string): StoreEntry | null {
  const bigram = `${resolveAlias(n1)} ${resolveAlias(n2)}`;
  return STORE_BIGRAM[bigram] ?? STORE_BIGRAM[`${n1} ${n2}`] ?? null;
}

/**
 * Look up a single item token against the ITEMS dictionary.
 * Returns categoryIds + confidence, or null if not found.
 */
export function lookupItem(
  normalizedToken: string,
): { categoryIds: string[]; confidence: number } | null {
  const entry = ITEMS[normalizedToken];
  if (!entry) return null;
  return { categoryIds: [entry.categoryId], confidence: 0.85 };
}

/**
 * Look up a two-token phrase against the curated item bigram table.
 * Inputs must already be normalized (lowercase).
 */
export function lookupItemBigram(
  n1: string,
  n2: string,
): { categoryIds: string[]; confidence: number } | null {
  return ITEM_BIGRAM_TABLE[`${n1} ${n2}`] ?? null;
}

/**
 * Return true if the normalized token (or its alias) is a known store.
 * Useful for fast merchant detection without retrieving full entry.
 */
export function isKnownStore(normalizedToken: string): boolean {
  return lookupStore(normalizedToken) !== null;
}

/**
 * Return true if the normalized token is a known item keyword.
 */
export function isKnownItem(normalizedToken: string): boolean {
  return normalizedToken in ITEMS;
}
