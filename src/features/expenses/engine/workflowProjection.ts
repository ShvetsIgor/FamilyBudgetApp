/**
 * LAYER: workflow projection — workflow-aware UX view models.
 *
 * Transforms RuntimeWorkflow + RuntimeProjection into composite UX snapshots
 * that the UI can render without consuming raw engine state.
 *
 * View models produced:
 *   WorkflowProgressProjection      — step progress indicator
 *   ConversationalNavigationProjection — navigation action grid for current step
 *   CompletionStateProjection       — completion readiness summary
 *   DeferredResolutionProjection    — deferred items status
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Consumes RuntimeWorkflow + RuntimeProjection.
 *   - All labels are display-ready (no raw IDs in primary label fields).
 */

import type { RuntimeWorkflow, WorkflowStep, DeferredItem } from './runtimeWorkflow';
import type { RuntimeProjection } from './runtimeProjection';
import { buildCompletionSummary } from './workflowCompletion';

// ── WorkflowProgressProjection ────────────────────────────────────────────────

export interface WorkflowStepMeta {
  step: WorkflowStep;
  label: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isBlocked: boolean;
  isDeferred: boolean;
}

export interface WorkflowProgressProjection {
  steps: WorkflowStepMeta[];
  currentStep: WorkflowStep;
  completedCount: number;
  totalVisibleSteps: number;
  progressPercent: number;
}

const STEP_LABELS: Record<WorkflowStep, string> = {
  input:        'Input',
  clarification:'Clarification',
  split_review: 'Split Review',
  review:       'Review',
  confirmation: 'Confirmation',
  resolved:     'Done',
};

const VISIBLE_STEPS: WorkflowStep[] = ['input', 'clarification', 'review', 'confirmation', 'resolved'];

export function buildWorkflowProgressProjection(
  workflow: RuntimeWorkflow,
): WorkflowProgressProjection {
  const steps: WorkflowStepMeta[] = VISIBLE_STEPS.map((step) => ({
    step,
    label: STEP_LABELS[step],
    isCompleted: workflow.completedSteps.includes(step),
    isCurrent: workflow.currentStep === step,
    isBlocked: workflow.blockedSteps.includes(step),
    isDeferred: workflow.deferredSteps.includes(step),
  }));

  // Also include split_review if it's the current step
  if (
    workflow.currentStep === 'split_review' &&
    !steps.some((s) => s.step === 'split_review')
  ) {
    const idx = steps.findIndex((s) => s.step === 'review');
    steps.splice(idx, 0, {
      step: 'split_review',
      label: STEP_LABELS['split_review'],
      isCompleted: false,
      isCurrent: true,
      isBlocked: false,
      isDeferred: false,
    });
  }

  const completedCount = steps.filter((s) => s.isCompleted).length;
  const total = steps.length;
  const progressPercent = total === 0 ? 100 : Math.round((completedCount / total) * 100);

  return {
    steps,
    currentStep: workflow.currentStep,
    completedCount,
    totalVisibleSteps: total,
    progressPercent,
  };
}

// ── ConversationalNavigationProjection ───────────────────────────────────────

export interface NavigationActionVM {
  id: string;
  type: string;
  label: string;
  description: string;
  isPrimary: boolean;
  isDisabled: boolean;
  disabledReason?: string;
  targetId?: string;
}

export interface ConversationalNavigationProjection {
  currentStep: WorkflowStep;
  stepLabel: string;
  availableActions: NavigationActionVM[];
  primaryAction?: NavigationActionVM;
  deferredCount: number;
  canAdvance: boolean;
  canCancel: boolean;
  canGoBack: boolean;
}

export function buildConversationalNavigationProjection(
  workflow: RuntimeWorkflow,
): ConversationalNavigationProjection {
  const { availableActions, recommendedAction } = workflow.navigationState;

  const actionVMs: NavigationActionVM[] = availableActions.map((a) => ({
    id: a.id,
    type: a.type,
    label: a.label,
    description: a.description,
    isPrimary: a.isPrimary,
    isDisabled: a.isDisabled,
    disabledReason: a.disabledReason,
    targetId: a.targetId,
  }));

  const primaryVM = recommendedAction
    ? actionVMs.find((vm) => vm.id === recommendedAction.id)
    : undefined;

  const canAdvance = availableActions.some((a) => a.type === 'advance' && !a.isDisabled);
  const canCancel = availableActions.some((a) => a.type === 'cancel');
  const canGoBack = availableActions.some((a) => a.type === 'back');

  return {
    currentStep: workflow.currentStep,
    stepLabel: STEP_LABELS[workflow.currentStep],
    availableActions: actionVMs,
    primaryAction: primaryVM,
    deferredCount: workflow.deferredItems.filter((d) => !d.isResolved).length,
    canAdvance,
    canCancel,
    canGoBack,
  };
}

// ── CompletionStateProjection ─────────────────────────────────────────────────

export interface CompletionBlockerVM {
  kind: string;
  targetId: string;
  description: string;
  isSafeToDefer: boolean;
}

export interface CompletionStateProjection {
  canSave: boolean;
  canSaveWithDeferrals: boolean;
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low' | 'none';
  summary: string;
  blockers: CompletionBlockerVM[];
  safeToDefer: string[];
  requiresConfirmation: string[];
}

function confidenceToLabel(confidence: number): 'high' | 'medium' | 'low' | 'none' {
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  if (confidence >= 20) return 'low';
  return 'none';
}

export function buildCompletionStateProjection(
  workflow: RuntimeWorkflow,
): CompletionStateProjection {
  const { completionState } = workflow;
  const blockerVMs: CompletionBlockerVM[] = completionState.blockers.map((b) => ({
    kind: b.kind,
    targetId: b.targetId,
    description: b.description,
    isSafeToDefer: b.isSafeToDefer,
  }));

  return {
    canSave: completionState.canComplete,
    canSaveWithDeferrals: completionState.canCompleteWithDeferrals,
    confidence: completionState.completionConfidence,
    confidenceLabel: confidenceToLabel(completionState.completionConfidence),
    summary: buildCompletionSummary(completionState),
    blockers: blockerVMs,
    safeToDefer: completionState.safeToDefer,
    requiresConfirmation: completionState.requiresHardConfirmation,
  };
}

// ── DeferredResolutionProjection ──────────────────────────────────────────────

export interface DeferredItemVM {
  id: string;
  kind: string;
  deferredAt: number;
  reason: string;
  isResolved: boolean;
  label: string;
}

export interface DeferredResolutionProjection {
  pendingDeferrals: DeferredItemVM[];
  resolvedDeferrals: DeferredItemVM[];
  totalDeferred: number;
  pendingCount: number;
  resolvedCount: number;
  hasPendingDeferrals: boolean;
}

function deferredReasonLabel(reason: DeferredItem['reason']): string {
  switch (reason) {
    case 'user_skipped': return 'Skipped by user';
    case 'auto_deferred': return 'Auto-deferred';
    case 'low_priority': return 'Low priority';
  }
}

export function buildDeferredResolutionProjection(
  workflow: RuntimeWorkflow,
): DeferredResolutionProjection {
  const all: DeferredItemVM[] = workflow.deferredItems.map((d) => ({
    id: d.id,
    kind: d.kind,
    deferredAt: d.deferredAt,
    reason: deferredReasonLabel(d.reason),
    isResolved: d.isResolved,
    label: `${d.kind} ${d.id}`,
  }));

  const pending = all.filter((d) => !d.isResolved);
  const resolved = all.filter((d) => d.isResolved);

  return {
    pendingDeferrals: pending,
    resolvedDeferrals: resolved,
    totalDeferred: all.length,
    pendingCount: pending.length,
    resolvedCount: resolved.length,
    hasPendingDeferrals: pending.length > 0,
  };
}

// ── Composite workflow projection ─────────────────────────────────────────────

export interface WorkflowProjectionBundle {
  progress: WorkflowProgressProjection;
  navigation: ConversationalNavigationProjection;
  completion: CompletionStateProjection;
  deferred: DeferredResolutionProjection;
  /** The base UX projection (from projectionEngine) for non-workflow UI. */
  runtimeProjection: RuntimeProjection;
}

/**
 * Build all four workflow projections in one call.
 * This is the primary entry point for UI components that need the full workflow context.
 */
export function buildWorkflowProjections(
  workflow: RuntimeWorkflow,
  runtimeProjection: RuntimeProjection,
): WorkflowProjectionBundle {
  return {
    progress: buildWorkflowProgressProjection(workflow),
    navigation: buildConversationalNavigationProjection(workflow),
    completion: buildCompletionStateProjection(workflow),
    deferred: buildDeferredResolutionProjection(workflow),
    runtimeProjection,
  };
}
