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
 * Filters categories by query, checking name, tags, and optional alias map.
 * Returns only matching categories, sorted by relevance (name match first).
 *
 * Used in the Category Constructor search UI.
 */
export function filterCategoriesByQuery(
  query: string,
  cats: Category[],
  aliasMap?: ReadonlyMap<string, { name: string; ru?: string }>,
): Category[] {
  const q = normalizeTag(query);
  if (!q) return cats;

  const nameMatches: Category[] = [];
  const tagMatches: Category[] = [];

  for (const cat of cats) {
    const catName = normalizeTag(cat.name);
    const alias = aliasMap?.get(cat.id);
    const aliasName = alias ? normalizeTag(alias.name) : '';
    const aliasRu = alias?.ru ? normalizeTag(alias.ru) : '';

    if (catName.includes(q) || aliasName.includes(q) || aliasRu.includes(q)) {
      nameMatches.push(cat);
    } else if (queryMatchesTags(q, cat.tags ?? [])) {
      tagMatches.push(cat);
    }
  }

  return [...nameMatches, ...tagMatches];
}
