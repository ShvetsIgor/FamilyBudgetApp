/**
 * Universal display-name normalizer for user-entered labels.
 *
 * Trims surrounding whitespace, collapses internal runs to a single space,
 * and uppercases only the first letter — the rest is preserved as the user
 * typed it. Use this for any user-facing label (expense/income comments,
 * store/tag names, recurring/savings titles, folder/category names).
 *
 * Empty input returns an empty string.
 */
export function normalizeName(input: string): string {
  if (!input) return '';
  const trimmed = input.replace(/\s+/gu, ' ').trim();
  if (!trimmed) return '';
  const first = trimmed.charAt(0);
  const upper = first.toLocaleUpperCase();
  if (upper === first) return trimmed;
  return upper + trimmed.slice(1);
}

/**
 * Lower-case + collapsed-spaces key for matching/lookup.
 * Use as a stable history/index key while keeping the display form separate
 * (so users see "Даббах" but matching uses "даббах").
 */
export function normalizeNameKey(input: string): string {
  if (!input) return '';
  return input.replace(/\s+/gu, ' ').trim().toLocaleLowerCase();
}
