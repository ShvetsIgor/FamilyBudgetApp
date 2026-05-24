/**
 * LAYER: projection engine — builds RuntimeProjection from engine state.
 *
 * This is the main entry point for the UX layer.
 * Consumes: SemanticSession + ResolutionState + scores + policy decisions + behavior
 * Produces: RuntimeProjection (UX-ready, no raw engine types)
 *
 * Stage derivation algorithm:
 *   resolved    → session.status === 'resolved'
 *   split       → pending groups with suggestedSplit + no unresolved hints
 *   clarification→ unresolved hints exist
 *   review      → hints resolved, groups or amount to confirm
 *   input       → empty / initial
 *
 * Architecture invariants:
 *   - Pure function. Same inputs → same projection.
 *   - All UX logic is isolated here — components must not replicate it.
 *   - externalSuggestions: caller provides pre-computed suggestions
 *     (engine doesn't call suggestionEngine directly — no UI/Redux deps).
 */

import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { PolicyEvaluationResult } from './runtimePolicy';
import type {
  RuntimeProjection,
  ProjectionStage,
  SuggestionProjection,
  ClarificationGroup,
} from './runtimeProjection';
import { buildResolutionProjection } from './resolutionProgress';
import { buildClarificationCards, groupClarificationCards, filterGroupsForBehavior } from './clarificationPresenter';
import { buildSplitProjection } from './splitReviewOrchestrator';
import { suggestNextAction } from './actionSuggester';

// ── Stage derivation ──────────────────────────────────────────────────────────

export function deriveProjectionStage(
  session: SemanticSession,
  state: ResolutionState,
): ProjectionStage {
  if (session.status === 'resolved') return 'resolved';
  if (session.status === 'cancelled') return 'resolved'; // treat cancelled as terminal

  const hasUnresolvedHints = state.unresolvedHints.length > 0;
  const hasPendingGroups = state.pendingGroups.length > 0;
  const hasSuggestedSplit = session.pendingGroups.some((g) =>
    state.pendingGroups.includes(g.id) && g.suggestedSplit,
  );
  const ctx = session.parserContexts[session.parserContexts.length - 1];

  if (hasUnresolvedHints) return 'clarification';
  if (hasSuggestedSplit) return 'split';
  if (hasPendingGroups) return 'review';
  if (ctx?.amount !== undefined || (ctx?.fragments.length ?? 0) > 0) return 'review';
  return 'input';
}

// ── Suggestion mapping ────────────────────────────────────────────────────────

/**
 * Map raw ScoredSuggestion-like objects to SuggestionProjection view models.
 * Caller provides pre-computed suggestions; projection engine maps them to VM.
 */
export function mapToSuggestionProjections(
  rawSuggestions: Array<{
    categoryId: string;
    score: number;
    reasons: Array<{ kind: string; [key: string]: unknown }>;
    isHabit?: boolean;
  }>,
): SuggestionProjection[] {
  return rawSuggestions.map((s, i) => ({
    categoryId: s.categoryId,
    label: s.categoryId, // UI maps categoryId → display name
    score: s.score,
    reasons: s.reasons.map((r) => r.kind),
    isHabit: s.isHabit ?? false,
    isPrimary: i === 0,
  }));
}

// ── Main projection builder ───────────────────────────────────────────────────

export function buildRuntimeProjection(
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
  behavior: string,
  externalSuggestions: SuggestionProjection[] = [],
): RuntimeProjection {
  const ctx = session.parserContexts[session.parserContexts.length - 1];

  // 1. Stage
  const currentStage = deriveProjectionStage(session, state);

  // 2. Clarification groups
  const allHints = ctx?.clarificationHints ?? [];
  const cards = buildClarificationCards(allHints, evalResult.decisions);
  const allGroups = groupClarificationCards(cards);
  const groupedClarifications = filterGroupsForBehavior(allGroups, behavior);

  // 3. Split review (first pending group with suggestedSplit)
  const splitGroup = ctx
    ? session.pendingGroups.find((g) => state.pendingGroups.includes(g.id) && g.suggestedSplit)
    : undefined;
  const splitReview = splitGroup && ctx ? buildSplitProjection(splitGroup, ctx) : undefined;

  // 4. Resolution progress
  const resolutionProgress = buildResolutionProjection(state, scores);

  // 5. Recommended next action
  const recommendedNextAction = suggestNextAction(session, state, evalResult, scores);

  // 6. canSubmit: no pending, no blocked, status not cancelled
  const canSubmit =
    session.status !== 'cancelled' &&
    state.pendingGroups.length === 0 &&
    state.unresolvedHints.length === 0 &&
    state.blockedResolutions.length === 0;

  return {
    sessionId: session.id,
    currentStage,
    groupedClarifications,
    visibleSuggestions: externalSuggestions,
    splitReview,
    resolutionProgress,
    recommendedNextAction,
    currentInput: session.currentInput,
    canSubmit,
  };
}

// ── Derived helpers ───────────────────────────────────────────────────────────

/**
 * True when the projection requires any user interaction before submission.
 */
export function requiresUserInteraction(projection: RuntimeProjection): boolean {
  return (
    projection.groupedClarifications.length > 0 ||
    (projection.splitReview !== undefined && !projection.splitReview.canConfirm)
  );
}

/**
 * Count the total number of visible clarification cards across all groups.
 */
export function countTotalVisibleCards(projection: RuntimeProjection): number {
  return projection.groupedClarifications.reduce(
    (sum, g) => sum + g.cards.length,
    0,
  );
}

/**
 * Get the first card that should be shown to the user.
 */
export function getPrimaryProjectionCard(
  projection: RuntimeProjection,
): RuntimeProjection['groupedClarifications'][0]['cards'][0] | undefined {
  return projection.groupedClarifications[0]?.cards[0];
}

/**
 * True when the split review is fully configured (all items have categories).
 */
export function isSplitReviewComplete(projection: RuntimeProjection): boolean {
  return projection.splitReview?.canConfirm ?? true;
}
