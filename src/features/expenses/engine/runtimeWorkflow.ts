/**
 * LAYER: runtime workflow — model types for workflow-driven conversational navigation.
 *
 * The workflow layer sits above the resolution engine and projection layer.
 * It orchestrates session progress from input → clarification → review → resolved,
 * tracking which steps are complete, blocked, or deferred.
 *
 * Hierarchy:
 *   SemanticSession
 *     └─ ResolutionState
 *          └─ RuntimeWorkflow  ← this layer
 *               └─ RuntimeProjection (UX snapshot)
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - All structures are serializable.
 *   - Workflow is always derivable from session + state (deterministic).
 */

// ── Workflow step ─────────────────────────────────────────────────────────────

export type WorkflowStep =
  | 'input'          // awaiting user text input
  | 'clarification'  // unresolved hints need answers
  | 'review'         // data ready, user confirms before submission
  | 'split_review'   // purchase group suggests split; review items
  | 'confirmation'   // final confirmation before saving
  | 'resolved';      // session complete

// ── Navigation action ─────────────────────────────────────────────────────────

export type NavigationActionType =
  | 'advance'              // move forward to the next step
  | 'defer_ambiguity'      // skip a hint temporarily; resolve later
  | 'resolve_later'        // mark hint as deferred (user explicitly chose to continue)
  | 'force_split_review'   // jump directly to split review
  | 'confirm_partial'      // confirm even though some items are not fully resolved
  | 'escalate_conflict'    // escalate a conflicting-signal hint
  | 'retry_resolution'     // re-run resolution (after correction or category change)
  | 'back'                 // go to previous step
  | 'cancel';              // cancel the session

export interface RuntimeNavigationAction {
  id: string;
  type: NavigationActionType;
  label: string;
  description: string;
  /** The step this action transitions FROM. */
  fromStep: WorkflowStep;
  /** The step this action transitions TO (undefined for back/cancel). */
  toStep?: WorkflowStep;
  /** Fragment or group ID this action targets. */
  targetId?: string;
  /** True when this action is the recommended next step. */
  isPrimary: boolean;
  /** True when the action is disabled (precondition not met). */
  isDisabled: boolean;
  /** Human-readable reason the action is disabled. */
  disabledReason?: string;
}

// ── Workflow navigation state ─────────────────────────────────────────────────

export interface WorkflowNavigationState {
  /** All actions available at the current step. */
  availableActions: RuntimeNavigationAction[];
  /** The single recommended action (highest-priority available). */
  recommendedAction?: RuntimeNavigationAction;
  /** Actions that cannot be taken now (disabled, precondition unmet). */
  blockedActions: RuntimeNavigationAction[];
  /** Actions that were explicitly deferred by the user. */
  deferredActions: RuntimeNavigationAction[];
}

// ── Workflow completion state ─────────────────────────────────────────────────

export type CompletionBlockerKind =
  | 'unresolved_hint'        // clarification hint still pending
  | 'blocked_resolution'     // resolution is blocked (rejected category)
  | 'incomplete_split'       // split items missing categories
  | 'cancelled_session'      // session was cancelled
  | 'missing_amount'         // no amount parsed yet
  | 'missing_category';      // no category suggestion available

export interface CompletionBlocker {
  kind: CompletionBlockerKind;
  targetId: string;
  description: string;
  isSafeToDefer: boolean;
}

export interface WorkflowCompletionState {
  /** True when the workflow can be submitted as-is. */
  canComplete: boolean;
  /** True when the workflow can be submitted with deferrals applied. */
  canCompleteWithDeferrals: boolean;
  /** 0–100: how confident the engine is in the current resolution. */
  completionConfidence: number;
  /** Items blocking completion. */
  blockers: CompletionBlocker[];
  /** Hint/group IDs that are safe to defer (low ambiguity, optional). */
  safeToDefer: string[];
  /** Hint/group IDs that require hard confirmation from the user. */
  requiresHardConfirmation: string[];
  /** Hint/group IDs that can auto-resolve if deferred. */
  canAutoResolve: string[];
}

// ── Deferred item ─────────────────────────────────────────────────────────────

export interface DeferredItem {
  id: string;
  kind: 'hint' | 'group';
  deferredAt: number;
  reason: 'user_skipped' | 'auto_deferred' | 'low_priority';
  resolvedAt?: number;
  isResolved: boolean;
}

// ── Runtime workflow ──────────────────────────────────────────────────────────

/**
 * The runtime workflow is a workflow-aware layer on top of the resolution engine.
 * It orchestrates step transitions, navigation actions, and completion state.
 *
 * Built by workflowOrchestrator.buildWorkflow().
 * Consumed by workflowProjection builders and UI navigation components.
 */
export interface RuntimeWorkflow {
  id: string;
  sessionId: string;

  /** The step the user is currently on. */
  currentStep: WorkflowStep;

  /** Steps that have been completed (may revisit). */
  completedSteps: WorkflowStep[];

  /** Steps blocked due to hard failures (session cancelled, etc.). */
  blockedSteps: WorkflowStep[];

  /** Steps explicitly deferred by the user. */
  deferredSteps: WorkflowStep[];

  /** Navigation state at the current step. */
  navigationState: WorkflowNavigationState;

  /** Completion state analysis. */
  completionState: WorkflowCompletionState;

  /** Deferred items (hints/groups the user chose to skip). */
  deferredItems: DeferredItem[];

  /** Timestamp of last transition. */
  updatedAt: number;
}

// ── Workflow transition ───────────────────────────────────────────────────────

export interface WorkflowTransition {
  workflowId: string;
  fromStep: WorkflowStep;
  toStep: WorkflowStep;
  triggeredBy: NavigationActionType;
  targetId?: string;
  timestamp: number;
  isValid: boolean;
  reason?: string;
}
