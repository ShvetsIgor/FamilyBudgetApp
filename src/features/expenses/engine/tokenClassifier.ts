/**
 * LAYER: token classifier — typed token analysis.
 *
 * Converts a normalized input string into a sequence of ClassifiedTokens.
 * Each token carries its kind so downstream pipeline stages operate on
 * typed data instead of raw strings.
 *
 * Token kinds:
 *   amount  — numeric value (possibly with currency prefix/suffix)
 *   text    — alphabetic/mixed token; potential merchant, item, or tag
 *   noise   — stop word, single-char punctuation, known filler token
 *
 * Design constraints:
 *   - Pure function — no memory or store access
 *   - Input must already be normalize()d (lowercase, trimmed, collapsed)
 *   - Classification is deterministic: same token always gets same kind
 */

import { isAmountString, parseAmountToken, stripTokenPunctuation } from './inputNormalizer';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Coarse classification for pipeline stages. */
export type TokenKind = 'amount' | 'text' | 'noise';

export interface ClassifiedToken {
  /** Original token as it appeared in the normalized input. */
  raw: string;
  /** Token after internal punctuation-stripping (used for lookups). */
  normalized: string;
  kind: TokenKind;
  /** Only set when kind === 'amount'. */
  numericValue?: number;
}

// ── Stop word sets ────────────────────────────────────────────────────────────

/**
 * Tokens classified as noise — prepositions, conjunctions, filler words.
 * Russian and English. Single characters (except letters used as categories) are also noise.
 */
const NOISE_TOKENS = new Set([
  // Russian prepositions / conjunctions
  'в', 'на', 'за', 'по', 'из', 'от', 'к', 'у', 'с', 'и', 'а', 'но', 'или',
  'да', 'не', 'ни', 'же', 'бы',
  // English stop words
  'a', 'an', 'the', 'in', 'at', 'for', 'of', 'on', 'to', 'by', 'from', 'and',
  'or', 'but',
  // Filler / discourse markers
  'это', 'this', 'that',
]);

// ── Classification ────────────────────────────────────────────────────────────

/**
 * Classify a single token (may have original casing).
 *
 * Classification uses the lowercased form for consistent matching.
 * `raw` preserves the original casing for display.
 * `normalized` is lowercased + punctuation-stripped (used for key lookups).
 *
 * Order of checks:
 *   1. Amount (numeric after currency strip, checked on lowercase)
 *   2. Empty after punctuation strip → noise
 *   3. Known stop word → noise
 *   4. Single non-letter character → noise
 *   5. Everything else → text
 */
export function classifyToken(rawToken: string): ClassifiedToken {
  const lower = rawToken.toLowerCase();
  const normalized = stripTokenPunctuation(lower);

  if (isAmountString(lower)) {
    return {
      raw: rawToken,
      normalized,
      kind: 'amount',
      numericValue: parseAmountToken(lower),
    };
  }

  if (!normalized) {
    return { raw: rawToken, normalized: lower, kind: 'noise' };
  }

  if (NOISE_TOKENS.has(normalized)) {
    return { raw: rawToken, normalized, kind: 'noise' };
  }

  if (normalized.length === 1 && !/\p{L}/u.test(normalized)) {
    return { raw: rawToken, normalized, kind: 'noise' };
  }

  return { raw: rawToken, normalized, kind: 'text' };
}

/**
 * Tokenize a raw input string and classify each token.
 *
 * Takes the original (un-lowercased) input so ClassifiedToken.raw
 * preserves the original casing for display purposes. Classification
 * and key derivation use the normalized form.
 *
 * Collapses whitespace before splitting.
 */
export function tokenizeAndClassify(rawInput: string): ClassifiedToken[] {
  if (!rawInput.trim()) return [];
  return rawInput
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(classifyToken);
}
