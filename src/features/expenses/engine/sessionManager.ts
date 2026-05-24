/**
 * LAYER: session manager — semantic session lifecycle orchestration.
 *
 * Creates and mutates SemanticSession objects. Every function returns a NEW
 * session — the original is never modified (immutable-by-convention).
 *
 * Session lifecycle:
 *   createSession()            → status: active | awaiting_clarification
 *   applyCorrection()          → records correction, may re-parse or update status
 *   undoLastCorrection()       → pops last correction to undoneCorrections[]
 *   redoLastUndo()             → re-applies last undone correction
 *   resolveSession()           → status: resolved
 *   cancelSession()            → status: cancelled
 *   replaySession()            → SemanticSessionReplay with step-by-step history
 *
 * Re-parsing rules:
 *   merchant_correction  — triggers re-parse with updated merchant token
 *   phrase_correction    — no re-parse (phrase type metadata only)
 *   category_correction  — no re-parse (category metadata only)
 *   split_adjustment     — no re-parse (group metadata only)
 *   clarification_answer — triggers resolveHint() + status update
 *
 * Architecture invariants:
 *   - All functions are pure: same session + input → same output.
 *   - No mutations to input session objects.
 *   - No AI, no embeddings, no probabilistic logic.
 *   - parseInput() is the only external parsing dependency.
 */

import { parseInput } from './inputPipeline';
import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import {
  buildClarificationState,
  resolveHint,
  isFullyResolved,
  needsClarification,
} from './clarificationOrchestrator';
import type {
  SemanticSession,
  SemanticCorrection,
  SessionStatus,
  SemanticSessionReplay,
  SessionReplayStep,
  ClarificationAnswerPayload,
  MerchantCorrectionPayload,
} from './semanticSession';

// ── ID generation ─────────────────────────────────────────────────────────────

let _sessionSeq = 0;
let _correctionSeq = 0;

export function nextSessionId(): string {
  return `session_${Date.now()}_${_sessionSeq++}`;
}

export function nextCorrectionId(): string {
  return `corr_${Date.now()}_${_correctionSeq++}`;
}

/** Reset ID sequences — for testing only. */
export function resetSessionIds(): void {
  _sessionSeq = 0;
  _correctionSeq = 0;
}

// ── Derived status ────────────────────────────────────────────────────────────

function deriveStatus(
  session: Omit<SemanticSession, 'status'>,
): SessionStatus {
  if (session.clarificationState && !isFullyResolved(session.clarificationState)) {
    return 'awaiting_clarification';
  }
  return 'active';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a new SemanticSession from a raw input string.
 *
 * Runs parseInput() to produce the initial ParserContext.
 * Status is set to 'awaiting_clarification' if hints are present, else 'active'.
 *
 * @param raw     Raw user input.
 * @param memory  Optional suggestion memory.
 * @returns       Fresh SemanticSession.
 */
export function createSession(
  raw: string,
  memory?: SuggestionMemoryState,
): SemanticSession {
  const now = Date.now();
  const ctx = parseInput(raw, memory);

  const clarificationState = needsClarification(ctx)
    ? buildClarificationState(ctx)
    : undefined;

  const pendingGroups = ctx.purchaseGroups.filter((g) => g.suggestedSplit);

  const partial: Omit<SemanticSession, 'status'> = {
    id: nextSessionId(),
    createdAt: now,
    updatedAt: now,
    originalInput: raw,
    currentInput: raw,
    parserContexts: [ctx],
    traces: [],
    clarificationState,
    pendingGroups,
    resolvedGroups: [],
    corrections: [],
    undoneCorrections: [],
  };

  return { ...partial, status: deriveStatus(partial) };
}

/**
 * Apply a SemanticCorrection to a session.
 *
 * For clarification_answer: resolves the corresponding hint.
 * For merchant_correction: re-runs parseInput() with the new merchant token.
 * All other types: records correction and updates metadata only.
 *
 * Always returns a new session (immutable).
 *
 * @param session     Current session.
 * @param correction  The correction to apply.
 * @param memory      Optional suggestion memory (for re-parse).
 * @returns           New session with correction recorded.
 */
export function applyCorrection(
  session: SemanticSession,
  correction: SemanticCorrection,
  memory?: SuggestionMemoryState,
): SemanticSession {
  if (session.status === 'resolved' || session.status === 'cancelled') {
    return session; // closed sessions do not accept corrections
  }

  const now = Date.now();
  const newCorrections = [...session.corrections, correction];

  let newContexts = session.parserContexts;
  let newInput = session.currentInput;
  let newClarificationState = session.clarificationState;

  // merchant_correction: re-parse with corrected merchant token
  if (correction.type === 'merchant_correction') {
    const payload = correction.payload as MerchantCorrectionPayload;
    // Build corrected input by replacing the merchant token
    const correctedInput = session.currentInput.replace(
      new RegExp(`\\b${escapeRegex(payload.previousMerchant ?? '')}\\b`, 'i'),
      payload.newMerchant,
    ) || `${payload.newMerchant} ${session.currentInput}`;
    newInput = correctedInput;
    const newCtx = parseInput(correctedInput, memory);
    newContexts = [...session.parserContexts, newCtx];
    newClarificationState = needsClarification(newCtx)
      ? buildClarificationState(newCtx)
      : undefined;
  }

  // clarification_answer: resolve the hint
  if (correction.type === 'clarification_answer' && newClarificationState) {
    const payload = correction.payload as ClarificationAnswerPayload;
    newClarificationState = resolveHint(newClarificationState, payload.hintFragmentId);
  }

  const partial: Omit<SemanticSession, 'status'> = {
    ...session,
    updatedAt: now,
    currentInput: newInput,
    parserContexts: newContexts,
    clarificationState: newClarificationState,
    corrections: newCorrections,
    undoneCorrections: [], // applying a new correction clears the redo stack
  };

  return { ...partial, status: deriveStatus(partial) };
}

/**
 * Undo the last correction.
 * Moves it to undoneCorrections[] (redo stack) and reverts parserContexts.
 * Returns the same session unchanged if no corrections exist.
 */
export function undoLastCorrection(session: SemanticSession): SemanticSession {
  if (session.corrections.length === 0) return session;

  const lastCorrection = session.corrections[session.corrections.length - 1];
  const newCorrections = session.corrections.slice(0, -1);
  const newUndone = [...session.undoneCorrections, lastCorrection];

  // Revert parser context if the correction added one
  const addedContext =
    lastCorrection.type === 'merchant_correction' &&
    session.parserContexts.length > 1;
  const newContexts = addedContext
    ? session.parserContexts.slice(0, -1)
    : session.parserContexts;

  // Revert input if merchant was corrected
  const newInput = addedContext
    ? (session.parserContexts[session.parserContexts.length - 2]?.raw ?? session.originalInput)
    : session.currentInput;

  // Re-derive clarification state from the restored context
  const restoredCtx = newContexts[newContexts.length - 1];
  const newClarificationState =
    restoredCtx && needsClarification(restoredCtx)
      ? buildClarificationState(restoredCtx)
      : undefined;

  const partial: Omit<SemanticSession, 'status'> = {
    ...session,
    updatedAt: Date.now(),
    currentInput: newInput,
    parserContexts: newContexts,
    clarificationState: newClarificationState,
    corrections: newCorrections,
    undoneCorrections: newUndone,
  };

  return { ...partial, status: deriveStatus(partial) };
}

/**
 * Redo the last undone correction.
 * Pops from undoneCorrections[] and re-applies it via applyCorrection().
 * Returns the same session unchanged if nothing to redo.
 */
export function redoLastUndo(
  session: SemanticSession,
  memory?: SuggestionMemoryState,
): SemanticSession {
  if (session.undoneCorrections.length === 0) return session;

  const lastUndone = session.undoneCorrections[session.undoneCorrections.length - 1];
  const sessionWithoutLast: SemanticSession = {
    ...session,
    undoneCorrections: session.undoneCorrections.slice(0, -1),
  };

  return applyCorrection(sessionWithoutLast, lastUndone, memory);
}

/**
 * Mark the session as resolved (all ambiguity cleared, ready to persist).
 * Noop if already resolved or cancelled.
 */
export function resolveSession(session: SemanticSession): SemanticSession {
  if (session.status === 'cancelled') return session;
  return { ...session, status: 'resolved', updatedAt: Date.now() };
}

/**
 * Mark the session as cancelled (user abandoned the input).
 */
export function cancelSession(session: SemanticSession): SemanticSession {
  if (session.status === 'resolved') return session;
  return { ...session, status: 'cancelled', updatedAt: Date.now() };
}

/**
 * Produce a step-by-step replay of the session history.
 *
 * Each step corresponds to: initial parse, each correction, or status change.
 * Useful for debugging, diagnostics, and constructor session inspection.
 */
export function replaySession(session: SemanticSession): SemanticSessionReplay {
  const steps: SessionReplayStep[] = [];

  // Step 0: initial parse
  const initialCtx = session.parserContexts[0];
  steps.push({
    stepIndex: 0,
    type: 'initial_parse',
    inputAtStep: session.originalInput,
    statusAtStep: session.corrections.length === 0 ? session.status : 'active',
    clarificationHintsAtStep: initialCtx?.clarificationHints.length ?? 0,
  });

  // Steps 1+: one per correction
  for (let i = 0; i < session.corrections.length; i++) {
    const correction = session.corrections[i];
    const isClarification = correction.type === 'clarification_answer';
    const isMerchantCorrection = correction.type === 'merchant_correction';

    // Derive input at this step
    const ctxIdx = isMerchantCorrection ? Math.min(i + 1, session.parserContexts.length - 1) : 0;
    const ctxAtStep = session.parserContexts[ctxIdx];

    steps.push({
      stepIndex: i + 1,
      type: isClarification ? 'clarification_answered' : 'correction_applied',
      inputAtStep: ctxAtStep?.raw ?? session.currentInput,
      statusAtStep: i === session.corrections.length - 1 ? session.status : 'active',
      correctionAtStep: correction,
      clarificationHintsAtStep: ctxAtStep?.clarificationHints.length ?? 0,
    });
  }

  // Final status-change step if session is resolved/cancelled with no corrections
  if (
    (session.status === 'resolved' || session.status === 'cancelled') &&
    session.corrections.length === 0
  ) {
    steps.push({
      stepIndex: 1,
      type: 'status_changed',
      inputAtStep: session.currentInput,
      statusAtStep: session.status,
      clarificationHintsAtStep: 0,
    });
  }

  return {
    sessionId: session.id,
    totalSteps: steps.length,
    steps,
    finalStatus: session.status,
  };
}

/**
 * Get the current effective ParserContext (last in history).
 */
export function currentContext(session: SemanticSession) {
  return session.parserContexts[session.parserContexts.length - 1];
}

/**
 * True if the session can accept more corrections.
 */
export function isSessionOpen(session: SemanticSession): boolean {
  return session.status !== 'resolved' && session.status !== 'cancelled';
}

// ── Utility ───────────────────────────────────────────────────────────────────

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
