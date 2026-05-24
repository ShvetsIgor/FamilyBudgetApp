/**
 * LAYER: runtime policy — policy model + conversational strategy types.
 *
 * RuntimePolicy: a named rule that governs how the resolution engine behaves
 * in a specific situation (clarification, auto-resolution, retry, etc.).
 *
 * ConversationalStrategy: a composite of decision rules, escalation rules,
 * and a clarification behavior mode — specifies HOW to handle ambiguity.
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - Policies are immutable records; mutating returns a new policy.
 *   - All behavior is deterministic: same input → same policy decision.
 */

// ── Policy model ──────────────────────────────────────────────────────────────

export type PolicyType =
  | 'clarification_policy'    // governs which hints to ask about
  | 'auto_resolution_policy'  // governs which hints to resolve automatically
  | 'merchant_policy'         // governs unknown/ambiguous merchant handling
  | 'split_policy'            // governs when to suggest/require split
  | 'ambiguity_policy'        // governs deferral and suppression thresholds
  | 'retry_policy';           // governs when to re-run the parser

export interface RuntimePolicy {
  id: string;
  type: PolicyType;
  enabled: boolean;
  /** Lower number = higher priority (evaluated first). */
  priority: number;
  configuration: Record<string, unknown>;
}

// ── Clarification behavior ────────────────────────────────────────────────────

/**
 * How the runtime presents clarification questions to the user.
 *   ask_immediately   — show question as soon as a hint is detected
 *   defer_low_priority — skip hints below a priority threshold for now
 *   batch_by_kind     — group same-kind hints and ask once
 *   minimal           — ask only the single highest-priority question
 *   suppress          — do not ask; auto-resolve or ignore
 */
export type ClarificationBehavior =
  | 'ask_immediately'
  | 'defer_low_priority'
  | 'batch_by_kind'
  | 'minimal'
  | 'suppress';

// ── Strategy components ───────────────────────────────────────────────────────

export interface StrategyRule {
  id: string;
  /** Human-readable description of when this rule fires. */
  condition: string;
  /** What the runtime should do when this rule fires. */
  action: 'ask' | 'auto_resolve' | 'defer' | 'suppress' | 'escalate' | 'retry';
  /** Lower = evaluated first. */
  priority: number;
}

export type EscalationTarget = 'user' | 'constructor' | 'retry_parse';

export interface EscalationRule {
  id: string;
  /** When to trigger escalation (human-readable condition). */
  trigger: string;
  /** Optional numeric threshold (e.g. max unresolved hints before escalating). */
  threshold?: number;
  escalateTo: EscalationTarget;
}

// ── Conversational strategy ───────────────────────────────────────────────────

/**
 * A ConversationalStrategy bundles decision rules, escalation rules, and
 * a clarification behavior mode into a named strategy.
 *
 * appliesTo: policy type IDs or hint kinds this strategy governs.
 */
export interface ConversationalStrategy {
  id: string;
  name: string;
  /** Policy types or hint kinds this strategy applies to. */
  appliesTo: string[];
  decisionRules: StrategyRule[];
  escalationRules: EscalationRule[];
  clarificationBehavior: ClarificationBehavior;
}

// ── Policy decision ───────────────────────────────────────────────────────────

/**
 * A single runtime decision for one hint or group.
 * Produced by the policy engine after evaluating applicable policies.
 */
export type PolicyDecisionAction =
  | 'ask'
  | 'auto_resolve'
  | 'defer'
  | 'escalate'
  | 'suppress'
  | 'retry';

export interface PolicyDecision {
  /** Hint fragmentId or group ID this decision targets. */
  targetId: string;
  action: PolicyDecisionAction;
  reason: string;
  /** ID of the policy that drove this decision, or undefined if default fallback. */
  appliedPolicyId: string | undefined;
}

export interface PolicyEvaluationResult {
  decisions: PolicyDecision[];
  /** IDs of policies that contributed at least one decision. */
  appliedPolicies: string[];
  /** IDs of policies that were enabled but had no matching targets. */
  skippedPolicies: string[];
  /** Human-readable summary of the overall strategy in effect. */
  overallStrategy: string;
}
