/**
 * LAYER: expense context builder — single entry point for the unified expense brain.
 *
 * Orchestrates the full pipeline:
 *   1. parseInput()              → ParserContext   (inputPipeline)
 *   2. classifyInputTokens()     → ClassifiedInputToken[]  (merchantClassifier)
 *   3. computeSuggestions()      → ScoredSuggestion[]      (suggestionEngine — single source of truth for ranking)
 *   4. computeConfidenceProfile() → ConfidenceProfile      (confidenceEngine)
 *   5. buildContextSignals()     → ContextSignal[]          (confidenceEngine)
 *   6. assemble                  → ExpenseContext
 *
 * Responsibility boundaries:
 *   - inputPipeline:       text → structured tokens, fragments, scopes, groups
 *   - merchantClassifier:  token role assignment (merchant/item/amount/noise)
 *   - suggestionEngine:    ALL ranking logic — no scoring anywhere else
 *   - categorySuggestions: supplies metadata-based CANDIDATES to the ranking context (separate layer)
 *   - confidenceEngine:    aggregates parser + ranking evidence into 3D confidence
 *
 * Architecture invariants:
 *   - Pure function. No Redux. No mutations. No side effects.
 *   - Single entry point for all UI components needing parsed expense context.
 *   - Deterministic: same rawInput + same memory → same ExpenseContext.
 *   - No AI, no embeddings.
 */

import { parseInput } from './inputPipeline';
import { computeSuggestions, type RankableItem } from './suggestionEngine';
import { computeConfidenceProfile, buildContextSignals } from './confidenceEngine';
import {
  classifyInputTokens,
  extractMerchantTokens,
  extractItemTokens,
  extractNormalizedTokens,
} from './merchantClassifier';
import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import type { Category } from '@/shared/types';
import type { ExpenseContext, CandidateCategory } from '../types/expenseContext';

// ── Empty memory sentinel ─────────────────────────────────────────────────────

const EMPTY_MEMORY: SuggestionMemoryState = {
  merchants: {},
  recents: [],
  splitCombos: [],
  tagAssociations: [],
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a complete ExpenseContext from raw user input.
 *
 * This is the primary entry point for all UI components that need
 * parsed + ranked + confidence-scored expense context.
 *
 * @param rawInput   — raw user input string (e.g. "dabbah drill 350")
 * @param categories — active categories for ranking (archived excluded internally)
 * @param memory     — suggestion memory from Redux (optional; gracefully absent)
 * @param topN       — max candidate categories to include
 */
export function buildExpenseContext(
  rawInput: string,
  categories: Category[],
  memory?: SuggestionMemoryState,
  topN = 5,
): ExpenseContext {
  const mem = memory ?? EMPTY_MEMORY;

  // ── Stage 1: Parse ───────────────────────────────────────────────────────────
  const parserContext = parseInput(rawInput, mem);

  // ── Stage 2: Classify tokens ─────────────────────────────────────────────────
  const tokens = classifyInputTokens(parserContext);
  const merchantTokens = extractMerchantTokens(parserContext);
  const itemTokens = extractItemTokens(parserContext);
  const normalizedTokens = extractNormalizedTokens(parserContext);

  // ── Stage 3: Rank (suggestionEngine is the ONLY ranking authority) ───────────
  const rankableItems: RankableItem[] = categories
    .filter((c) => !c.archived)
    .map((c) => ({ id: c.id, name: c.name }));

  const suggestions = computeSuggestions({
    merchant: parserContext.merchantKey,  // normalized key
    items: rankableItems,
    memory: mem,
    topN,
  });

  // ── Stage 4: Confidence ──────────────────────────────────────────────────────
  const confidence = computeConfidenceProfile(parserContext, suggestions);

  // ── Stage 5: Signals ─────────────────────────────────────────────────────────
  const signals = buildContextSignals(parserContext, suggestions);

  // ── Stage 6: Assemble ────────────────────────────────────────────────────────
  const candidateCategories: CandidateCategory[] = suggestions.map((s) => ({
    categoryId: s.categoryId,
    score: s.score,
    reason: s.reasons[0]?.kind ?? 'fallback',
    signals: s.reasons.map((r) => r.kind),
  }));

  return {
    rawInput,
    amount: parserContext.amount ?? null,
    merchant: parserContext.merchant ?? null,
    merchantKey: parserContext.merchantKey ?? null,
    tokens,
    merchantTokens,
    itemTokens,
    normalizedTokens,
    candidateCategories,
    confidence,
    signals,
    parserContext,
  };
}
