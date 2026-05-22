/**
 * Tag matching utilities for category search and suggestion boosting.
 *
 * Tags are contextual metadata on Category, not semantic categories.
 * Used as ranking/boost hints in chat and parser flows.
 * No ML, no AI — simple string matching only.
 */

/** Normalize a tag or query token for comparison. */
export function normalizeTag(s: string): string {
  return s.toLowerCase().trim();
}

/**
 * Returns true if any tag in the list contains the query token (or vice versa).
 * Case-insensitive substring match.
 */
export function queryMatchesTags(query: string, tags: string[]): boolean {
  const q = normalizeTag(query);
  return tags.some((t) => {
    const n = normalizeTag(t);
    return n.includes(q) || q.includes(n);
  });
}

/**
 * Splits a raw input string into normalized tokens for tag matching.
 * e.g. "Dabbah 350 שניצל" → ["dabbah", "שניצל"]  (numbers filtered out)
 */
export function tokenizeQuery(raw: string): string[] {
  return raw
    .split(/\s+/)
    .map(normalizeTag)
    .filter((t) => t.length > 1 && !/^\d+$/.test(t));
}

import type { Category } from '@/shared/types';

/**
 * Returns categories sorted by tag match score — matching categories first.
 * Does not filter out non-matching categories.
 * Input ordering preserved within each group.
 *
 * Used in chat/parser to boost tag-matching categories to the top of suggestions.
 */
export function boostCategoriesByQuery(query: string, cats: Category[]): Category[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return cats;

  const matched: Category[] = [];
  const rest: Category[] = [];
  for (const cat of cats) {
    const tags = cat.tags ?? [];
    const nameTokens = tokenizeQuery(cat.name);
    const allTokens = [...tags.map(normalizeTag), ...nameTokens];
    const hits = tokens.filter((t) => allTokens.some((a) => a.includes(t) || t.includes(a)));
    if (hits.length > 0) matched.push(cat);
    else rest.push(cat);
  }
  return [...matched, ...rest];
}
