/**
 * LAYER: tag matching engine — category-level metadata matching.
 *
 * Matches user input tokens against Category metadata fields:
 *   aliases   — exact > partial match (highest weight: store identity)
 *   tags      — exact > partial match (medium weight: context hints)
 *   keywords  — exact > partial match (lower weight: item hints)
 *   name      — exact > partial match (fallback)
 *
 * Score weights:
 *   alias exact:    50 pts
 *   alias partial:  25 pts
 *   tag exact:      35 pts
 *   tag partial:    15 pts
 *   name exact:     40 pts
 *   name partial:   20 pts
 *   keyword exact:  20 pts
 *   keyword partial: 10 pts
 *   usage boost:    up to +15 pts (log scale)
 *   recency boost:  +5 pts (within 30 days)
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Archived categories are excluded.
 *   - Deterministic: score depends only on input, not time (recency uses injected now).
 */

import type { Category } from '@/shared/types';
import {
  normalizeToken,
  normalizedEquals,
  normalizedIncludes,
  tokenizeForMatching,
} from './categoryNormalization';

export type MatchSource = 'name' | 'alias' | 'tag' | 'keyword';

export interface CategoryMatch {
  category: Category;
  score: number;
  matchedOn: MatchSource[];
  matchedTerms: string[];
}

// ── Score weights ─────────────────────────────────────────────────────────────

const W = {
  alias_exact: 50,
  alias_partial: 25,
  tag_exact: 35,
  tag_partial: 15,
  name_exact: 40,
  name_partial: 20,
  keyword_exact: 20,
  keyword_partial: 10,
  usage_max_boost: 15,
  recency_boost: 5,
  recency_days: 30,
} as const;

// ── Core functions ────────────────────────────────────────────────────────────

/**
 * Score how well a single token matches a single category.
 * Returns 0 if no match.
 */
export function scoreCategoryMatch(token: string, cat: Category): number {
  const norm = normalizeToken(token);
  if (!norm) return 0;

  let score = 0;

  // Alias match (highest weight — store identity)
  for (const alias of cat.aliases ?? []) {
    if (normalizedEquals(alias, norm)) { score += W.alias_exact; break; }
    if (normalizedIncludes(alias, norm)) { score += W.alias_partial; break; }
  }

  // Tag match
  for (const tag of cat.tags ?? []) {
    if (normalizedEquals(tag, norm)) { score += W.tag_exact; break; }
    if (normalizedIncludes(tag, norm)) { score += W.tag_partial; break; }
  }

  // Name match (fallback)
  if (normalizedEquals(cat.name, norm)) score += W.name_exact;
  else if (normalizedIncludes(cat.name, norm)) score += W.name_partial;

  // Keyword match (lowest weight — item-level hints)
  for (const kw of cat.keywords ?? []) {
    if (normalizedEquals(kw, norm)) { score += W.keyword_exact; break; }
    if (normalizedIncludes(kw, norm)) { score += W.keyword_partial; break; }
  }

  return score;
}

/**
 * Extract candidate tokens from a raw input string.
 * Numbers and very short tokens are excluded.
 *
 * Example: "dabbah drill 150" → ["dabbah", "drill"]
 */
export function extractCandidateTokens(input: string): string[] {
  return tokenizeForMatching(input);
}

/**
 * Find all categories that match any of the given tokens.
 * Returns ranked matches (highest score first).
 *
 * @param tokens  — normalized candidate tokens
 * @param cats    — all categories to search (archived excluded automatically)
 * @param now     — current timestamp in ms, defaults to Date.now()
 */
export function findMatchingCategoriesByTag(
  tokens: string[],
  cats: Category[],
  now = Date.now(),
): CategoryMatch[] {
  if (tokens.length === 0) return [];

  const results: CategoryMatch[] = [];

  for (const cat of cats) {
    if (cat.archived) continue;

    let totalScore = 0;
    const matchedOnSet = new Set<MatchSource>();
    const matchedTerms: string[] = [];

    for (const token of tokens) {
      const tokenScore = scoreCategoryMatch(token, cat);
      if (tokenScore > 0) {
        totalScore += tokenScore;
        matchedTerms.push(token);
        matchedOnSet.add(detectMatchSource(token, cat));
      }
    }

    if (totalScore === 0) continue;

    // Usage boost (log scale, max +15)
    if ((cat.usageCount ?? 0) > 0) {
      totalScore += Math.min(W.usage_max_boost, Math.floor(Math.log2(cat.usageCount!) * 5));
    }

    // Recency boost
    if (cat.lastUsedAt) {
      const daysSince = (now - new Date(cat.lastUsedAt).getTime()) / 86_400_000;
      if (daysSince <= W.recency_days) totalScore += W.recency_boost;
    }

    results.push({
      category: cat,
      score: totalScore,
      matchedOn: [...matchedOnSet],
      matchedTerms,
    });
  }

  return results.sort((a, b) => b.score - a.score || a.category.name.localeCompare(b.category.name));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectMatchSource(token: string, cat: Category): MatchSource {
  const norm = normalizeToken(token);

  for (const alias of cat.aliases ?? []) {
    if (normalizedIncludes(alias, norm) || normalizedEquals(alias, norm)) return 'alias';
  }
  for (const tag of cat.tags ?? []) {
    if (normalizedIncludes(tag, norm) || normalizedEquals(tag, norm)) return 'tag';
  }
  for (const kw of cat.keywords ?? []) {
    if (normalizedIncludes(kw, norm) || normalizedEquals(kw, norm)) return 'keyword';
  }
  return 'name';
}
