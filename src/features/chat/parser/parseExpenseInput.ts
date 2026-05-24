/**
 * LAYER: chat expense parser — thin wrapper over the input pipeline.
 *
 * Provides a simple deterministic interface for the chat UI:
 *   parseExpenseInput(input) → { amount, tokens, merchant, suggestions }
 *
 * The heavy lifting is done by:
 *   features/expenses/engine/inputPipeline.ts  (7-stage pipeline)
 *   features/categories/utils/tagMatching.ts   (category-level matching)
 *
 * Architecture invariants:
 *   - No AI. No embeddings. Deterministic.
 *   - Does not import Redux. Pure function.
 *   - Category suggestions require caller to pass the Category[] list.
 */

import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type { SuggestionMemoryState } from '@/store/suggestionMemorySlice';
import type { Category } from '@/shared/types';
import { suggestCategoriesFromInput } from '@/features/categories/utils/categorySuggestions';

export interface ParsedExpenseInput {
  /** Parsed amount, or null if not found */
  amount: number | null;
  /** Non-numeric, non-noise tokens (merchant + item candidates) */
  tokens: string[];
  /** Best-guess merchant name, or null */
  merchant: string | null;
  /** Normalized merchant key for memory lookups */
  merchantKey: string | null;
  /** Suggested categories ranked by metadata match */
  suggestions: ParsedSuggestion[];
  /** Raw parser output for advanced consumers */
  raw: ReturnType<typeof parseInput>;
}

export interface ParsedSuggestion {
  categoryId: string;
  categoryName: string;
  score: number;
  reason: string;
}

/**
 * Parse a raw expense input string and return structured data for the chat UI.
 *
 * @param input       — raw user input, e.g. "dabbah 350" or "кофе 45"
 * @param categories  — active categories for suggestion matching
 * @param memory      — optional usage memory from suggestionMemorySlice
 */
export function parseExpenseInput(
  input: string,
  categories: Category[] = [],
  memory?: SuggestionMemoryState,
): ParsedExpenseInput {
  const ctx = parseInput(input, memory);

  const tokens = ctx.itemCandidates
    .map((ic) => ic.rawValue)
    .filter((v) => v.length >= 2);

  const suggestions = suggestCategoriesFromInput(input, categories, 5)
    .map((s) => ({
      categoryId: s.category.id,
      categoryName: s.category.name,
      score: s.score,
      reason: s.reason,
    }));

  return {
    amount: ctx.amount,
    tokens,
    merchant: ctx.merchant ?? null,
    merchantKey: ctx.merchantKey ?? null,
    suggestions,
    raw: ctx,
  };
}
