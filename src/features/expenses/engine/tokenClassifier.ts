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
 * Classify a single normalized token.
 *
 * Order of checks:
 *   1. Amount (numeric after currency strip)
 *   2. Empty after punctuation strip → noise
 *   3. Known stop word → noise
 *   4. Single non-letter character → noise
 *   5. Everything else → text
 */
export function classifyToken(rawToken: string): ClassifiedToken {
  const normalized = stripTokenPunctuation(rawToken);

  if (isAmountString(rawToken)) {
    return {
      raw: rawToken,
      normalized,
      kind: 'amount',
      numericValue: parseAmountToken(rawToken),
    };
  }

  if (!normalized) {
    return { raw: rawToken, normalized: rawToken, kind: 'noise' };
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
 * Tokenize a normalized input string and classify each token.
 *
 * Splits on whitespace (input must already be collapsed).
 * Filters empty strings before classification.
 */
export function tokenizeAndClassify(normalized: string): ClassifiedToken[] {
  if (!normalized) return [];
  return normalized
    .split(' ')
    .filter(Boolean)
    .map(classifyToken);
}
