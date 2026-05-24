/**
 * LAYER: category suggestion engine — metadata-aware category suggestions.
 *
 * Combines:
 *   - Category-level metadata matching (aliases, tags, keywords)
 *   - Usage history (usageCount, lastUsedAt on Category)
 *
 * This is the category-entity layer suggestion system.
 * It works independently of the memory-based suggestionEngine in features/expenses/engine/.
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - No Redux imports. Consumes plain Category[] arrays.
 *   - No AI, no embeddings. Deterministic.
 */

import type { Category } from '@/shared/types';
import { extractCandidateTokens, findMatchingCategoriesByTag } from './tagMatching';
import { normalizeToken, deduplicateNormalized } from './categoryNormalization';

export interface SuggestedCategory {
  category: Category;
  score: number;
  reason: string;
  matchedTerms: string[];
}

// ── Primary API ───────────────────────────────────────────────────────────────

/**
 * Suggest categories from a raw input string.
 * Uses category metadata (aliases, tags, keywords, name) + usage history.
 *
 * Example:
 *   input = "dabbah 350"
 *   → [groceries (alias match), home (tag match), electronics (tag match)]
 */
export function suggestCategoriesFromInput(
  input: string,
  cats: Category[],
  topN = 5,
  now = Date.now(),
): SuggestedCategory[] {
  const tokens = extractCandidateTokens(input);
  if (tokens.length === 0) return [];

  const matches = findMatchingCategoriesByTag(tokens, cats, now);
  return rankSuggestions(matches).slice(0, topN);
}

/**
 * Rank CategoryMatch[] into SuggestedCategory[] with human-readable reasons.
 */
export function rankSuggestions(
  matches: ReturnType<typeof findMatchingCategoriesByTag>,
): SuggestedCategory[] {
  return matches.map((m) => ({
    category: m.category,
    score: m.score,
    reason: buildReason(m.matchedOn, m.matchedTerms),
    matchedTerms: m.matchedTerms,
  }));
}

// ── Split enrichment ─────────────────────────────────────────────────────────

export interface TagEnrichmentPatch {
  categoryId: string;
  updatedTags: string[];
}

/**
 * After a split expense, enrich category tags with the merchant/store token.
 *
 * Example:
 *   merchantToken = "dabbah"
 *   selectedCategoryIds = ["groceries", "tools", "home"]
 *   → patches tags on each category to include "dabbah" (if not already present)
 *
 * Returns only the categories that need updating (no-op patches excluded).
 * Caller is responsible for persisting the patches to Firestore.
 */
export function enrichCategoryTagsFromSplit(
  merchantToken: string,
  selectedCategoryIds: string[],
  allCats: Category[],
): TagEnrichmentPatch[] {
  const norm = normalizeToken(merchantToken);
  if (!norm || norm.length < 2) return [];

  const patches: TagEnrichmentPatch[] = [];

  for (const id of selectedCategoryIds) {
    const cat = allCats.find((c) => c.id === id);
    if (!cat || cat.archived) continue;

    const existing = (cat.tags ?? []).map((t) => normalizeToken(t));
    if (existing.includes(norm)) continue; // already present

    patches.push({
      categoryId: id,
      updatedTags: deduplicateNormalized([...(cat.tags ?? []), norm]),
    });
  }

  return patches;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildReason(
  matchedOn: string[],
  matchedTerms: string[],
): string {
  const terms = matchedTerms.slice(0, 2).join(', ');

  if (matchedOn.includes('alias')) return `Псевдоним: "${terms}"`;
  if (matchedOn.includes('tag')) return `Тег: "${terms}"`;
  if (matchedOn.includes('keyword')) return `Ключевое слово: "${terms}"`;
  return `Название: "${terms}"`;
}
