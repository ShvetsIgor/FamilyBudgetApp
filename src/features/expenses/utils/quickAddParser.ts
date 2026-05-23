/**
 * Backward-compatible wrapper around the unified input pipeline.
 *
 * Callers that only need { amount, merchant } continue to work unchanged.
 * For richer context (tags, itemCandidates, confidenceSignals, splitHints),
 * use parseInput() from engine/inputPipeline.ts directly.
 */
import { parseInput } from '../engine/inputPipeline';
import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';

export interface QuickAddParsed {
  amount?: number;
  merchant?: string;
}

export { parseInput };

/**
 * Parse a free-text quick-add string into merchant + amount.
 *
 * Delegates to the full input pipeline; extracts only the fields
 * this interface exposes for backward compatibility.
 *
 * Examples:
 *   "Dabbah 350"      → { merchant: "Dabbah", amount: 350 }
 *   "Coffee 18.50"    → { merchant: "Coffee", amount: 18.5 }
 *   "350"             → { amount: 350 }
 *   "Bus 7 morning"   → { merchant: "Bus morning", amount: 7 }
 *   "Groceries"       → { merchant: "Groceries" }
 */
export function parseQuickAdd(
  input: string,
  memory?: SuggestionMemoryState,
): QuickAddParsed {
  const ctx = parseInput(input, memory);
  const result: QuickAddParsed = {};
  if (ctx.amount !== undefined) result.amount = ctx.amount;
  if (ctx.merchant !== undefined) result.merchant = ctx.merchant;
  return result;
}
