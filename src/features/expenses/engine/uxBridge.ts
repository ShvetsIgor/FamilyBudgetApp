/**
 * LAYER: UX bridge — constructor/runtime integration point for the projection layer.
 *
 * Provides:
 *   - Opening sessions from runtime context
 *   - Inspecting grouped ambiguities as view models
 *   - Approving semantic corrections with UX feedback
 *   - Replaying projected conversations for debugging/preview
 *   - Validating UX impact of semantic changes before applying them
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - No UI dependencies (no Redux, no React).
 *   - Delegates to projectionEngine + constructorBridge + policyBridge.
 *   - Returns only RuntimeProjection / view model types (no raw engine types).
 */

import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';
import type { SemanticAction } from './semanticAction';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { PolicyEvaluationResult } from './runtimePolicy';
import type { RuntimePolicy } from './runtimePolicy';
import type { SemanticChangeSet } from './semanticChangeset';
import type {
  RuntimeProjection,
  SuggestionProjection,
  ClarificationGroup,
  SemanticConflictViewModel,
} from './runtimeProjection';
import { buildRuntimeProjection, deriveProjectionStage } from './projectionEngine';
import { applyDefaultPolicies } from './policyEngine';
import { scoreSessionAmbiguity } from './ambiguityScorer';
import { deriveResolutionState } from './resolutionEngine';
import { buildActionSuggestions } from './actionSuggester';
import { replaySessionWithPolicies } from './policyBridge';
import { groupClarificationCards, buildClarificationCards, filterGroupsForBehavior } from './clarificationPresenter';

// ── Session opening ───────────────────────────────────────────────────────────

export interface UxSessionSnapshot {
  sessionId: string;
  projection: RuntimeProjection;
  scores: SessionAmbiguityReport;
  evalResult: PolicyEvaluationResult;
  state: ResolutionState;
}

/**
 * Build a full UX snapshot from a SemanticSession.
 * This is the primary entry point for UI components that need projection data.
 */
export function openSessionProjection(
  session: SemanticSession,
  actions: SemanticAction[] = [],
  externalSuggestions: SuggestionProjection[] = [],
  behavior = 'ask_immediately',
): UxSessionSnapshot {
  const state = deriveResolutionState(session, actions);
  const scores = scoreSessionAmbiguity(session, state);
  const evalResult = applyDefaultPolicies(state, session, scores);

  const projection = buildRuntimeProjection(
    session,
    state,
    scores,
    evalResult,
    behavior,
    externalSuggestions,
  );

  return { sessionId: session.id, projection, scores, evalResult, state };
}

// ── Ambiguity inspection ──────────────────────────────────────────────────────

export interface AmbiguityInspectionResult {
  groups: ClarificationGroup[];
  totalCards: number;
  primaryQuestion: string | undefined;
  requiresUserInput: boolean;
  dominantKind: string | undefined;
}

/**
 * Inspect grouped ambiguities for a session as a UX-ready view model.
 * Useful for constructor tooling that needs to preview clarification layout.
 */
export function inspectGroupedAmbiguities(
  session: SemanticSession,
  actions: SemanticAction[] = [],
  behavior = 'ask_immediately',
): AmbiguityInspectionResult {
  const state = deriveResolutionState(session, actions);
  const scores = scoreSessionAmbiguity(session, state);
  const evalResult = applyDefaultPolicies(state, session, scores);

  const ctx = session.parserContexts[session.parserContexts.length - 1];
  const allHints = ctx?.clarificationHints ?? [];
  const cards = buildClarificationCards(allHints, evalResult.decisions);
  const allGroups = groupClarificationCards(cards);
  const groups = filterGroupsForBehavior(allGroups, behavior);

  const totalCards = groups.reduce((sum, g) => sum + g.cards.length, 0);
  const primaryQuestion = groups[0]?.cards[0]?.question;
  const requiresUserInput = evalResult.decisions.some(
    (d) => d.action === 'ask' || d.action === 'escalate',
  );
  const dominantKind = groups[0]?.kind;

  return { groups, totalCards, primaryQuestion, requiresUserInput, dominantKind };
}

// ── Semantic conflict view models ─────────────────────────────────────────────

/**
 * Extract semantic conflicts from a session as UX-ready view models.
 */
export function extractConflictViewModels(
  session: SemanticSession,
): SemanticConflictViewModel[] {
  const ctx = session.parserContexts[session.parserContexts.length - 1];
  if (!ctx) return [];

  const conflictHints = ctx.clarificationHints.filter(
    (h) => h.kind === 'conflicting_signals',
  );

  return conflictHints.map((hint, i) => ({
    conflictId: `conflict_${session.id}_${i}`,
    kind: hint.kind,
    tokens: hint.candidates,
    explanation: hint.message ?? 'Competing signals detected for this fragment.',
    resolutionOptions: hint.candidates,
  }));
}

// ── Correction approval ───────────────────────────────────────────────────────

export interface CorrectionApprovalResult {
  approved: boolean;
  correctionId: string;
  projectionAfter: RuntimeProjection | undefined;
  stageChange: { from: string; to: string } | undefined;
}

/**
 * Preview the UX impact of approving a correction.
 * Returns the projected state after the correction would be applied.
 */
export function previewCorrectionApproval(
  session: SemanticSession,
  correctionId: string,
  actions: SemanticAction[] = [],
  externalSuggestions: SuggestionProjection[] = [],
): CorrectionApprovalResult {
  const correction = session.corrections.find((c) => c.id === correctionId);
  if (!correction) {
    return { approved: false, correctionId, projectionAfter: undefined, stageChange: undefined };
  }

  const state = deriveResolutionState(session, actions);
  const scores = scoreSessionAmbiguity(session, state);
  const evalResult = applyDefaultPolicies(state, session, scores);

  const stageBefore = deriveProjectionStage(session, state);
  const projectionAfter = buildRuntimeProjection(
    session,
    state,
    scores,
    evalResult,
    'ask_immediately',
    externalSuggestions,
  );
  const stageAfter = projectionAfter.currentStage;

  return {
    approved: true,
    correctionId,
    projectionAfter,
    stageChange: stageBefore !== stageAfter ? { from: stageBefore, to: stageAfter } : undefined,
  };
}

// ── Conversation replay ───────────────────────────────────────────────────────

export interface ProjectedReplayStep {
  stepIndex: number;
  eventKind: string;
  projectionSnapshot: RuntimeProjection;
  stageAtStep: string;
  canSubmitAtStep: boolean;
}

export interface ProjectedConversationReplay {
  sessionId: string;
  steps: ProjectedReplayStep[];
  finalProjection: RuntimeProjection;
  totalSteps: number;
}

/**
 * Replay a session's actions as a sequence of projected snapshots.
 * Useful for debugging and visual replay in constructor tooling.
 */
export function replayProjectedConversation(
  session: SemanticSession,
  actions: SemanticAction[],
  policies: RuntimePolicy[],
  externalSuggestions: SuggestionProjection[] = [],
): ProjectedConversationReplay {
  const policyReplay = replaySessionWithPolicies(session, actions, policies);

  // Build a projection for each action step
  const steps: ProjectedReplayStep[] = actions.map((action, i) => {
    const actionsUpTo = actions.slice(0, i + 1);
    const stepState = deriveResolutionState(session, actionsUpTo);
    const stepScores = scoreSessionAmbiguity(session, stepState);
    const stepEval = applyDefaultPolicies(stepState, session, stepScores);

    const snapshot = buildRuntimeProjection(
      session,
      stepState,
      stepScores,
      stepEval,
      'ask_immediately',
      externalSuggestions,
    );

    return {
      stepIndex: i,
      eventKind: action.type,
      projectionSnapshot: snapshot,
      stageAtStep: snapshot.currentStage,
      canSubmitAtStep: snapshot.canSubmit,
    };
  });

  const finalProjection = buildRuntimeProjection(
    session,
    policyReplay.resolutionState,
    policyReplay.scores,
    policyReplay.evaluationResult,
    'ask_immediately',
    externalSuggestions,
  );

  return {
    sessionId: session.id,
    steps,
    finalProjection,
    totalSteps: steps.length,
  };
}

// ── UX impact validation ──────────────────────────────────────────────────────

export interface UxImpactValidation {
  changeset: SemanticChangeset;
  projectionBefore: RuntimeProjection;
  projectionAfter: RuntimeProjection | undefined;
  stageChange: { from: string; to: string } | undefined;
  clarificationCountChange: number;
  isBreaking: boolean;
  warnings: string[];
}

/**
 * Validate the UX impact of applying a semantic changeset.
 * Compares projection before and after the change to detect regressions.
 */
export function validateUxImpact(
  session: SemanticSession,
  changeset: SemanticChangeset,
  actions: SemanticAction[] = [],
  externalSuggestions: SuggestionProjection[] = [],
): UxImpactValidation {
  const warnings: string[] = [];

  // Build projection before
  const stateBefore = deriveResolutionState(session, actions);
  const scoresBefore = scoreSessionAmbiguity(session, stateBefore);
  const evalBefore = applyDefaultPolicies(stateBefore, session, scoresBefore);
  const projectionBefore = buildRuntimeProjection(
    session,
    stateBefore,
    scoresBefore,
    evalBefore,
    'ask_immediately',
    externalSuggestions,
  );
  const clarificationsBefore = projectionBefore.groupedClarifications.reduce(
    (sum, g) => sum + g.cards.length,
    0,
  );

  // Preview changeset and derive "after" projection
  const preview = previewParserOutput(session, changeset);
  let projectionAfter: RuntimeProjection | undefined;
  let clarificationCountChange = 0;
  let stageChange: { from: string; to: string } | undefined;
  let isBreaking = false;

  if (preview.simulatedSession) {
    const stateAfter = deriveResolutionState(preview.simulatedSession, actions);
    const scoresAfter = scoreSessionAmbiguity(preview.simulatedSession, stateAfter);
    const evalAfter = applyDefaultPolicies(stateAfter, preview.simulatedSession, scoresAfter);
    projectionAfter = buildRuntimeProjection(
      preview.simulatedSession,
      stateAfter,
      scoresAfter,
      evalAfter,
      'ask_immediately',
      externalSuggestions,
    );

    const clarificationsAfter = projectionAfter.groupedClarifications.reduce(
      (sum, g) => sum + g.cards.length,
      0,
    );
    clarificationCountChange = clarificationsAfter - clarificationsBefore;

    const stageBefore = projectionBefore.currentStage;
    const stageAfter = projectionAfter.currentStage;
    if (stageBefore !== stageAfter) {
      stageChange = { from: stageBefore, to: stageAfter };
    }

    // Detect regressions
    if (projectionBefore.canSubmit && !projectionAfter.canSubmit) {
      isBreaking = true;
      warnings.push('Changeset blocks submission that was previously allowed.');
    }
    if (clarificationCountChange > 2) {
      warnings.push(`Changeset adds ${clarificationCountChange} new clarification cards.`);
    }
    if (stageChange && stageBefore === 'resolved') {
      isBreaking = true;
      warnings.push('Changeset reverts a resolved session to an earlier stage.');
    }
  } else {
    warnings.push('Changeset simulation did not produce a valid session — impact unknown.');
    isBreaking = preview.errors.length > 0;
  }

  return {
    changeset,
    projectionBefore,
    projectionAfter,
    stageChange,
    clarificationCountChange,
    isBreaking,
    warnings,
  };
}

// ── Action summary ────────────────────────────────────────────────────────────

export interface UxActionSummary {
  sessionId: string;
  pendingActions: ReturnType<typeof buildActionSuggestions>;
  hasHighUrgency: boolean;
  hasBlockedItems: boolean;
  canSubmit: boolean;
}

/**
 * Summarize pending UX actions for a session.
 * Lightweight — does not build a full projection.
 */
export function summarizeUxActions(
  session: SemanticSession,
  actions: SemanticAction[] = [],
): UxActionSummary {
  const state = deriveResolutionState(session, actions);
  const scores = scoreSessionAmbiguity(session, state);
  const evalResult = applyDefaultPolicies(state, session, scores);

  const pendingActions = buildActionSuggestions(session, state, evalResult, scores);
  const hasHighUrgency = pendingActions.some((a) => a.urgency === 'high');
  const hasBlockedItems = state.blockedResolutions.length > 0;
  const canSubmit =
    session.status !== 'cancelled' &&
    state.pendingGroups.length === 0 &&
    state.unresolvedHints.length === 0 &&
    state.blockedResolutions.length === 0;

  return { sessionId: session.id, pendingActions, hasHighUrgency, hasBlockedItems, canSubmit };
}
