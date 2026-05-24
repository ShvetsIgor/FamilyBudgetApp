/**
 * LAYER: semantic session — conversational runtime model.
 *
 * A SemanticSession tracks the full lifecycle of one conversational parse:
 * original input → clarification → correction → confirmation → resolution.
 *
 * Sessions are immutable-by-convention: every mutation function in
 * sessionManager.ts returns a NEW session object. The original is never
 * modified. This makes replay, undo, and diff trivially safe.
 *
 * Lifecycle states:
 *   active                — session open; no pending clarification
 *   awaiting_clarification— parser has unresolved ambiguity hints
 *   resolved              — all ambiguity resolved; ready to persist
 *   cancelled             — abandoned by user
 *
 * History model:
 *   parserContexts[]  — one entry per parse event (original + each re-parse)
 *   corrections[]     — applied corrections in chronological order
 *   undoneCorrections[]— corrections that were undone (redo stack)
 *   traces[]          — optional parser traces (may be empty for perf)
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - All fields deterministically derivable from prior state + operations.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import type { ParserContext } from './inputPipeline';
import type { ClarificationHint } from './semanticFragment';
import type { PurchaseGroup } from './purchaseGroup';

// ── Session status ────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'active'
  | 'awaiting_clarification'
  | 'resolved'
  | 'cancelled';

// ── Corrections ───────────────────────────────────────────────────────────────

export type CorrectionType =
  | 'category_correction'    // user selects a different category for a fragment
  | 'merchant_correction'    // user overrides the detected merchant
  | 'phrase_correction'      // user corrects a phrase type
  | 'split_adjustment'       // user toggles split recommendation
  | 'clarification_answer';  // user answers a clarification hint question

export interface CategoryCorrectionPayload {
  fragmentId: string;
  previousCategoryId: string | undefined;
  newCategoryId: string;
}

export interface MerchantCorrectionPayload {
  previousMerchant: string | undefined;
  newMerchant: string;
  previousMerchantKey: string | undefined;
  newMerchantKey: string;
}

export interface PhraseCorrectionPayload {
  phraseId: string;
  previousType: string;
  newType: string;
}

export interface SplitAdjustmentPayload {
  groupId: string;
  previousSplit: boolean;
  newSplit: boolean;
}

export interface ClarificationAnswerPayload {
  hintFragmentId: string;
  chosenCategoryId: string;
  hintKind: string;
}

export type CorrectionPayload =
  | CategoryCorrectionPayload
  | MerchantCorrectionPayload
  | PhraseCorrectionPayload
  | SplitAdjustmentPayload
  | ClarificationAnswerPayload;

export interface SemanticCorrection {
  id: string;
  type: CorrectionType;
  timestamp: number;
  payload: CorrectionPayload;
  /** Human-readable intent. */
  description: string;
}

// ── Clarification state ───────────────────────────────────────────────────────

/**
 * Tracks which clarification hints are still open and which have been resolved.
 * ambiguityLevel: 0.0 (unambiguous) → 1.0 (maximally ambiguous).
 * Computed as: pendingHints.length / max(1, totalHintsAtStart).
 */
export interface ClarificationState {
  /** Hints not yet answered. */
  pendingHints: ClarificationHint[];
  /** Fragment IDs of hints that have been resolved. */
  resolvedHintIds: string[];
  /** The question currently shown to the user (if any). */
  activeQuestion: string | undefined;
  /** Normalized ambiguity score. */
  ambiguityLevel: number;
  /** Total hints seen since this state was created (for ambiguityLevel computation). */
  totalHintsAtStart: number;
}

// ── Session ───────────────────────────────────────────────────────────────────

export interface SemanticSession {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Input as originally submitted. */
  originalInput: string;
  /** Input after any merchant/phrase corrections (may differ from original). */
  currentInput: string;
  /**
   * One ParserContext per parse event.
   * Index 0 = initial parse. Last = current effective context.
   * Corrections that don't change input don't add a new context.
   */
  parserContexts: ParserContext[];
  /**
   * Optional parser traces (present when tracing was requested).
   * Parallel to parserContexts.
   */
  traces: ParserTrace[];
  /** Clarification state when status = 'awaiting_clarification'. */
  clarificationState: ClarificationState | undefined;
  /** Groups that still need user decision. */
  pendingGroups: PurchaseGroup[];
  /** Groups that the user has confirmed or resolved. */
  resolvedGroups: PurchaseGroup[];
  /** All applied corrections in chronological order. */
  corrections: SemanticCorrection[];
  /** Corrections that were undone (redo stack). Re-applying re-moves to corrections[]. */
  undoneCorrections: SemanticCorrection[];
  status: SessionStatus;
}

// ── Session replay ────────────────────────────────────────────────────────────

export type ReplayStepType =
  | 'initial_parse'
  | 'correction_applied'
  | 'clarification_answered'
  | 'status_changed'
  | 'correction_undone';

export interface SessionReplayStep {
  stepIndex: number;
  type: ReplayStepType;
  inputAtStep: string;
  statusAtStep: SessionStatus;
  correctionAtStep?: SemanticCorrection;
  clarificationHintsAtStep: number; // count of pending hints
}

export interface SemanticSessionReplay {
  sessionId: string;
  totalSteps: number;
  steps: SessionReplayStep[];
  finalStatus: SessionStatus;
}
