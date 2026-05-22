/**
 * @deprecated Use suggestionEngine.ts directly for new code.
 *
 * Backward-compatibility shim — re-exports the canonical engine API
 * under the old signature so existing callers (FastExpenseEntry) don't break.
 *
 * New code should import from:
 *   @/features/expenses/engine/suggestionEngine
 */

export type { RankableItem } from '../engine/suggestionEngine';
export type { ScoredSuggestion, SuggestionReason } from '../engine/suggestionEngine';
export { computeSuggestions, explainSuggestion } from '../engine/suggestionEngine';

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import type { RankableItem } from '../engine/suggestionEngine';
import { computeSuggestions } from '../engine/suggestionEngine';

/** Convenience wrapper — returns IDs only, no scoring metadata. */
export function rankSuggestions(
  items: RankableItem[],
  merchant: string | undefined,
  memory: SuggestionMemoryState,
  topN = 3,
): string[] {
  return computeSuggestions({ merchant, items, memory, topN }).map((s) => s.categoryId);
}
