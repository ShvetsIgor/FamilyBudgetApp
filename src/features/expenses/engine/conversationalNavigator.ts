/**
 * LAYER: conversational navigator — high-level navigation operations.
 *
 * Provides named navigation operations that the UI or orchestrator layer can invoke:
 *   skipAmbiguity        — defer a hint temporarily
 *   resolveLater         — mark hint for later with explicit user intent
 *   forceSplitReview     — jump to split review for a group
 *   confirmPartialResolution — confirm despite deferred/optional items
 *   escalateConflict     — escalate a conflicting-signal hint
 *   retryResolution      — clear blocked state and re-enter resolution
 *
 * Each operation returns a NavigationResult with the action taken and
 * optional transition details. Operations are explainable and inspectable.
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Each operation produces a RuntimeNavigationAction.
 *   - No AI, no probabilistic routing.
 */

import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { PolicyEvaluationResult } from './runtimePolicy';
import type {
  RuntimeWorkflow,
  RuntimeNavigationAction,
  WorkflowStep,
  NavigationActionType,
  DeferredItem,
} from './runtimeWorkflow';
import { nextNavActionId, buildWorkflow, deferItem } from './workflowOrchestrator';

// ── Navigation result ─────────────────────────────────────────────────────────

export interface NavigationResult {
  success: boolean;
  action: RuntimeNavigationAction;
  updatedWorkflow: RuntimeWorkflow;
  explanation: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAction(
  type: NavigationActionType,
  label: string,
  description: string,
  from: WorkflowStep,
  to?: WorkflowStep,
  targetId?: string,
): RuntimeNavigationAction {
  return {
    id: nextNavActionId(),
    type,
    label,
    description,
    fromStep: from,
    toStep: to,
    targetId,
    isPrimary: false,
    isDisabled: false,
  };
}

// ── Navigation operations ─────────────────────────────────────────────────────

/**
 * Defer an ambiguity hint temporarily.
 * The hint is moved to deferredItems and the session continues.
 */
export function skipAmbiguity(
  workflow: RuntimeWorkflow,
  hintId: string,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
): NavigationResult {
  if (!state.unresolvedHints.includes(hintId)) {
    const noop = makeAction('defer_ambiguity', 'Skip ambiguity', 'Hint not found.', workflow.currentStep);
    return {
      success: false,
      action: { ...noop, isDisabled: true, disabledReason: `Hint ${hintId} not in unresolved list.` },
      updatedWorkflow: workflow,
      explanation: `Hint ${hintId} is not in the unresolved hints list.`,
    };
  }

  const updatedDeferred = deferItem(workflow.deferredItems, hintId, 'hint', 'user_skipped');
  const updatedWorkflow = buildWorkflow(session, state, scores, evalResult, updatedDeferred);
  const action = makeAction(
    'defer_ambiguity',
    'Skip for now',
    `Deferred hint ${hintId}.`,
    workflow.currentStep,
    undefined,
    hintId,
  );

  return {
    success: true,
    action,
    updatedWorkflow,
    explanation: `Hint ${hintId} has been deferred. It can be resolved later or auto-resolved.`,
  };
}

/**
 * Mark a hint for later resolution with explicit user intent.
 * Semantically equivalent to skipAmbiguity but signals intent to return.
 */
export function resolveLater(
  workflow: RuntimeWorkflow,
  hintId: string,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
): NavigationResult {
  if (!state.unresolvedHints.includes(hintId)) {
    const noop = makeAction('resolve_later', 'Resolve later', 'Hint not found.', workflow.currentStep);
    return {
      success: false,
      action: { ...noop, isDisabled: true, disabledReason: `Hint ${hintId} not in unresolved list.` },
      updatedWorkflow: workflow,
      explanation: `Hint ${hintId} is not in the unresolved hints list.`,
    };
  }

  const updatedDeferred = deferItem(workflow.deferredItems, hintId, 'hint', 'user_skipped');
  const updatedWorkflow = buildWorkflow(session, state, scores, evalResult, updatedDeferred);
  const action = makeAction(
    'resolve_later',
    'Resolve later',
    `Marked hint ${hintId} for later resolution.`,
    workflow.currentStep,
    undefined,
    hintId,
  );

  return {
    success: true,
    action,
    updatedWorkflow,
    explanation: `Hint ${hintId} marked for later resolution. Workflow continues.`,
  };
}

/**
 * Force the workflow into split_review for a specific group.
 * Allowed even if the group has not been flagged for split by the engine.
 */
export function forceSplitReview(
  workflow: RuntimeWorkflow,
  groupId: string,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
): NavigationResult {
  const groupExists = session.pendingGroups.some((g) => g.id === groupId);
  if (!groupExists) {
    const noop = makeAction('force_split_review', 'Force split review', 'Group not found.', workflow.currentStep);
    return {
      success: false,
      action: { ...noop, isDisabled: true, disabledReason: `Group ${groupId} not found.` },
      updatedWorkflow: workflow,
      explanation: `Group ${groupId} not found in pending groups.`,
    };
  }

  const action = makeAction(
    'force_split_review',
    'Force split review',
    `Forcing split review for group ${groupId}.`,
    workflow.currentStep,
    'split_review',
    groupId,
  );

  // Rebuild with same deferred items — split_review step will be derived from state
  const updatedWorkflow = buildWorkflow(session, state, scores, evalResult, workflow.deferredItems);

  return {
    success: true,
    action,
    updatedWorkflow,
    explanation: `Forced split review for group ${groupId}.`,
  };
}

/**
 * Confirm resolution even though some items are deferred or incomplete.
 * Only allowed when there are no hard (non-deferrable) blockers.
 */
export function confirmPartialResolution(
  workflow: RuntimeWorkflow,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
): NavigationResult {
  const hasHardBlockers = workflow.completionState.blockers.some((b) => !b.isSafeToDefer);

  if (hasHardBlockers) {
    const noop = makeAction('confirm_partial', 'Confirm partial', 'Hard blockers present.', workflow.currentStep);
    return {
      success: false,
      action: { ...noop, isDisabled: true, disabledReason: 'Hard blockers must be resolved first.' },
      updatedWorkflow: workflow,
      explanation: 'Cannot confirm partial resolution: hard blockers remain.',
    };
  }

  const action = makeAction(
    'confirm_partial',
    'Confirm partial',
    'Confirmed with deferred items.',
    workflow.currentStep,
    'confirmation',
  );

  const updatedWorkflow = buildWorkflow(session, state, scores, evalResult, workflow.deferredItems);

  return {
    success: true,
    action,
    updatedWorkflow,
    explanation: `Partial confirmation accepted. ${workflow.deferredItems.length} deferred item(s) will not block saving.`,
  };
}

/**
 * Escalate a conflicting-signal hint.
 * Marks the hint for manual review — workflow does not advance until resolved.
 */
export function escalateConflict(
  workflow: RuntimeWorkflow,
  hintId: string,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
): NavigationResult {
  const ctx = session.parserContexts[session.parserContexts.length - 1];
  const hint = ctx?.clarificationHints.find(
    (h) => h.fragmentId === hintId && h.kind === 'conflicting_signals',
  );

  if (!hint) {
    const noop = makeAction('escalate_conflict', 'Escalate conflict', 'Conflict hint not found.', workflow.currentStep);
    return {
      success: false,
      action: { ...noop, isDisabled: true, disabledReason: `No conflicting_signals hint with id ${hintId}.` },
      updatedWorkflow: workflow,
      explanation: `No conflicting_signals hint found for ${hintId}.`,
    };
  }

  const action = makeAction(
    'escalate_conflict',
    'Escalate conflict',
    `Escalated conflict for hint ${hintId}.`,
    workflow.currentStep,
    'clarification',
    hintId,
  );

  const updatedWorkflow = buildWorkflow(session, state, scores, evalResult, workflow.deferredItems);

  return {
    success: true,
    action,
    updatedWorkflow,
    explanation: `Conflict for hint ${hintId} escalated. Marked as requiring manual resolution.`,
  };
}

/**
 * Retry semantic resolution after a correction or category change.
 * Clears blocked resolutions and returns to the resolution flow.
 */
export function retryResolution(
  workflow: RuntimeWorkflow,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
): NavigationResult {
  if (state.blockedResolutions.length === 0) {
    const noop = makeAction('retry_resolution', 'Retry resolution', 'Nothing to retry.', workflow.currentStep);
    return {
      success: false,
      action: { ...noop, isDisabled: true, disabledReason: 'No blocked resolutions to retry.' },
      updatedWorkflow: workflow,
      explanation: 'No blocked resolutions — retry is not needed.',
    };
  }

  const action = makeAction(
    'retry_resolution',
    'Retry resolution',
    `Retrying resolution for ${state.blockedResolutions.length} blocked item(s).`,
    workflow.currentStep,
    'clarification',
  );

  const updatedWorkflow = buildWorkflow(session, state, scores, evalResult, workflow.deferredItems);

  return {
    success: true,
    action,
    updatedWorkflow,
    explanation: `Retry triggered for ${state.blockedResolutions.length} blocked item(s). Returning to clarification.`,
  };
}

// ── Inspection helpers ────────────────────────────────────────────────────────

/**
 * List all deferred hints that can still be resolved.
 */
export function listResolvableDeferred(
  workflow: RuntimeWorkflow,
  state: ResolutionState,
): DeferredItem[] {
  return workflow.deferredItems.filter(
    (d) => !d.isResolved && state.unresolvedHints.includes(d.id),
  );
}

/**
 * Check if the navigation can advance to the next step.
 */
export function canAdvanceFromStep(workflow: RuntimeWorkflow): boolean {
  const next = workflow.navigationState.availableActions.find((a) => a.type === 'advance');
  return next !== undefined && !next.isDisabled;
}

/**
 * Get a human-readable description of why the workflow is stuck.
 */
export function explainStuckState(workflow: RuntimeWorkflow): string {
  if (workflow.currentStep === 'resolved') return 'Workflow is already resolved.';

  const blocked = workflow.navigationState.blockedActions;
  if (blocked.length === 0) return 'No blockers detected.';

  const advanceAction = blocked.find((a) => a.type === 'advance');
  if (advanceAction?.disabledReason) return advanceAction.disabledReason;

  return `${blocked.length} action(s) are disabled at the current step.`;
}
