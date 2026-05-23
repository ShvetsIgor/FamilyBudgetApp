/**
 * LAYER: input pipeline — modular, deterministic text-to-context transformation.
 *
 * Replaces the primitive quickAddParser with a staged pipeline that produces
 * a rich ParserContext consumed by the suggestion engine and orchestration layer.
 *
 * Architecture invariants:
 *   - Every stage is a pure function — same inputs → same output, always.
 *   - Stages operate on typed data (ClassifiedToken[]), not raw strings.
 *   - Memory is optional; pipeline degrades gracefully without it.
 *   - No AI, no embeddings, no probabilistic logic.
 *   - All weights/thresholds come from SCORING_POLICY, not inline constants.
 *
 * Pipeline stages:
 *   Stage 1: normalizeInput    — NFC + lowercase + collapse whitespace
 *   Stage 2: tokenizeInput     — split normalized text into raw tokens
 *   Stage 3: classifyTokens    — assign kind (amount | text | noise) to each
 *   Stage 4: extractAmount     — find last amount token; separate from rest
 *   Stage 5: detectMerchant    — identify merchant from text tokens (memory-aware)
 *   Stage 6: extractItems      — remaining text tokens = item candidates
 *   Stage 7: buildContext      — assemble ParserContext with signals + hints
 *
 * ParserContext is the canonical output. Use parseInput() as the entry point.
 * For backward compatibility, parseQuickAdd() wraps parseInput().
 */

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import { normalizeText, toMerchantKey, resolveAlias } from './inputNormalizer';
import { tokenizeAndClassify, type ClassifiedToken } from './tokenClassifier';
import { SCORING_POLICY } from './scoringPolicy';

// ── ParserContext model ───────────────────────────────────────────────────────

/**
 * Transparent signal explaining how a confidence conclusion was reached.
 * Inspectable — no hidden scoring.
 */
export type ConfidenceSignalKind =
  | 'amount_present'         // a numeric amount was extracted from input
  | 'merchant_known'         // merchant key exists in usage memory
  | 'tag_reinforced'         // merchant key has tag associations in memory
  | 'item_candidates_found'; // at least one item candidate beyond the merchant

export interface ConfidenceSignal {
  kind: ConfidenceSignalKind;
  detail?: string; // merchant key, tag token, etc.
}

/**
 * Hints suggesting the input may benefit from the split flow.
 */
export type SplitHintKind =
  | 'large_amount'      // amount >= SPLIT_AMOUNT_THRESHOLD
  | 'multiple_items';   // 2+ item candidates detected

export interface SplitHint {
  kind: SplitHintKind;
}

/**
 * Structured context produced by the full input pipeline.
 *
 * Consumed by:
 *   - useExpenseInputFlow (orchestration)
 *   - computeSuggestions (ranking — uses merchantKey)
 *   - UI (split hints, confidence signals)
 */
export interface ParserContext {
  /** Raw input, unmodified. */
  raw: string;
  /** Normalized input (NFC + lowercase + collapsed). */
  normalizedInput: string;
  /** Extracted numeric amount, or undefined if none found. */
  amount: number | undefined;
  /** Display-form merchant name (original casing preserved). */
  merchant: string | undefined;
  /** Normalized merchant key for memory lookup (lowercase + alias-resolved). */
  merchantKey: string | undefined;
  /**
   * Tag tokens derived from merchantKey.
   * Currently a single-element array; ready for multi-token extension.
   */
  tags: string[];
  /**
   * Non-merchant, non-amount text tokens.
   * Potential item descriptions — useful for split flow pre-population.
   */
  itemCandidates: string[];
  /** Transparent confidence signals — fully inspectable, no hidden scoring. */
  confidenceSignals: ConfidenceSignal[];
  /** Hints that split flow may be appropriate for this input. */
  splitHints: SplitHint[];
}

// ── Stage 4: Extract amount ───────────────────────────────────────────────────

/**
 * Find the last amount token (matching quickAddParser behavior).
 * Returns extracted value and remaining non-amount tokens.
 */
function extractAmount(tokens: ClassifiedToken[]): {
  amount: number | undefined;
  rest: ClassifiedToken[];
} {
  let amountIdx = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].kind === 'amount') {
      amountIdx = i;
      break;
    }
  }

  if (amountIdx === -1) {
    return { amount: undefined, rest: tokens };
  }

  return {
    amount: tokens[amountIdx].numericValue,
    rest: [...tokens.slice(0, amountIdx), ...tokens.slice(amountIdx + 1)],
  };
}

// ── Stage 5: Detect merchant ──────────────────────────────────────────────────

/**
 * Identify the merchant from non-amount text tokens.
 *
 * Memory-aware heuristic:
 *   1. If the first text token (alias-resolved) is a known merchant key in memory,
 *      use it as the merchant and treat remaining text as item candidates.
 *   2. Otherwise (no memory or unknown merchant): join all text tokens as merchant.
 *      This preserves backward-compatible behavior.
 *
 * Returns the display merchant (original casing), its normalized key, and
 * the remaining tokens not claimed by merchant detection.
 */
function detectMerchant(
  tokens: ClassifiedToken[],
  memory?: SuggestionMemoryState,
): {
  merchant: string | undefined;
  merchantKey: string | undefined;
  rest: ClassifiedToken[];
} {
  const textTokens = tokens.filter((t) => t.kind === 'text');

  if (textTokens.length === 0) {
    return { merchant: undefined, merchantKey: undefined, rest: tokens };
  }

  // Attempt memory-aware single-token merchant detection
  if (memory && textTokens.length >= 2) {
    const firstKey = resolveAlias(textTokens[0].normalized);
    if (memory.merchants[firstKey] && memory.merchants[firstKey].length > 0) {
      // First token is a known merchant — rest are item candidates
      const restTokens = tokens.filter((t) => t !== textTokens[0]);
      return {
        merchant: textTokens[0].raw,
        merchantKey: firstKey,
        rest: restTokens,
      };
    }
  }

  // Fallback: all text tokens form the merchant (backward-compatible)
  const merchantRaw = textTokens.map((t) => t.raw).join(' ');
  const merchantKey = toMerchantKey(merchantRaw);
  return {
    merchant: merchantRaw || undefined,
    merchantKey: merchantKey || undefined,
    rest: [],
  };
}

// ── Stage 6: Extract item candidates ─────────────────────────────────────────

/**
 * Collect remaining text tokens as item candidates.
 * Noise tokens are excluded. Order is preserved.
 */
function extractItemCandidates(rest: ClassifiedToken[]): string[] {
  return rest
    .filter((t) => t.kind === 'text')
    .map((t) => t.raw);
}

// ── Stage 7: Build context ────────────────────────────────────────────────────

function buildConfidenceSignals(
  amount: number | undefined,
  merchantKey: string | undefined,
  itemCandidates: string[],
  memory?: SuggestionMemoryState,
): ConfidenceSignal[] {
  const signals: ConfidenceSignal[] = [];

  if (amount !== undefined) {
    signals.push({ kind: 'amount_present' });
  }

  if (merchantKey && memory) {
    if (memory.merchants[merchantKey]?.length > 0) {
      signals.push({ kind: 'merchant_known', detail: merchantKey });
    }
    const hasTagAssoc = (memory.tagAssociations ?? []).some((a) => a.tag === merchantKey);
    if (hasTagAssoc) {
      signals.push({ kind: 'tag_reinforced', detail: merchantKey });
    }
  }

  if (itemCandidates.length >= 1) {
    signals.push({ kind: 'item_candidates_found', detail: itemCandidates.join(', ') });
  }

  return signals;
}

function buildSplitHints(
  amount: number | undefined,
  itemCandidates: string[],
): SplitHint[] {
  const hints: SplitHint[] = [];
  if (amount !== undefined && amount >= SCORING_POLICY.thresholds.splitAmountHint) {
    hints.push({ kind: 'large_amount' });
  }
  if (itemCandidates.length >= 2) {
    hints.push({ kind: 'multiple_items' });
  }
  return hints;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the full 7-stage input pipeline.
 *
 * @param raw     Raw user input string (any casing, any whitespace).
 * @param memory  Optional suggestion memory for merchant-aware stage 5.
 * @returns       Structured ParserContext for use by orchestration + suggestion engine.
 *
 * Examples:
 *   parseInput("Dabbah 350")
 *     → { amount: 350, merchant: "Dabbah", merchantKey: "dabbah", tags: ["dabbah"], ... }
 *
 *   parseInput("dabah молоко 350")   // alias resolution
 *     → { amount: 350, merchant: "dabah молоко", merchantKey: "dabbah молоко", ... }
 *
 *   parseInput("Dabbah молоко 350", memoryWithDabbah)
 *     → { amount: 350, merchant: "Dabbah", merchantKey: "dabbah",
 *         itemCandidates: ["молоко"], ... }
 *
 *   parseInput("зарплата 15000")
 *     → { amount: 15000, merchant: "зарплата", merchantKey: "зарплата", ... }
 *     (intent detection handled separately by intentDetector.ts)
 */
export function parseInput(raw: string, memory?: SuggestionMemoryState): ParserContext {
  // Stage 1: normalize
  const normalizedInput = normalizeText(raw);
  if (!normalizedInput) {
    return emptyContext(raw);
  }

  // Stage 2+3: tokenize + classify
  const classified = tokenizeAndClassify(normalizedInput);

  // Stage 4: extract amount
  const { amount, rest: afterAmount } = extractAmount(classified);

  // Stage 5: detect merchant
  const { merchant, merchantKey, rest: afterMerchant } = detectMerchant(afterAmount, memory);

  // Stage 6: extract item candidates
  const itemCandidates = extractItemCandidates(afterMerchant);

  // Stage 7: build context
  const tags = merchantKey ? [merchantKey] : [];
  const confidenceSignals = buildConfidenceSignals(amount, merchantKey, itemCandidates, memory);
  const splitHints = buildSplitHints(amount, itemCandidates);

  return {
    raw,
    normalizedInput,
    amount,
    merchant,
    merchantKey,
    tags,
    itemCandidates,
    confidenceSignals,
    splitHints,
  };
}

function emptyContext(raw: string): ParserContext {
  return {
    raw,
    normalizedInput: '',
    amount: undefined,
    merchant: undefined,
    merchantKey: undefined,
    tags: [],
    itemCandidates: [],
    confidenceSignals: [],
    splitHints: [],
  };
}
