/**
 * LAYER: category normalization — text normalization for category matching.
 *
 * More complete than tagUtils.normalizeTag (which is only lowercase+trim).
 * This module handles:
 *   - NFC Unicode normalization (Hebrew, Russian, Latin all safe)
 *   - Whitespace collapsing
 *   - Deduplication utilities
 *   - Token extraction (numbers excluded)
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - No external dependencies.
 *   - Deterministic: same input always produces same output.
 */

/**
 * Normalize a raw token for matching.
 * Applies NFC, lowercase, collapses internal whitespace, trims edges.
 */
export function normalizeToken(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalize an alias for storage and lookup.
 * Same as normalizeToken — aliases are plain strings.
 */
export function normalizeAlias(s: string): string {
  return normalizeToken(s);
}

/**
 * Normalize a tag for storage and lookup.
 * Strips characters that aren't letters, digits, spaces, hyphens, underscores.
 * Keeps Hebrew (\u05D0–\u05EA), Cyrillic (\u0400–\u04FF), and Latin safe.
 */
export function normalizeTag(s: string): string {
  return normalizeToken(s).replace(/[^\p{L}\p{N}\s\-_]/gu, '').trim();
}

/**
 * Normalize a keyword for storage and lookup.
 */
export function normalizeKeyword(s: string): string {
  return normalizeToken(s);
}

/**
 * Split input string into candidate match tokens.
 * Filters out:
 *   - Pure numbers (amounts)
 *   - Tokens shorter than 2 characters
 */
export function tokenizeForMatching(input: string): string[] {
  return normalizeToken(input)
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t));
}

/**
 * Deduplicate a list of strings preserving first occurrence.
 * Comparison is case-insensitive and trimmed.
 */
export function deduplicateNormalized(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = normalizeToken(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}

/**
 * Check if two strings are equal after normalization.
 */
export function normalizedEquals(a: string, b: string): boolean {
  return normalizeToken(a) === normalizeToken(b);
}

/**
 * Check if normalized `haystack` contains normalized `needle`.
 */
export function normalizedIncludes(haystack: string, needle: string): boolean {
  return normalizeToken(haystack).includes(normalizeToken(needle));
}
