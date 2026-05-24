/**
 * LAYER: workflow orchestrator — builds and advances RuntimeWorkflow.
 *
 * Manages workflow transitions, deferred ambiguity, and step ordering.
 * Consumes SemanticSession + ResolutionState + PolicyEvaluationResult.
 * Produces RuntimeWorkflow (step machine with navigation + completion state).
 *
 * Step ordering:
 *   input → clarification (when unresolved hints) → split_review (when suggestedSplit)
 *        → review (pending groups or data) → confirmation → resolved
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Same inputs → same workflow (deterministic).
 *   - buildWorkflow() is the primary entry point.
 *   - No UI or Redux dependencies.
 */

import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { PolicyEvaluationResult } from './runtimePolicy';
import type {
  RuntimeWorkflow,
  WorkflowStep,
  WorkflowNavigationState,
  WorkflowCompletionState,
  CompletionBlocker,
  DeferredItem,
  WorkflowTransition,
  RuntimeNavigationAction,
  NavigationActionType,
} from './runtimeWorkflow';
import { buildCompletionState } from './workflowCompletion';

// ── ID generation ─────────────────────────────────────────────────────────────

let _workflowSeq = 0;
let _navActionSeq = 0;

export function nextWorkflowId(): string {
  return `wf_${Date.now()}_${_workflowSeq++}`;
}

export function nextNavActionId(): string {
  return `nav_${Date.now()}_${_navActionSeq++}`;
}

export function resetWorkflowIds(): void {
  _workflowSeq = 0;
  _navActionSeq = 0;
}

// ── Step derivation ───────────────────────────────────────────────────────────

/**
 * Derive the current workflow step from session + resolution state.
 * Mirrors projectionEngine.deriveProjectionStage but returns WorkflowStep.
 */
export function deriveWorkflowStep(
  session: SemanticSession,
  state: ResolutionState,
): WorkflowStep {
  if (session.status === 'resolved') return 'resolved';
  if (session.status === 'cancelled') return 'resolved'; // treat as terminal

  const hasUnresolvedHints = state.unresolvedHints.length > 0;
  const hasPendingGroups = state.pendingGroups.length > 0;
  const hasSuggestedSplit = session.pendingGroups.some(
    (g) => state.pendingGroups.includes(g.id) && g.suggestedSplit,
  );
  const ctx = session.parserContexts[session.parserContexts.length - 1];

  if (hasUnresolvedHints) return 'clarification';
  if (hasSuggestedSplit) return 'split_review';
  if (hasPendingGroups) return 'review';
  if (ctx?.amount !== undefined || (ctx?.fragments.length ?? 0) > 0) return 'review';
  return 'input';
}

// ── Navigation action builders ────────────────────────────────────────────────

function makeNavAction(
  type: NavigationActionType,
  label: string,
  description: string,
  fromStep: WorkflowStep,
  toStep?: WorkflowStep,
  targetId?: string,
  isPrimary = false,
  isDisabled = false,
  disabledReason?: string,
): RuntimeNavigationAction {
  return {
    id: nextNavActionId(),
    type,
    label,
    description,
    fromStep,
    toStep,
    targetId,
    isPrimary,
    isDisabled,
    disabledReason,
  };
}

/**
 * Build available navigation actions for the current workflow step.
 */
export function buildNavigationActions(
  step: WorkflowStep,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
  deferredItems: DeferredItem[],
): RuntimeNavigationAction[] {
  const actions: RuntimeNavigationAction[] = [];
  const deferredIds = new Set(deferredItems.map((d) => d.id));

  switch (step) {
    case 'input': {
      const hasInput = (session.currentInput?.trim().length ?? 0) > 0;
      actions.push(makeNavAction(
        'advance',
        'Parse input',
        'Analyse the entered text and extract expense data.',
        'input',
        'clarification',
        undefined,
        true,
        !hasInput,
        hasInput ? undefined : 'Enter expense text before continuing.',
      ));
      actions.push(makeNavAction('cancel', 'Cancel', 'Cancel entry.', 'input'));
      break;
    }

    case 'clarification': {
      const unresolvedActive = state.unresolvedHints.filter((id) => !deferredIds.has(id));
      const hasHighPriority = evalResult.decisions.some(
        (d) => (d.action === 'ask' || d.action === 'escalate') &&
          !deferredIds.has(d.targetId),
      );

      // Advance when all active hints resolved
      const canAdvance = unresolvedActive.length === 0;
      actions.push(makeNavAction(
        'advance',
        'Continue',
        'Proceed to expense review.',
        'clarification',
        'review',
        undefined,
        canAdvance,
        !canAdvance,
        canAdvance ? undefined : `${unresolvedActive.length} hint(s) still pending.`,
      ));

      // Defer ambiguity for each unresolved low-priority hint
      const lowPriorityHints = state.unresolvedHints.filter((id) => {
        const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(id)));
        return score && score.score < 50 && !deferredIds.has(id);
      });
      for (const hintId of lowPriorityHints.slice(0, 3)) {
        actions.push(makeNavAction(
          'defer_ambiguity',
          'Skip for now',
          'Defer this ambiguity and continue.',
          'clarification',
          undefined,
          hintId,
        ));
      }

      // Resolve later for any unresolved hint
      for (const hintId of state.unresolvedHints.slice(0, 3)) {
        if (!deferredIds.has(hintId)) {
          actions.push(makeNavAction(
            'resolve_later',
            'Resolve later',
            'Mark this hint for later resolution.',
            'clarification',
            undefined,
            hintId,
          ));
        }
      }

      // Escalate conflicting signals
      const conflictHints = state.unresolvedHints.filter((id) => {
        const ctx = session.parserContexts[session.parserContexts.length - 1];
        return ctx?.clarificationHints.some(
          (h) => h.fragmentId === id && h.kind === 'conflicting_signals',
        );
      });
      for (const hintId of conflictHints.slice(0, 2)) {
        actions.push(makeNavAction(
          'escalate_conflict',
          'Escalate conflict',
          'Flag this merchant conflict for manual resolution.',
          'clarification',
          undefined,
          hintId,
        ));
      }

      actions.push(makeNavAction('cancel', 'Cancel', 'Cancel entry.', 'clarification'));
      break;
    }

    case 'split_review': {
      const splitGroup = session.pendingGroups.find(
        (g) => state.pendingGroups.includes(g.id) && g.suggestedSplit,
      );
      const allItemsReady = splitGroup
        ? splitGroup.itemFragmentIds.every((id) => {
            const ctx = session.parserContexts[session.parserContexts.length - 1];
            const frag = ctx?.fragments.find((f) => f.id === id);
            return frag?.candidateCategories && frag.candidateCategories.length > 0;
          })
        : false;

      actions.push(makeNavAction(
        'advance',
        'Confirm split',
        'Confirm the split and continue to review.',
        'split_review',
        'review',
        splitGroup?.id,
        allItemsReady,
        !allItemsReady,
        allItemsReady ? undefined : 'Assign categories to all split items first.',
      ));

      actions.push(makeNavAction(
        'defer_ambiguity',
        'Skip split',
        'Continue without splitting this purchase.',
        'split_review',
        'review',
        splitGroup?.id,
      ));

      if (splitGroup) {
        actions.push(makeNavAction(
          'force_split_review',
          'Force split review',
          'Review each item in detail before confirming.',
          'split_review',
          'split_review',
          splitGroup.id,
        ));
      }

      actions.push(makeNavAction('back', 'Back', 'Return to previous step.', 'split_review', 'clarification'));
      actions.push(makeNavAction('cancel', 'Cancel', 'Cancel entry.', 'split_review'));
      break;
    }

    case 'review': {
      const canConfirm =
        state.pendingGroups.length === 0 &&
        state.unresolvedHints.length === 0 &&
        state.blockedResolutions.length === 0;

      const hasBlockedItems = state.blockedResolutions.length > 0;
      const hasDeferred = deferredItems.length > 0;

      actions.push(makeNavAction(
        'advance',
        'Confirm',
        'Confirm and go to final review.',
        'review',
        'confirmation',
        undefined,
        true,
        !canConfirm && !hasDeferred,
        canConfirm || hasDeferred ? undefined : 'Resolve all pending items first.',
      ));

      if (hasDeferred) {
        actions.push(makeNavAction(
          'confirm_partial',
          'Save with deferrals',
          'Save the expense with deferred items unresolved.',
          'review',
          'confirmation',
          undefined,
          false,
        ));
      }

      if (hasBlockedItems) {
        actions.push(makeNavAction(
          'retry_resolution',
          'Retry resolution',
          `Retry resolution for ${state.blockedResolutions.length} blocked item(s).`,
          'review',
          'clarification',
        ));
      }

      actions.push(makeNavAction('back', 'Back', 'Return to clarification.', 'review', 'clarification'));
      actions.push(makeNavAction('cancel', 'Cancel', 'Cancel entry.', 'review'));
      break;
    }

    case 'confirmation': {
      actions.push(makeNavAction(
        'advance',
        'Save expense',
        'Save the expense.',
        'confirmation',
        'resolved',
        undefined,
        true,
      ));
      actions.push(makeNavAction('back', 'Edit', 'Return to review.', 'confirmation', 'review'));
      actions.push(makeNavAction('cancel', 'Cancel', 'Cancel entry.', 'confirmation'));
      break;
    }

    case 'resolved': {
      // Terminal — no navigation actions
      break;
    }
  }

  return actions;
}

/**
 * Build the WorkflowNavigationState for the current step.
 */
export function buildNavigationState(
  step: WorkflowStep,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
  deferredItems: DeferredItem[],
): WorkflowNavigationState {
  const all = buildNavigationActions(step, session, state, scores, evalResult, deferredItems);
  const available = all.filter((a) => !a.isDisabled);
  const blocked = all.filter((a) => a.isDisabled);
  const deferred = deferredItems.map((d) =>
    makeNavAction(
      'resolve_later',
      'Resolve deferred',
      `Deferred item: ${d.id}`,
      step,
      step,
      d.id,
    ),
  );

  const recommendedAction = available.find((a) => a.isPrimary) ?? available[0];

  return { availableActions: available, recommendedAction, blockedActions: blocked, deferredActions: deferred };
}

// ── Workflow builder ──────────────────────────────────────────────────────────

/**
 * Build a RuntimeWorkflow from the current session state.
 * This is the primary entry point for the workflow layer.
 */
export function buildWorkflow(
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
  deferredItems: DeferredItem[] = [],
): RuntimeWorkflow {
  const currentStep = deriveWorkflowStep(session, state);
  const completionState = buildCompletionState(session, state, scores, deferredItems);
  const navigationState = buildNavigationState(
    currentStep,
    session,
    state,
    scores,
    evalResult,
    deferredItems,
  );

  // Derive completed steps (all steps before current in the normal flow)
  const stepOrder: WorkflowStep[] = ['input', 'clarification', 'split_review', 'review', 'confirmation', 'resolved'];
  const currentIdx = stepOrder.indexOf(currentStep);
  const completedSteps: WorkflowStep[] = currentIdx > 0 ? stepOrder.slice(0, currentIdx) : [];

  const blockedSteps: WorkflowStep[] = session.status === 'cancelled' ? [currentStep] : [];

  const deferredSteps: WorkflowStep[] = deferredItems.length > 0 ? ['clarification'] : [];

  return {
    id: nextWorkflowId(),
    sessionId: session.id,
    currentStep,
    completedSteps,
    blockedSteps,
    deferredSteps,
    navigationState,
    completionState,
    deferredItems,
    updatedAt: Date.now(),
  };
}

// ── Workflow transitions ──────────────────────────────────────────────────────

/**
 * Validate a workflow transition.
 * Returns the transition with isValid flag.
 */
export function validateTransition(
  workflow: RuntimeWorkflow,
  action: RuntimeNavigationAction,
): WorkflowTransition {
  const transition: WorkflowTransition = {
    workflowId: workflow.id,
    fromStep: workflow.currentStep,
    toStep: action.toStep ?? workflow.currentStep,
    triggeredBy: action.type,
    targetId: action.targetId,
    timestamp: Date.now(),
    isValid: false,
    reason: undefined,
  };

  if (action.isDisabled) {
    return { ...transition, reason: action.disabledReason ?? 'Action is disabled.' };
  }

  // Cancel/back are always valid
  if (action.type === 'cancel' || action.type === 'back') {
    return { ...transition, isValid: true };
  }

  // Advance transitions must have a toStep
  if (!action.toStep) {
    return { ...transition, reason: 'No target step defined.' };
  }

  return { ...transition, isValid: true };
}

/**
 * Apply a navigation action to produce a new workflow.
 * Returns the same workflow if the action is invalid.
 */
export function applyNavigationAction(
  workflow: RuntimeWorkflow,
  action: RuntimeNavigationAction,
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
  evalResult: PolicyEvaluationResult,
): { workflow: RuntimeWorkflow; transition: WorkflowTransition } {
  const transition = validateTransition(workflow, action);

  if (!transition.isValid) {
    return { workflow, transition };
  }

  let updatedDeferredItems = [...workflow.deferredItems];

  // Handle defer/resolve-later actions
  if (action.type === 'defer_ambiguity' || action.type === 'resolve_later') {
    if (action.targetId) {
      const already = updatedDeferredItems.some((d) => d.id === action.targetId);
      if (!already) {
        updatedDeferredItems = [
          ...updatedDeferredItems,
          {
            id: action.targetId,
            kind: 'hint',
            deferredAt: Date.now(),
            reason: action.type === 'defer_ambiguity' ? 'user_skipped' : 'user_skipped',
            isResolved: false,
          },
        ];
      }
    }
  }

  const newWorkflow = buildWorkflow(session, state, scores, evalResult, updatedDeferredItems);

  return { workflow: newWorkflow, transition };
}

// ── Deferred item management ──────────────────────────────────────────────────

export function deferItem(
  deferredItems: DeferredItem[],
  id: string,
  kind: DeferredItem['kind'],
  reason: DeferredItem['reason'] = 'user_skipped',
): DeferredItem[] {
  const existing = deferredItems.find((d) => d.id === id);
  if (existing) return deferredItems;
  return [
    ...deferredItems,
    { id, kind, deferredAt: Date.now(), reason, isResolved: false },
  ];
}

export function resolveDeferred(
  deferredItems: DeferredItem[],
  id: string,
): DeferredItem[] {
  return deferredItems.map((d) =>
    d.id === id ? { ...d, isResolved: true, resolvedAt: Date.now() } : d,
  );
}

export function pendingDeferredItems(deferredItems: DeferredItem[]): DeferredItem[] {
  return deferredItems.filter((d) => !d.isResolved);
}
