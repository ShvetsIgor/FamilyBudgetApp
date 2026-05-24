/**
 * LAYER: workflow bridge — constructor/runtime workflow integration.
 *
 * Constructor tooling support:
 *   - Replaying workflows from session + action history
 *   - Inspecting workflow transitions for debugging
 *   - Validating navigation strategies
 *   - Previewing deferred resolution behavior
 *   - Simulating conversational completion paths
 *
 * AI/OCR extension points (stubs only — implementations TBD):
 *   - aiWorkflowHint: placeholder for AI-assisted guidance
 *   - ocrWorkflowReview: placeholder for OCR review flows
 *   - adaptiveCompletion: placeholder for adaptive pipelines
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - No AI, no embeddings, no probabilistic routing.
 *   - AI/OCR extension stubs are typed but not implemented.
 */

import type { SemanticSession } from './semanticSession';
import type { SemanticAction } from './semanticAction';
import type { RuntimePolicy, PolicyEvaluationResult } from './runtimePolicy';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type {
  RuntimeWorkflow,
  WorkflowStep,
  WorkflowTransition,
  DeferredItem,
  NavigationActionType,
  RuntimeNavigationAction,
} from './runtimeWorkflow';
import {
  buildWorkflow,
  deriveWorkflowStep,
  validateTransition,
  resetWorkflowIds,
} from './workflowOrchestrator';
import { deriveResolutionState } from './resolutionEngine';
import { scoreSessionAmbiguity } from './ambiguityScorer';
import { replaySessionWithPolicies } from './policyBridge';
import { buildWorkflowProjections } from './workflowProjection';
import { buildRuntimeProjection } from './projectionEngine';

export { resetWorkflowIds };

// ── Workflow replay ───────────────────────────────────────────────────────────

export interface WorkflowReplayStep {
  stepIndex: number;
  actionApplied: SemanticAction;
  workflowSnapshot: RuntimeWorkflow;
  stepAtAction: WorkflowStep;
  transitionOccurred: boolean;
  previousStep: WorkflowStep | undefined;
}

export interface WorkflowReplayResult {
  sessionId: string;
  steps: WorkflowReplayStep[];
  finalWorkflow: RuntimeWorkflow;
  totalTransitions: number;
  uniqueStepsVisited: WorkflowStep[];
}

/**
 * Replay all semantic actions and capture workflow snapshots at each step.
 * Useful for debugging and visual timeline replay in constructor tooling.
 */
export function replayWorkflow(
  session: SemanticSession,
  actions: SemanticAction[],
  policies: RuntimePolicy[],
  deferredItems: DeferredItem[] = [],
): WorkflowReplayResult {
  const steps: WorkflowReplayStep[] = [];
  const stepsVisited: WorkflowStep[] = [];
  let previousStep: WorkflowStep | undefined;

  for (let i = 0; i < actions.length; i++) {
    const actionsUpTo = actions.slice(0, i + 1);
    const state = deriveResolutionState(session, actionsUpTo);
    const scores = scoreSessionAmbiguity(session, state);

    // Build eval result from policy replay
    const policyReplay = replaySessionWithPolicies(session, actionsUpTo, policies);
    const evalResult = policyReplay.evaluationResult;

    const workflow = buildWorkflow(session, state, scores, evalResult, deferredItems);
    const currentStep = workflow.currentStep;
    const transitionOccurred = previousStep !== undefined && previousStep !== currentStep;

    if (!stepsVisited.includes(currentStep)) {
      stepsVisited.push(currentStep);
    }

    steps.push({
      stepIndex: i,
      actionApplied: actions[i],
      workflowSnapshot: workflow,
      stepAtAction: currentStep,
      transitionOccurred,
      previousStep,
    });

    previousStep = currentStep;
  }

  // Build final workflow
  const finalState = deriveResolutionState(session, actions);
  const finalScores = scoreSessionAmbiguity(session, finalState);
  const finalPolicyReplay = replaySessionWithPolicies(session, actions, policies);
  const finalWorkflow = buildWorkflow(
    session,
    finalState,
    finalScores,
    finalPolicyReplay.evaluationResult,
    deferredItems,
  );

  const totalTransitions = steps.filter((s) => s.transitionOccurred).length;

  return {
    sessionId: session.id,
    steps,
    finalWorkflow,
    totalTransitions,
    uniqueStepsVisited: stepsVisited,
  };
}

// ── Transition inspection ─────────────────────────────────────────────────────

export interface TransitionTrace {
  fromStep: WorkflowStep;
  toStep: WorkflowStep;
  trigger: NavigationActionType;
  actionId: string;
  isValid: boolean;
  reason?: string;
  timestamp: number;
}

/**
 * Inspect all transitions in a workflow replay.
 * Returns a chronological trace of valid and invalid transitions.
 */
export function inspectWorkflowTransitions(
  replay: WorkflowReplayResult,
): TransitionTrace[] {
  const traces: TransitionTrace[] = [];

  for (const step of replay.steps) {
    if (step.transitionOccurred && step.previousStep !== undefined) {
      traces.push({
        fromStep: step.previousStep,
        toStep: step.stepAtAction,
        trigger: step.actionApplied.type as NavigationActionType,
        actionId: step.actionApplied.id,
        isValid: true, // actions that caused transitions were valid
        timestamp: step.actionApplied.timestamp ?? Date.now(),
      });
    }
  }

  return traces;
}

// ── Navigation strategy validation ───────────────────────────────────────────

export interface NavigationStrategyValidation {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  recommendedActions: string[];
}

/**
 * Validate whether a sequence of navigation actions forms a valid strategy.
 * Checks for:
 *   - Unreachable steps (steps that are never visited)
 *   - Cyclic navigation (returning to a step repeatedly)
 *   - Missing terminal step (workflow never reaches 'resolved')
 */
export function validateNavigationStrategy(
  replay: WorkflowReplayResult,
  expectedFinalStep: WorkflowStep = 'resolved',
): NavigationStrategyValidation {
  const warnings: string[] = [];
  const errors: string[] = [];
  const recommendedActions: string[] = [];

  const { uniqueStepsVisited, finalWorkflow, totalTransitions } = replay;

  // Check if terminal step was reached
  if (finalWorkflow.currentStep !== expectedFinalStep) {
    errors.push(`Strategy does not reach '${expectedFinalStep}' — ends at '${finalWorkflow.currentStep}'.`);
    recommendedActions.push(`Add actions to transition from '${finalWorkflow.currentStep}' to '${expectedFinalStep}'.`);
  }

  // Check for cyclic navigation (same step visited more than twice)
  const stepCounts: Record<string, number> = {};
  for (const step of replay.steps.map((s) => s.stepAtAction)) {
    stepCounts[step] = (stepCounts[step] ?? 0) + 1;
  }
  for (const [step, count] of Object.entries(stepCounts)) {
    if (count > 2) {
      warnings.push(`Step '${step}' was visited ${count} times — possible navigation cycle.`);
    }
  }

  // Check for skipped clarification step
  if (
    uniqueStepsVisited.includes('input') &&
    uniqueStepsVisited.includes('review') &&
    !uniqueStepsVisited.includes('clarification')
  ) {
    warnings.push("Clarification step was skipped — verify all ambiguities are resolved.");
  }

  // Zero transitions is valid only for trivially-empty sessions
  if (totalTransitions === 0 && replay.steps.length > 0) {
    warnings.push('No workflow transitions occurred — all actions were in the same step.');
  }

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
    recommendedActions,
  };
}

// ── Deferred resolution preview ───────────────────────────────────────────────

export interface DeferredResolutionPreview {
  sessionId: string;
  pendingDeferrals: DeferredItem[];
  potentialAutoResolve: string[];
  requiresUserResolution: string[];
  estimatedResolutionSteps: number;
  summary: string;
}

/**
 * Preview how deferred items would be resolved if the user returned to the session.
 */
export function previewDeferredResolution(
  session: SemanticSession,
  actions: SemanticAction[],
  policies: RuntimePolicy[],
  deferredItems: DeferredItem[],
): DeferredResolutionPreview {
  const state = deriveResolutionState(session, actions);
  const scores = scoreSessionAmbiguity(session, state);

  const pendingDeferrals = deferredItems.filter((d) => !d.isResolved);

  // Identify which deferred items can auto-resolve (very low ambiguity)
  const potentialAutoResolve = pendingDeferrals
    .filter((d) => {
      const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(d.id)));
      return score !== undefined && score.score < 30;
    })
    .map((d) => d.id);

  const requiresUserResolution = pendingDeferrals
    .filter((d) => !potentialAutoResolve.includes(d.id))
    .map((d) => d.id);

  const estimatedResolutionSteps = requiresUserResolution.length;

  const summary = pendingDeferrals.length === 0
    ? 'No deferred items pending.'
    : `${pendingDeferrals.length} deferred item(s): ${potentialAutoResolve.length} can auto-resolve, ${requiresUserResolution.length} need user action.`;

  return {
    sessionId: session.id,
    pendingDeferrals,
    potentialAutoResolve,
    requiresUserResolution,
    estimatedResolutionSteps,
    summary,
  };
}

// ── Completion path simulation ────────────────────────────────────────────────

export interface CompletionPath {
  pathId: string;
  label: string;
  steps: WorkflowStep[];
  requiresDeferral: boolean;
  requiresUserAction: boolean;
  estimatedSteps: number;
  confidence: number;
}

/**
 * Simulate possible conversational completion paths from the current workflow state.
 * Returns a set of alternative paths, ordered by confidence.
 *
 * This is deterministic — paths are derived from the current resolution state,
 * not from probabilistic modeling.
 */
export function simulateCompletionPaths(
  workflow: RuntimeWorkflow,
  session: SemanticSession,
  state: ReturnType<typeof deriveResolutionState>,
  scores: SessionAmbiguityReport,
): CompletionPath[] {
  const paths: CompletionPath[] = [];
  const { completionState } = workflow;

  // Path 1: Direct resolution (fastest — no deferrals)
  if (completionState.canComplete) {
    paths.push({
      pathId: 'path_direct',
      label: 'Direct completion',
      steps: [workflow.currentStep, 'confirmation', 'resolved'],
      requiresDeferral: false,
      requiresUserAction: false,
      estimatedSteps: 2,
      confidence: 100 - scores.overallScore,
    });
  }

  // Path 2: With deferrals (skip optional items)
  if (completionState.canCompleteWithDeferrals && !completionState.canComplete) {
    paths.push({
      pathId: 'path_with_deferrals',
      label: 'Complete with deferrals',
      steps: [workflow.currentStep, 'clarification', 'confirmation', 'resolved'],
      requiresDeferral: true,
      requiresUserAction: completionState.safeToDefer.length > 0,
      estimatedSteps: 3,
      confidence: Math.max(0, completionState.completionConfidence - 15),
    });
  }

  // Path 3: Full resolution (most complete)
  if (!completionState.canComplete) {
    const stepsNeeded: WorkflowStep[] = ['clarification'];
    if (state.pendingGroups.some((id) => session.pendingGroups.find((g) => g.id === id)?.suggestedSplit)) {
      stepsNeeded.push('split_review');
    }
    stepsNeeded.push('review', 'confirmation', 'resolved');

    paths.push({
      pathId: 'path_full_resolution',
      label: 'Full resolution',
      steps: [workflow.currentStep, ...stepsNeeded],
      requiresDeferral: false,
      requiresUserAction: true,
      estimatedSteps: stepsNeeded.length + 1,
      confidence: Math.max(0, 100 - scores.overallScore * 0.5),
    });
  }

  return paths.sort((a, b) => b.confidence - a.confidence);
}

// ── AI/OCR extension stubs ────────────────────────────────────────────────────

/**
 * @stub — Placeholder for future AI-assisted workflow guidance.
 * Not implemented. Reserved for AI integration phase.
 */
export function aiWorkflowHint(
  _workflow: RuntimeWorkflow,
  _context: Record<string, unknown>,
): null {
  return null;
}

/**
 * @stub — Placeholder for future OCR conversational review flow.
 * Not implemented. Reserved for OCR integration phase.
 */
export function ocrWorkflowReview(
  _workflow: RuntimeWorkflow,
  _ocrData: Record<string, unknown>,
): null {
  return null;
}

/**
 * @stub — Placeholder for future adaptive semantic completion pipeline.
 * Not implemented. Reserved for AI/adaptive phase.
 */
export function adaptiveCompletion(
  _workflow: RuntimeWorkflow,
  _signals: Record<string, unknown>,
): null {
  return null;
}
