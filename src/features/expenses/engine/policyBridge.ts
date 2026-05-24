/**
 * LAYER: policy bridge — constructor/runtime policy integration.
 *
 * Bridges between constructor tooling and the runtime policy engine:
 *   editPolicy            → immutable policy update
 *   previewPolicyImpact   → evaluate a single policy change on a session
 *   replaySessionWithPolicies → re-evaluate resolution with different policies
 *   compareStrategies     → diff two strategy evaluation results
 *   inspectEscalationPath → show which escalation rules would fire
 *
 * All functions are pure — no side effects, no session mutations.
 * The "replay" does not re-run the parser; it re-evaluates policy decisions
 * against the existing session data.
 *
 * Future AI/OCR compatibility:
 *   externalSuggestions?: Record<string, unknown> parameter is reserved on each
 *   function for future AI-provided hints or OCR corrections. Currently unused.
 *
 * Architecture invariants:
 *   - No imports from UI or hooks.
 *   - Returns new objects; never mutates inputs.
 *   - Deterministic: same inputs → same outputs.
 */

import type { SemanticSession } from './semanticSession';
import type { SemanticAction, ResolutionState } from './semanticAction';
import type { RuntimePolicy, ConversationalStrategy, PolicyEvaluationResult, EscalationRule } from './runtimePolicy';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { SemanticEventTimeline } from './semanticEventTimeline';
import { evaluatePolicies, filterDecisionsByAction } from './policyEngine';
import { buildTimelineFromSession } from './semanticEventTimeline';
import { buildConversationalStrategy, matchingEscalations } from './conversationalStrategy';
import { scoreSessionAmbiguity } from './ambiguityScorer';
import { buildInitialResolutionState, deriveResolutionState } from './resolutionEngine';

// ── Policy editing ────────────────────────────────────────────────────────────

/**
 * Immutably update fields of a RuntimePolicy.
 * Returns a new policy; the original is unchanged.
 */
export function editPolicy(
  policy: RuntimePolicy,
  changes: Partial<Omit<RuntimePolicy, 'id' | 'type'>>,
): RuntimePolicy {
  return { ...policy, ...changes };
}

/**
 * Toggle a policy's enabled state.
 */
export function togglePolicy(policy: RuntimePolicy, enabled: boolean): RuntimePolicy {
  return { ...policy, enabled };
}

/**
 * Update a specific configuration key in a policy.
 */
export function updatePolicyConfig(
  policy: RuntimePolicy,
  key: string,
  value: unknown,
): RuntimePolicy {
  return { ...policy, configuration: { ...policy.configuration, [key]: value } };
}

// ── Policy impact preview ─────────────────────────────────────────────────────

/**
 * Preview the impact of changing one policy on a session's evaluation.
 * Returns the evaluation result for the modified policy set.
 */
export function previewPolicyImpact(
  policyToChange: RuntimePolicy,
  allPolicies: RuntimePolicy[],
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
): PolicyEvaluationResult {
  const updatedPolicies = allPolicies.map((p) =>
    p.id === policyToChange.id ? policyToChange : p,
  );
  return evaluatePolicies(updatedPolicies, state, session, scores);
}

// ── Session replay with policies ──────────────────────────────────────────────

export interface PolicyReplayResult {
  timeline: SemanticEventTimeline;
  resolutionState: ResolutionState;
  evaluationResult: PolicyEvaluationResult;
  scores: SessionAmbiguityReport;
}

/**
 * Re-evaluate a session's resolution with a different policy set.
 * Does NOT re-run the parser — uses the session's existing parserContexts.
 *
 * This lets the constructor ask "what decisions would policy X have made?"
 * without touching production state.
 */
export function replaySessionWithPolicies(
  session: SemanticSession,
  actions: SemanticAction[],
  policies: RuntimePolicy[],
): PolicyReplayResult {
  const state = deriveResolutionState(session, actions);
  const scores = scoreSessionAmbiguity(session, state);
  const evalResult = evaluatePolicies(policies, state, session, scores);
  const timeline = buildTimelineFromSession(session, actions);

  return {
    timeline,
    resolutionState: state,
    evaluationResult: evalResult,
    scores,
  };
}

// ── Strategy comparison ───────────────────────────────────────────────────────

export interface StrategyComparison {
  strategy1: string;
  strategy2: string;
  /** IDs where both strategies made the same decision. */
  agreed: string[];
  /** IDs where the strategies disagreed. */
  disagreed: Array<{
    targetId: string;
    action1: string;
    action2: string;
  }>;
  /** Total items evaluated. */
  totalItems: number;
  /** Fraction that agreed (0–1). */
  agreementRate: number;
}

/**
 * Compare the decisions of two policy sets on the same session.
 * Returns a diff of where they agree or disagree.
 */
export function compareStrategies(
  policies1: RuntimePolicy[],
  policies2: RuntimePolicy[],
  session: SemanticSession,
  state: ResolutionState,
  scores: SessionAmbiguityReport,
): StrategyComparison {
  const r1 = evaluatePolicies(policies1, state, session, scores);
  const r2 = evaluatePolicies(policies2, state, session, scores);

  const name1 = buildConversationalStrategy(policies1, scores).name;
  const name2 = buildConversationalStrategy(policies2, scores).name;

  const agreed: string[] = [];
  const disagreed: StrategyComparison['disagreed'] = [];

  const allTargets = new Set([
    ...r1.decisions.map((d) => d.targetId),
    ...r2.decisions.map((d) => d.targetId),
  ]);

  for (const id of allTargets) {
    const d1 = r1.decisions.find((d) => d.targetId === id);
    const d2 = r2.decisions.find((d) => d.targetId === id);
    if (d1?.action === d2?.action) {
      agreed.push(id);
    } else {
      disagreed.push({ targetId: id, action1: d1?.action ?? 'none', action2: d2?.action ?? 'none' });
    }
  }

  const total = allTargets.size;
  return {
    strategy1: name1,
    strategy2: name2,
    agreed,
    disagreed,
    totalItems: total,
    agreementRate: total === 0 ? 1 : agreed.length / total,
  };
}

// ── Escalation inspection ─────────────────────────────────────────────────────

export interface EscalationTrace {
  sessionId: string;
  firingRules: EscalationRule[];
  dormantRules: EscalationRule[];
  willEscalateTo: string[];
  summary: string;
}

/**
 * Show which escalation rules would fire given the current ambiguity state.
 */
export function inspectEscalationPath(
  session: SemanticSession,
  state: ResolutionState,
  policies: RuntimePolicy[],
): EscalationTrace {
  const scores = scoreSessionAmbiguity(session, state);
  const strategy = buildConversationalStrategy(policies, scores);
  const firing = matchingEscalations(strategy, scores);
  const dormant = strategy.escalationRules.filter((r) => !firing.includes(r));
  const targets = [...new Set(firing.map((r) => r.escalateTo))];

  return {
    sessionId: session.id,
    firingRules: firing,
    dormantRules: dormant,
    willEscalateTo: targets,
    summary: firing.length > 0
      ? `${firing.length} escalation rule(s) would fire → ${targets.join(', ')}.`
      : 'No escalation rules currently active.',
  };
}

// ── Policy set utilities ──────────────────────────────────────────────────────

/**
 * Merge two policy sets. Policies in `overrides` replace matching IDs in `base`.
 */
export function mergePolicySets(
  base: RuntimePolicy[],
  overrides: RuntimePolicy[],
): RuntimePolicy[] {
  const overrideMap = new Map(overrides.map((p) => [p.id, p]));
  const merged = base.map((p) => overrideMap.get(p.id) ?? p);
  // Add overrides not present in base
  for (const p of overrides) {
    if (!base.some((b) => b.id === p.id)) merged.push(p);
  }
  return merged;
}

/**
 * Summarize a policy set for the constructor inspector panel.
 */
export function summarizePolicies(policies: RuntimePolicy[]): {
  total: number;
  enabled: number;
  byType: Record<string, number>;
} {
  const byType: Record<string, number> = {};
  let enabled = 0;
  for (const p of policies) {
    byType[p.type] = (byType[p.type] ?? 0) + 1;
    if (p.enabled) enabled++;
  }
  return { total: policies.length, enabled, byType };
}
