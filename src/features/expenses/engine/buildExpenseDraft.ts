/**
 * LAYER: expense decision engine — unified draft builder.
 *
 * Single entry point that assembles all engine outputs into one ExpenseDraft.
 * UI components should call buildExpenseDraft and render the result.
 * No business decision logic should live in components.
 *
 * Orchestration flow (all stages are pure, deterministic, no AI):
 *   1. Parse raw text (optional) → ParserContext
 *   2. Run suggestion engine       → ScoredSuggestion[] (ranked categories)
 *   3. Get context prediction      → ContextSuggestion | null
 *   4. Load split presets          → SplitPreset[]
 *   5. Detect unknown tokens       → string[]
 *   6. Compute confidence          → ConfidenceLevel + score
 *   7. Decide split suggestion     → boolean
 *   8. Assemble → ExpenseDraft
 *
 * Usage:
 *   // From numpad (merchant known, no raw text needed):
 *   buildExpenseDraft({ merchant: 'Dabbah', amount: 1000 }, categories, memory)
 *
 *   // From chat (full text parsing):
 *   buildExpenseDraft({ raw: 'Dabbah drill milk 1000' }, categories, memory)
 */

import type { Category } from '@/shared/types';
import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import type { ParserContext } from './inputPipeline';
import type { ScoredSuggestion } from './suggestionEngine';
import type { SplitPreset } from './splitMemoryEngine';
import type { ContextSuggestion } from './merchantMemory';
import type { ConfidenceLevel } from './suggestionEngine';

import { parseInput } from './inputPipeline';
import { computeSuggestions, getConfidenceLevel, hasConfidentSuggestion } from './suggestionEngine';
import { buildSplitPresets } from './splitMemoryEngine';
import { getSuggestedContext, hasEnoughHistory, normalizeMerchantKey } from './merchantMemory';
import { SCORING_POLICY } from './scoringPolicy';

// ── ExpenseDraft model ────────────────────────────────────────────────────────

/**
 * Unified output of the expense decision engine.
 *
 * This is the canonical data model for the expense entry flow.
 * UI components receive this and only need to render — no business logic needed.
 */
export interface ExpenseDraft {
  // ── Input ──────────────────────────────────────────────────────────────────
  /** Original raw text (empty string when merchant+amount provided directly). */
  raw: string;

  // ── Core extracted data ────────────────────────────────────────────────────
  /** Extracted or provided numeric amount. null = not yet known. */
  amount: number | null;
  /** Merchant display name (original casing preserved). null = not detected. */
  merchant: string | null;
  /** Normalized merchant key for memory lookup. null = not detected. */
  merchantKey: string | null;

  // ── Context prediction ─────────────────────────────────────────────────────
  /**
   * Predicted context (folder) based on merchant history.
   * null = no history or below confidence threshold.
   */
  suggestedContext: ContextSuggestion | null;

  // ── Category suggestions (ranked) ─────────────────────────────────────────
  /**
   * All categories ranked by relevance to this merchant/input.
   * Only contains items with real merchant-specific signals when hasMerchantHistory is true.
   * Empty array when no history — never fake suggestions.
   */
  suggestedCategories: ScoredSuggestion[];

  // ── Confidence ────────────────────────────────────────────────────────────
  /** Qualitative confidence level for the top suggestion. */
  confidenceLevel: ConfidenceLevel;
  /**
   * Numeric confidence score 0–100.
   * Derived from top suggestion score + merchant history + unknown token penalty.
   */
  confidenceScore: number;

  // ── Split ─────────────────────────────────────────────────────────────────
  /**
   * Whether the engine recommends suggesting a split.
   * True when: large amount OR multiple item candidates detected.
   */
  shouldSuggestSplit: boolean;
  /** Learned split presets for this merchant, ranked by frequency. */
  splitPresets: SplitPreset[];

  // ── Unknown tokens ────────────────────────────────────────────────────────
  /**
   * Item candidate tokens that didn't match any known category name.
   * Only populated when raw text was parsed (not in numpad flow).
   * UI can offer: "create category" / "add mapping" / "ignore".
   */
  unknownTokens: string[];

  // ── Item candidates ───────────────────────────────────────────────────────
  /** All non-merchant, non-amount text tokens from the input. */
  itemCandidates: string[];

  // ── Memory state ──────────────────────────────────────────────────────────
  /** True when this merchant has ≥2 recorded saves. */
  hasMerchantHistory: boolean;

  // ── Debug / advanced consumers ────────────────────────────────────────────
  /** Full parser context. null when merchant+amount provided directly (no parsing). */
  parserContext: ParserContext | null;
}

// ── DraftInput ────────────────────────────────────────────────────────────────

export interface DraftInput {
  /**
   * Raw text from chat. When provided, the full parser pipeline runs.
   * Parser extracts merchant, amount, and item candidates automatically.
   */
  raw?: string;
  /**
   * Merchant name override.
   * Used by numpad flow — merchant is known, no parsing needed.
   * When provided alongside `raw`, overrides the parser's merchant detection.
   */
  merchant?: string;
  /**
   * Amount override.
   * Used by numpad flow — amount is known, no parsing needed.
   * When provided, overrides the parser's amount extraction.
   */
  amount?: number;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Identify item candidates that don't match any known category name.
 * These are tokens the system couldn't resolve — surfaced to UI for action.
 */
function detectUnknownTokens(itemCandidates: string[], categories: Category[]): string[] {
  if (itemCandidates.length === 0) return [];
  const catNames = new Set(categories.map((c) => c.name.toLowerCase()));
  return itemCandidates.filter((t) => !catNames.has(t.toLowerCase()));
}

/**
 * Compute a 0–100 confidence score from suggestion + context signals.
 * Penalizes unknown tokens; rewards merchant history.
 */
function computeConfidenceScore(
  suggestions: ScoredSuggestion[],
  hasMerchantHistory: boolean,
  unknownTokenCount: number,
): number {
  const topScore = suggestions[0]?.score ?? 0;
  // Start from normalized top suggestion score (SCORING_POLICY max ≈ 130pts, cap at 100)
  let score = Math.min(100, topScore * (100 / SCORING_POLICY.signals.merchantHistory.weight));
  if (hasMerchantHistory) score += 10;
  score -= unknownTokenCount * 12;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build a unified ExpenseDraft from input + categories + memory.
 *
 * This is the single entry point for all expense-entry decision logic.
 * Replaces scattered memo computations in UI components.
 *
 * @param input      Raw text OR merchant+amount override (numpad mode)
 * @param categories Active expense categories (no Savings, no archived)
 * @param memory     Current suggestion memory state
 */
export function buildExpenseDraft(
  input: DraftInput,
  categories: Category[],
  memory: SuggestionMemoryState,
): ExpenseDraft {
  // ── Stage 1: Parse raw text (optional) ─────────────────────────────────
  let parserContext: ParserContext | null = null;
  let parsedMerchant: string | undefined;
  let parsedMerchantKey: string | undefined;
  let parsedAmount: number | undefined;
  let itemCandidates: string[] = [];

  if (input.raw?.trim()) {
    parserContext = parseInput(input.raw, memory);
    parsedMerchant = parserContext.merchant;
    parsedMerchantKey = parserContext.merchantKey;
    parsedAmount = parserContext.amount;
    itemCandidates = parserContext.itemCandidates;
  }

  // Input overrides take precedence over parser results
  const merchant = input.merchant ?? parsedMerchant ?? null;
  const merchantKey = merchant ? normalizeMerchantKey(merchant) : (parsedMerchantKey ?? null);
  const amount = input.amount ?? (parsedAmount ?? null);

  // ── Stage 2: Run suggestion engine ─────────────────────────────────────
  const suggestions = computeSuggestions({
    merchant: merchant ?? undefined,
    items: categories,
    memory,
  });

  // Only expose suggestions backed by real merchant-specific signals.
  // This prevents "История · Dabbah" from showing generic recency-only items.
  const hasMerchantHistory = merchantKey ? hasEnoughHistory(merchantKey, memory) : false;

  const suggestedCategories = hasMerchantHistory
    ? suggestions.filter((s) =>
        s.reasons.some(
          (r) =>
            r.kind === 'merchant_history' ||
            r.kind === 'habit' ||
            r.kind === 'tag_history' ||
            r.kind === 'split_history',
        ),
      )
    : [];

  // ── Stage 3: Context prediction ─────────────────────────────────────────
  const suggestedContext = merchantKey ? getSuggestedContext(merchantKey, memory) : null;

  // ── Stage 4: Split presets ──────────────────────────────────────────────
  const splitPresets = merchantKey
    ? buildSplitPresets(merchantKey, memory, categories, 3)
    : [];

  // ── Stage 5: Unknown token detection ───────────────────────────────────
  const unknownTokens = detectUnknownTokens(itemCandidates, categories);

  // ── Stage 6: Confidence ─────────────────────────────────────────────────
  const confidenceLevel = getConfidenceLevel(suggestions);
  const confidenceScore = computeConfidenceScore(
    suggestions,
    hasMerchantHistory,
    unknownTokens.length,
  );

  // ── Stage 7: Split suggestion ───────────────────────────────────────────
  const shouldSuggestSplit =
    (amount !== null && amount >= SCORING_POLICY.thresholds.splitAmountHint) ||
    itemCandidates.length >= 2;

  // ── Stage 8: Assemble ────────────────────────────────────────────────────
  return {
    raw: input.raw ?? '',
    amount,
    merchant,
    merchantKey,
    suggestedContext,
    suggestedCategories,
    confidenceLevel,
    confidenceScore,
    shouldSuggestSplit,
    splitPresets,
    unknownTokens,
    itemCandidates,
    hasMerchantHistory,
    parserContext,
  };
}
