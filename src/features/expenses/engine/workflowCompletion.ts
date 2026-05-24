/**
 * LAYER: workflow completion — analyzes what blocks or allows completion.
 *
 * Exposes:
 *   - What blocks completion (hard blockers)
 *   - What is safe to defer (low-ambiguity optional items)
 *   - What requires hard user confirmation
 *   - What can auto-resolve if deferred
 *   - Semantic completion confidence (0–100)
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Same inputs → same output (deterministic).
 */

import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type {
  WorkflowCompletionState,
  CompletionBlocker,
  CompletionBlockerKind,
  DeferredItem,
} from './runtimeWorkflow';

// ── Blocker builders ──────────────────────────────────────────────────────────

function makeBlocker(
  kind: CompletionBlockerKind,
  targetId: string,
  description: string,
  isSafeToDefer: boolean,
): CompletionBlocker {
  return { kind, targetId, description, isSafeToDefer };
}

// ── Safety thresholds ─────────────────────────────────────────────────────────

const SAFE_DEFER_SCORE_THRESHOLD = 50; // hints below this score are safe to defer
const AUTO_RESOLVE_SCORE_THRESHOLD = 30; // hints below this can auto-resolve

// ── Completion analysis ───────────────────────────────────────────────────────

/**
 * Identify all items that block completion.
 */
export function findCompletionBlockers(
  session: SemanticSession,
  state: ResolutionState,
): CompletionBlocker[] {
  const blockers: CompletionBlocker[] = [];

  if (session.status === 'cancelled') {
    blockers.push(makeBlocker('cancelled_session', session.id, 'Session was cancelled.', false));
    return blockers;
  }

  for (const hintId of state.unresolvedHints) {
    const ctx = session.parserContexts[session.parserContexts.length - 1];
    const hint = ctx?.clarificationHints.find((h) => h.fragmentId === hintId);
    const isHighPriority = hint?.kind === 'conflicting_signals' || hint?.kind === 'unknown_merchant';
    blockers.push(makeBlocker(
      'unresolved_hint',
      hintId,
      `Unresolved ${hint?.kind ?? 'hint'} for fragment ${hintId}.`,
      !isHighPriority, // conflicting_signals and unknown_merchant cannot be safely deferred
    ));
  }

  for (const groupId of state.blockedResolutions) {
    blockers.push(makeBlocker(
      'blocked_resolution',
      groupId,
      `Resolution blocked for group ${groupId}.`,
      false, // blocked resolutions are never safe to defer
    ));
  }

  // Check split items missing categories
  for (const groupId of state.pendingGroups) {
    const group = session.pendingGroups.find((g) => g.id === groupId);
    if (group?.suggestedSplit) {
      const ctx = session.parserContexts[session.parserContexts.length - 1];
      const missingItems = group.itemFragmentIds.filter((id) => {
        const frag = ctx?.fragments.find((f) => f.id === id);
        return !frag?.candidateCategories?.length;
      });
      if (missingItems.length > 0) {
        blockers.push(makeBlocker(
          'incomplete_split',
          groupId,
          `Split group ${groupId} has ${missingItems.length} item(s) without categories.`,
          true, // split can be deferred (user can skip split)
        ));
      }
    }
  }

  return blockers;
}

/**
 * Identify hints safe to defer (low ambiguity, non-critical).
 */
export function findSafeToDefer(
  state: ResolutionState,
  scores: SessionAmbiguityReport,
): string[] {
  return state.unresolvedHints.filter((id) => {
    const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(id)));
    return score !== undefined && score.score < SAFE_DEFER_SCORE_THRESHOLD;
  });
}

/**
 * Identify hints that require explicit hard confirmation from the user.
 * These are high-score hints that cannot be auto-resolved.
 */
export function findRequiresHardConfirmation(
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
): string[] {
  return state.unresolvedHints.filter((id) => {
    const ctx = session.parserContexts[session.parserContexts.length - 1];
    const hint = ctx?.clarificationHints.find((h) => h.fragmentId === id);
    const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(id)));
    const isHighSeverity =
      hint?.kind === 'conflicting_signals' || hint?.kind === 'unknown_merchant';
    const isHighScore = score !== undefined && score.score >= 60;
    return isHighSeverity || isHighScore;
  });
}

/**
 * Identify hints that can auto-resolve when deferred (very low ambiguity).
 */
export function findCanAutoResolve(
  state: ResolutionState,
  scores: SessionAmbiguityReport,
): string[] {
  return state.unresolvedHints.filter((id) => {
    const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(id)));
    return score !== undefined && score.score < AUTO_RESOLVE_SCORE_THRESHOLD;
  });
}

/**
 * Compute semantic completion confidence: 0–100.
 *   100 = everything resolved, high-confidence suggestions
 *   0   = heavy ambiguity, many blockers
 */
export function computeCompletionConfidence(
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  deferredItems: DeferredItem[],
): number {
  const pendingCount =
    state.unresolvedHints.length +
    state.pendingGroups.length +
    state.blockedResolutions.length;

  if (pendingCount === 0 && state.blockedResolutions.length === 0) {
    // No pending items: confidence inversely proportional to overall ambiguity
    return Math.max(0, 100 - scores.overallScore);
  }

  const totalTracked =
    pendingCount + state.resolvedGroups.length + state.autoResolvedHints.length;
  if (totalTracked === 0) return 100;

  const resolvedFraction =
    (state.resolvedGroups.length + state.autoResolvedHints.length) / totalTracked;

  // Deferred items partially credit resolution
  const deferredCredit = deferredItems.filter((d) => !d.isResolved).length * 0.3;
  const adjustedResolved = Math.min(1, resolvedFraction + deferredCredit / totalTracked);

  return Math.round(adjustedResolved * (100 - scores.overallScore * 0.4));
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildCompletionState(
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  deferredItems: DeferredItem[] = [],
): WorkflowCompletionState {
  const blockers = findCompletionBlockers(session, state);

  // canComplete: no blockers at all
  const canComplete = blockers.length === 0 && session.status !== 'cancelled';

  // canCompleteWithDeferrals: all remaining blockers are safe to defer
  const nonDeferrableBlockers = blockers.filter((b) => !b.isSafeToDefer);
  const canCompleteWithDeferrals = nonDeferrableBlockers.length === 0 && session.status !== 'cancelled';

  const safeToDefer = findSafeToDefer(state, scores);
  const requiresHardConfirmation = findRequiresHardConfirmation(session, state, scores);
  const canAutoResolve = findCanAutoResolve(state, scores);
  const completionConfidence = computeCompletionConfidence(state, scores, deferredItems);

  return {
    canComplete,
    canCompleteWithDeferrals,
    completionConfidence,
    blockers,
    safeToDefer,
    requiresHardConfirmation,
    canAutoResolve,
  };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function hasHardBlockers(completionState: WorkflowCompletionState): boolean {
  return completionState.blockers.some((b) => !b.isSafeToDefer);
}

export function blockersOfKind(
  completionState: WorkflowCompletionState,
  kind: CompletionBlockerKind,
): CompletionBlocker[] {
  return completionState.blockers.filter((b) => b.kind === kind);
}

export function buildCompletionSummary(state: WorkflowCompletionState): string {
  if (state.canComplete) return 'Ready to save — all items resolved.';
  if (state.canCompleteWithDeferrals) {
    return `Ready with ${state.safeToDefer.length} deferred item(s). Confidence: ${state.completionConfidence}%.`;
  }
  const hard = state.blockers.filter((b) => !b.isSafeToDefer);
  return `${hard.length} blocker(s) require resolution before saving.`;
}
