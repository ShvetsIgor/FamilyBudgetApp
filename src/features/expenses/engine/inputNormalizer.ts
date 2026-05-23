/**
 * LAYER: input normalizer — centralized, deterministic text normalization.
 *
 * Single source of truth for all input normalization in the pipeline.
 * No fuzzy matching, no probabilistic logic — only deterministic transforms.
 *
 * Normalization contract:
 *   - Unicode NFC normalization (canonical composed form)
 *   - Lowercase + trim
 *   - Collapse multiple whitespace to single space
 *   - Strip leading/trailing punctuation from individual tokens
 *   - Alias resolution for known merchant name variants (static map)
 *
 * Alias map design:
 *   - Keys: post-normalization token forms (already lowercase + trimmed)
 *   - Values: canonical form used for memory lookup
 *   - Covers transliteration variants and common spelling variants
 *   - NO fuzzy matching — if a variant isn't listed, it stays as-is
 *   - Extend by adding entries; removing entries changes behavior
 */

// ── Currency symbols stripped during amount detection ─────────────────────────

export const CURRENCY_SYMBOLS = '₪$€£₽¥';
const CURRENCY_STRIP_RE = new RegExp(`^[${CURRENCY_SYMBOLS}]|[${CURRENCY_SYMBOLS}]$`, 'g');

export function stripCurrencySymbol(s: string): string {
  return s.replace(CURRENCY_STRIP_RE, '');
}

// ── Core text normalization ───────────────────────────────────────────────────

/**
 * Normalize raw input text: NFC + lowercase + trim + collapse whitespace.
 * Safe for both Cyrillic and Latin scripts.
 */
export function normalizeText(raw: string): string {
  return raw
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Strip leading and trailing punctuation from a single token.
 * Preserves internal punctuation (e.g., decimal dots/commas in numbers).
 */
export function stripTokenPunctuation(token: string): string {
  return token.replace(/^[^\p{L}\p{N}₪$€£₽¥]+|[^\p{L}\p{N}₪$€£₽¥]+$/gu, '');
}

// ── Merchant alias map ────────────────────────────────────────────────────────

/**
 * Static, deterministic alias map: normalized-variant → canonical-key.
 *
 * Purpose: make common spelling variants and transliteration alternates
 * resolve to the same memory key so suggestion history carries across inputs.
 *
 * Rules:
 *   - Keys must already be lowercase (normalized)
 *   - Values are the canonical lookup key
 *   - Single tokens only (multi-word aliases not supported)
 *   - Hebrew → Latin entries belong here when manually known
 */
export const MERCHANT_ALIAS_MAP: Record<string, string> = {
  // Transliteration variants for common Israeli stores
  'dabah': 'dabbah',
  'dabach': 'dabbah',
  'dabbah': 'dabbah',

  // Latin ↔ Cyrillic store name variants
  'виктори': 'victory',
  'рами': 'rami',
  'шуфэрсал': 'shufersal',
  'шуферсал': 'shufersal',

  // Common English spelling variants
  'cofee': 'coffee',
  'coffe': 'coffee',
  'mcdonalds': "mcdonald's",
  'макдак': "mcdonald's",
  'макдональдс': "mcdonald's",
};

/**
 * Resolve a normalized token to its canonical alias, if one exists.
 * Returns the token unchanged if no alias is defined.
 */
export function resolveAlias(normalizedToken: string): string {
  return MERCHANT_ALIAS_MAP[normalizedToken] ?? normalizedToken;
}

// ── Merchant key normalization ────────────────────────────────────────────────

/**
 * Full pipeline to derive a memory lookup key from a raw merchant string.
 *
 * Pipeline: normalizeText → stripTokenPunctuation → resolveAlias
 *
 * The result is suitable for use as a key in SuggestionMemoryState.merchants
 * and for tag association lookups.
 *
 * Examples:
 *   "Dabbah"   → "dabbah"
 *   "dabah"    → "dabbah"   (alias resolved)
 *   "SHUFERSAL" → "shufersal"
 *   "  Coffee " → "coffee"
 */
export function toMerchantKey(raw: string): string {
  const normalized = normalizeText(raw);
  const stripped = stripTokenPunctuation(normalized);
  return resolveAlias(stripped);
}

// ── Amount string utilities ───────────────────────────────────────────────────

/**
 * Check whether a token (after currency strip) looks like a numeric amount.
 * Supports: 350, 18.50, 18,50 (European decimal comma).
 */
export function isAmountString(token: string): boolean {
  const stripped = stripCurrencySymbol(token);
  return stripped.length > 0 && /^\d+([.,]\d+)?$/.test(stripped);
}

/**
 * Parse an amount token to a float, handling decimal comma.
 * Assumes `isAmountString(token)` is true.
 */
export function parseAmountToken(token: string): number {
  return parseFloat(stripCurrencySymbol(token).replace(',', '.'));
}
