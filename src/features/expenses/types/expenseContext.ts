/**
 * LAYER: expense context — unified normalized context for the expense brain.
 *
 * ExpenseContext is the single object passed between:
 *   parser (inputPipeline) → classifier (merchantClassifier) →
 *   ranking (suggestionEngine) → confidence (confidenceEngine) → UI
 *
 * It COMPOSES over ParserContext — never replaces it.
 * Existing 1315 tests behind ParserContext remain untouched.
 *
 * Architecture invariants:
 *   - Pure value object. No methods, no mutations.
 *   - All optional source fields (amount, merchant) are null when absent.
 *   - parserContext is always present — gives access to raw pipeline state.
 *   - No AI, no embeddings. Deterministic build.
 */

import type { ParserContext } from '../engine/inputPipeline';

// ── Token classification ──────────────────────────────────────────────────────

/** Role assigned to each raw input token after full context analysis. */
export type TokenRole = 'merchant' | 'item' | 'amount' | 'noise';

/** A single input token annotated with its parsed role. */
export interface ClassifiedInputToken {
  raw: string;        // original casing from user input
  normalized: string; // lowercase + trimmed
  role: TokenRole;
}

// ── Confidence ────────────────────────────────────────────────────────────────

/**
 * Three-dimensional confidence profile for a parsed input.
 *
 * All values 0–1.
 *   amount   — certainty that the extracted amount is correct
 *   merchant — certainty that the merchant was correctly identified
 *   category — certainty that the top category suggestion is correct
 *   overall  — weighted composite (amount×0.3 + merchant×0.3 + category×0.4)
 */
export interface ConfidenceProfile {
  amount: number;
  merchant: number;
  category: number;
  overall: number;
}

// ── Signals ───────────────────────────────────────────────────────────────────

/** A single explainable signal contributing to the context build. */
export interface ContextSignal {
  kind: string;
  source: 'parser' | 'memory' | 'metadata' | 'history';
  weight: number; // 0–1 normalized contribution
  detail: string; // human-readable explanation
}

// ── Candidates ────────────────────────────────────────────────────────────────

/** A single category candidate with unified scoring and explanation. */
export interface CandidateCategory {
  categoryId: string;
  score: number;
  reason: string;       // primary reason label (from SuggestionReason.kind)
  signals: string[];    // all reason kinds contributing to this score
}

// ── ExpenseContext ────────────────────────────────────────────────────────────

/**
 * Unified normalized context for one expense input.
 *
 * Built by expenseContextBuilder.buildExpenseContext().
 * Consumed by:
 *   - UI components (quick add, chat, suggestion panels)
 *   - suggestionInspector (debug/explain)
 *   - quickAddState (state machine)
 *   - splitMemoryEngine (preset suggestions)
 */
export interface ExpenseContext {
  rawInput: string;

  // Parsed dimensions
  amount: number | null;
  merchant: string | null;      // display-form (original casing)
  merchantKey: string | null;   // normalized key for memory lookups

  // Token classification
  tokens: ClassifiedInputToken[];
  merchantTokens: string[];    // raw merchant tokens
  itemTokens: string[];        // raw item tokens
  normalizedTokens: string[];  // all non-noise, normalized

  // Ranked category candidates (from unified ranking pipeline)
  candidateCategories: CandidateCategory[];

  // 3D confidence profile
  confidence: ConfidenceProfile;

  // Explanation signals (for debug UI and inspector)
  signals: ContextSignal[];

  // Source pipeline output — for advanced consumers and testing
  parserContext: ParserContext;
}
