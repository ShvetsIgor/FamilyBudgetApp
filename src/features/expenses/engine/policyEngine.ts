/**
 * LAYER: policy engine — evaluates RuntimePolicies and produces PolicyDecisions.
 *
 * evaluatePolicies(policies, state, session, scores)
 *   → processes enabled policies in priority order
 *   → emits one PolicyDecision per unresolved hint and pending group
 *   → returns PolicyEvaluationResult with decisions + applied policy summary
 *
 * DEFAULT_POLICIES is the out-of-the-box policy set.
 * applyDefaultPolicies() is a convenience wrapper.
 *
 * Decision logic (in order):
 *   retry_policy         → triggers retry when merchant was corrected
 *   clarification_policy → 'ask' for high-severity hints (score >= minScore)
 *   auto_resolution_policy → 'auto_resolve' for multiple_categories with ≤1 candidate
 *   merchant_policy      → 'escalate' for unknown_merchant hints
 *   split_policy         → 'ask' for groups with suggestedSplit
 *   ambiguity_policy     → 'defer' (score < deferBelow) or 'suppress' (score < suppressBelow)
 *   fallback             → 'ask' for anything that didn't match
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Policies evaluated in ascending priority order (lower number = first).
 *   - Each hint/group gets exactly one decision (first matching policy wins).
 *   - Disabled policies are skipped entirely.
 */

import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';
import type {
  RuntimePolicy,
  PolicyDecision,
  PolicyDecisionAction,
  PolicyEvaluationResult,
} from './runtimePolicy';
import type { SessionAmbiguityReport, AmbiguityScore } from './ambiguityScorer';
import { scoreHintAmbiguity } from './ambiguityScorer';

// ── Default policies ──────────────────────────────────────────────────────────

export const DEFAULT_POLICIES: RuntimePolicy[] = [
  {
    id: 'policy_retry',
    type: 'retry_policy',
    enabled: true,
    priority: 5,
    configuration: {
      triggerOnMerchantCorrection: true,
    },
  },
  {
    id: 'policy_clarification',
    type: 'clarification_policy',
    enabled: true,
    priority: 10,
    configuration: {
      askImmediately: ['conflicting_signals', 'unknown_merchant'],
      minScore: 60,
    },
  },
  {
    id: 'policy_merchant',
    type: 'merchant_policy',
    enabled: true,
    priority: 15,
    configuration: {
      escalateUnknown: true,
      suppressKnown: true,
    },
  },
  {
    id: 'policy_auto_resolution',
    type: 'auto_resolution_policy',
    enabled: true,
    priority: 20,
    configuration: {
      autoResolveMultipleCategories: true,
      maxCandidatesForAutoResolve: 1,
    },
  },
  {
    id: 'policy_split',
    type: 'split_policy',
    enabled: true,
    priority: 25,
    configuration: {
      askAboveSplitScore: 20,
    },
  },
  {
    id: 'policy_ambiguity',
    type: 'ambiguity_policy',
    enabled: true,
    priority: 30,
    configuration: {
      deferBelowScore: 30,
      suppressBelowScore: 10,
    },
  },
];

// ── Policy evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluate all enabled policies against the current session state.
 * Returns one PolicyDecision per unresolved hint and pending group.
 */
export function evaluatePolicies(
  policies: RuntimePolicy[],
  state: ResolutionState,
  session: SemanticSession,
  scores: SessionAmbiguityReport,
): PolicyEvaluationResult {
  const enabled = [...policies]
    .filter((p) => p.enabled)
    .sort((a, b) => a.priority - b.priority);

  const ctx = session.parserContexts[session.parserContexts.length - 1];
  const decisions: PolicyDecision[] = [];
  const appliedPolicyIds = new Set<string>();
  const skippedPolicyIds = new Set<string>(enabled.map((p) => p.id));

  // ── Evaluate hints ────────────────────────────────────────────────────────

  for (const hintId of state.unresolvedHints) {
    const hint = ctx?.clarificationHints.find((h) => h.fragmentId === hintId);
    const score = hint ? scoreHintAmbiguity(hint) : undefined;

    const decision = decideForHint(hintId, hint?.kind, score, enabled);
    decisions.push(decision);

    if (decision.appliedPolicyId) {
      appliedPolicyIds.add(decision.appliedPolicyId);
      skippedPolicyIds.delete(decision.appliedPolicyId);
    }
  }

  // ── Evaluate pending groups ───────────────────────────────────────────────

  for (const groupId of state.pendingGroups) {
    const group = session.pendingGroups.find((g) => g.id === groupId);
    const groupScore = scores.scores.find(
      (s) => s.kind === 'unresolved_split' && s.evidence.some((e) => e.includes(groupId)),
    );

    const decision = decideForGroup(groupId, group?.suggestedSplit ?? false, groupScore, enabled);
    decisions.push(decision);

    if (decision.appliedPolicyId) {
      appliedPolicyIds.add(decision.appliedPolicyId);
      skippedPolicyIds.delete(decision.appliedPolicyId);
    }
  }

  const overallStrategy = deriveOverallStrategy(decisions, enabled);

  return {
    decisions,
    appliedPolicies: [...appliedPolicyIds],
    skippedPolicies: [...skippedPolicyIds],
    overallStrategy,
  };
}

/**
 * Convenience: evaluate using the default policy set.
 */
export function applyDefaultPolicies(
  state: ResolutionState,
  session: SemanticSession,
  scores: SessionAmbiguityReport,
): PolicyEvaluationResult {
  return evaluatePolicies(DEFAULT_POLICIES, state, session, scores);
}

// ── Decision helpers ──────────────────────────────────────────────────────────

function decideForHint(
  hintId: string,
  hintKind: string | undefined,
  score: AmbiguityScore | undefined,
  policies: RuntimePolicy[],
): PolicyDecision {
  // 1. clarification_policy: high-severity hints get 'ask'
  const clarPolicy = policies.find((p) => p.type === 'clarification_policy');
  if (clarPolicy) {
    const askImmediately = (clarPolicy.configuration.askImmediately as string[] | undefined) ?? [];
    const minScore = (clarPolicy.configuration.minScore as number | undefined) ?? 60;
    if (hintKind && askImmediately.includes(hintKind)) {
      return decision('ask', hintId, `Hint kind "${hintKind}" is in askImmediately list.`, clarPolicy.id);
    }
    if (score && score.score >= minScore) {
      return decision('ask', hintId, `Score ${score.score} ≥ minScore ${minScore}.`, clarPolicy.id);
    }
  }

  // 2. auto_resolution_policy
  const autoPolicy = policies.find((p) => p.type === 'auto_resolution_policy');
  if (autoPolicy && hintKind === 'multiple_categories') {
    const max = (autoPolicy.configuration.maxCandidatesForAutoResolve as number | undefined) ?? 1;
    if (score?.isAutoResolvable) {
      return decision('auto_resolve', hintId, `multiple_categories with ≤${max} candidate(s) — auto-resolved.`, autoPolicy.id);
    }
  }

  // 3. merchant_policy: escalate unknown merchant
  const merchantPolicy = policies.find((p) => p.type === 'merchant_policy');
  if (merchantPolicy && hintKind === 'unknown_merchant') {
    const escalate = merchantPolicy.configuration.escalateUnknown as boolean | undefined;
    if (escalate !== false) {
      return decision('escalate', hintId, 'Unknown merchant — escalated to user.', merchantPolicy.id);
    }
  }

  // 4. ambiguity_policy: defer or suppress low-value hints
  const ambigPolicy = policies.find((p) => p.type === 'ambiguity_policy');
  if (ambigPolicy && score) {
    const suppressBelow = (ambigPolicy.configuration.suppressBelowScore as number | undefined) ?? 10;
    const deferBelow = (ambigPolicy.configuration.deferBelowScore as number | undefined) ?? 30;
    if (score.score < suppressBelow) {
      return decision('suppress', hintId, `Score ${score.score} < suppressBelow ${suppressBelow}.`, ambigPolicy.id);
    }
    if (score.score < deferBelow) {
      return decision('defer', hintId, `Score ${score.score} < deferBelow ${deferBelow}.`, ambigPolicy.id);
    }
  }

  // 5. Fallback
  return decision('ask', hintId, 'No specific policy matched — default ask.', undefined);
}

function decideForGroup(
  groupId: string,
  suggestedSplit: boolean,
  score: AmbiguityScore | undefined,
  policies: RuntimePolicy[],
): PolicyDecision {
  const splitPolicy = policies.find((p) => p.type === 'split_policy');
  if (splitPolicy && suggestedSplit) {
    const threshold = (splitPolicy.configuration.askAboveSplitScore as number | undefined) ?? 20;
    const s = score?.score ?? BASE_SPLIT_SCORE;
    if (s >= threshold) {
      return decision('ask', groupId, `Group ${groupId} has suggestedSplit=true (score ${s} ≥ ${threshold}).`, splitPolicy.id);
    }
  }

  const ambigPolicy = policies.find((p) => p.type === 'ambiguity_policy');
  if (ambigPolicy) {
    const deferBelow = (ambigPolicy.configuration.deferBelowScore as number | undefined) ?? 30;
    const s = score?.score ?? BASE_SPLIT_SCORE;
    if (s < deferBelow && !suggestedSplit) {
      return decision('defer', groupId, `Group ${groupId} has low ambiguity score — deferred.`, ambigPolicy.id);
    }
  }

  return decision('ask', groupId, `Group ${groupId} — default ask.`, undefined);
}

// ── Overall strategy summary ──────────────────────────────────────────────────

function deriveOverallStrategy(decisions: PolicyDecision[], _policies: RuntimePolicy[]): string {
  if (decisions.length === 0) return 'No pending ambiguity — session ready.';

  const counts: Record<PolicyDecisionAction, number> = {
    ask: 0, auto_resolve: 0, defer: 0, escalate: 0, suppress: 0, retry: 0,
  };
  for (const d of decisions) counts[d.action]++;

  const parts: string[] = [];
  if (counts.ask > 0)          parts.push(`ask(${counts.ask})`);
  if (counts.auto_resolve > 0) parts.push(`auto_resolve(${counts.auto_resolve})`);
  if (counts.defer > 0)        parts.push(`defer(${counts.defer})`);
  if (counts.escalate > 0)     parts.push(`escalate(${counts.escalate})`);
  if (counts.suppress > 0)     parts.push(`suppress(${counts.suppress})`);

  return `Decisions: ${parts.join(', ')}.`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

const BASE_SPLIT_SCORE = 25;

function decision(
  action: PolicyDecisionAction,
  targetId: string,
  reason: string,
  policyId: string | undefined,
): PolicyDecision {
  return { action, targetId, reason, appliedPolicyId: policyId };
}

/**
 * Filter decisions by action type.
 */
export function filterDecisionsByAction(
  result: PolicyEvaluationResult,
  action: PolicyDecisionAction,
): PolicyDecision[] {
  return result.decisions.filter((d) => d.action === action);
}

/**
 * True when at least one 'ask' decision exists (user must respond).
 */
export function requiresUserInput(result: PolicyEvaluationResult): boolean {
  return result.decisions.some((d) => d.action === 'ask' || d.action === 'escalate');
}

/**
 * Count decisions by action type.
 */
export function countDecisionsByAction(
  result: PolicyEvaluationResult,
  action: PolicyDecisionAction,
): number {
  return result.decisions.filter((d) => d.action === action).length;
}
