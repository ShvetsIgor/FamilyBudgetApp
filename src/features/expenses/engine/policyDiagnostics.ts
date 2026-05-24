/**
 * LAYER: policy diagnostics — policy-aware explainability layer.
 *
 * Answers "why?" questions specifically in the context of policy decisions:
 *   - Why was this clarification triggered (and which policy caused it)?
 *   - Why was this ambiguity auto-resolved?
 *   - Why was this resolution deferred?
 *   - Why did a retry occur?
 *   - Which policy applied?
 *   - Which strategy escalated?
 *
 * Builds on resolutionDiagnostics.ts but adds policy attribution.
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - All explanations are deterministic.
 *   - No AI, no probabilistic reasoning.
 */

import type { RuntimePolicy, ConversationalStrategy, PolicyDecision, PolicyEvaluationResult } from './runtimePolicy';
import type { SessionAmbiguityReport, AmbiguityScore } from './ambiguityScorer';
import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';

// ── Diagnostic model ──────────────────────────────────────────────────────────

export interface PolicyDiagnosticEntry {
  /** Hint fragmentId or group ID this entry is about. */
  targetId: string;
  decision: PolicyDecision;
  /** The policy that drove this decision, or undefined if fallback. */
  appliedPolicy: RuntimePolicy | undefined;
  /** Human-readable explanation including policy attribution. */
  reason: string;
  /** Ambiguity score for this target, if available. */
  ambiguityScore: AmbiguityScore | undefined;
}

export interface PolicyDiagnosticReport {
  sessionId: string;
  entries: PolicyDiagnosticEntry[];
  appliedPolicies: RuntimePolicy[];
  strategyName: string;
  overallBehavior: string;
  /** Items that require user interaction. */
  requiresUserAction: string[];
  /** Items that will be resolved automatically. */
  willAutoResolve: string[];
  /** Items that are deferred or suppressed. */
  deferred: string[];
}

// ── Entry builder ─────────────────────────────────────────────────────────────

export function buildPolicyDiagnosticEntry(
  decision: PolicyDecision,
  allPolicies: RuntimePolicy[],
  scores: SessionAmbiguityReport,
): PolicyDiagnosticEntry {
  const policy = decision.appliedPolicyId
    ? allPolicies.find((p) => p.id === decision.appliedPolicyId)
    : undefined;

  const ambiguityScore = scores.scores.find(
    (s) =>
      s.evidence.some((e) => e.includes(decision.targetId)) ||
      (s.kind === 'unresolved_split' && s.evidence.some((e) => e.includes(decision.targetId))),
  );

  const reason = buildEntryReason(decision, policy, ambiguityScore);

  return {
    targetId: decision.targetId,
    decision,
    appliedPolicy: policy,
    reason,
    ambiguityScore,
  };
}

// ── Full report ───────────────────────────────────────────────────────────────

export function buildPolicyDiagnosticReport(
  session: SemanticSession,
  _state: ResolutionState,
  evalResult: PolicyEvaluationResult,
  allPolicies: RuntimePolicy[],
  scores: SessionAmbiguityReport,
  strategy: ConversationalStrategy,
): PolicyDiagnosticReport {
  const entries = evalResult.decisions.map((d) =>
    buildPolicyDiagnosticEntry(d, allPolicies, scores),
  );

  const appliedPolicies = allPolicies.filter((p) =>
    evalResult.appliedPolicies.includes(p.id),
  );

  return {
    sessionId: session.id,
    entries,
    appliedPolicies,
    strategyName: strategy.name,
    overallBehavior: strategy.clarificationBehavior,
    requiresUserAction: evalResult.decisions
      .filter((d) => d.action === 'ask' || d.action === 'escalate')
      .map((d) => d.targetId),
    willAutoResolve: evalResult.decisions
      .filter((d) => d.action === 'auto_resolve')
      .map((d) => d.targetId),
    deferred: evalResult.decisions
      .filter((d) => d.action === 'defer' || d.action === 'suppress')
      .map((d) => d.targetId),
  };
}

// ── Targeted explanations ─────────────────────────────────────────────────────

/** Why was clarification triggered for this target? */
export function explainWhyClarificationTriggered(
  targetId: string,
  evalResult: PolicyEvaluationResult,
  allPolicies: RuntimePolicy[],
  scores: SessionAmbiguityReport,
): string {
  const dec = evalResult.decisions.find((d) => d.targetId === targetId);
  if (!dec) return `Target ${targetId} not found in evaluation results.`;
  if (dec.action !== 'ask' && dec.action !== 'escalate') {
    return `Target ${targetId} was not asked about — action was "${dec.action}".`;
  }
  const policy = dec.appliedPolicyId
    ? allPolicies.find((p) => p.id === dec.appliedPolicyId)
    : undefined;
  const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(targetId)));
  return [
    `Clarification triggered for ${targetId}.`,
    `Reason: ${dec.reason}`,
    policy ? `Policy: ${policy.id} (type=${policy.type}, priority=${policy.priority}).` : 'No specific policy — fallback.',
    score ? `Ambiguity score: ${score.score}/100 (kind=${score.kind}).` : '',
  ].filter(Boolean).join(' ');
}

/** Why was this ambiguity auto-resolved? */
export function explainWhyAutoResolved(
  targetId: string,
  evalResult: PolicyEvaluationResult,
  allPolicies: RuntimePolicy[],
  scores: SessionAmbiguityReport,
): string {
  const dec = evalResult.decisions.find((d) => d.targetId === targetId);
  if (!dec) return `Target ${targetId} not found in evaluation results.`;
  if (dec.action !== 'auto_resolve') {
    return `Target ${targetId} was not auto-resolved — action was "${dec.action}".`;
  }
  const policy = dec.appliedPolicyId
    ? allPolicies.find((p) => p.id === dec.appliedPolicyId)
    : undefined;
  const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(targetId)));
  return [
    `Auto-resolved: ${targetId}.`,
    `Reason: ${dec.reason}`,
    policy ? `Policy: ${policy.id} (${policy.type}).` : '',
    score ? `Score ${score.score}/100, isAutoResolvable=${score.isAutoResolvable}.` : '',
  ].filter(Boolean).join(' ');
}

/** Why was this resolution deferred or suppressed? */
export function explainWhyDeferred(
  targetId: string,
  evalResult: PolicyEvaluationResult,
  allPolicies: RuntimePolicy[],
  scores: SessionAmbiguityReport,
): string {
  const dec = evalResult.decisions.find((d) => d.targetId === targetId);
  if (!dec) return `Target ${targetId} not found in evaluation results.`;
  if (dec.action !== 'defer' && dec.action !== 'suppress') {
    return `Target ${targetId} was not deferred — action was "${dec.action}".`;
  }
  const policy = dec.appliedPolicyId
    ? allPolicies.find((p) => p.id === dec.appliedPolicyId)
    : undefined;
  const score = scores.scores.find((s) => s.evidence.some((e) => e.includes(targetId)));
  return [
    `${dec.action === 'suppress' ? 'Suppressed' : 'Deferred'}: ${targetId}.`,
    `Reason: ${dec.reason}`,
    policy ? `Policy: ${policy.id} (threshold config: ${JSON.stringify(policy.configuration)}).` : '',
    score ? `Score ${score.score}/100.` : '',
  ].filter(Boolean).join(' ');
}

/** Which policy applied to this target? */
export function explainWhichPolicyApplied(
  targetId: string,
  evalResult: PolicyEvaluationResult,
  allPolicies: RuntimePolicy[],
): string {
  const dec = evalResult.decisions.find((d) => d.targetId === targetId);
  if (!dec) return `Target ${targetId} not in decisions.`;

  if (!dec.appliedPolicyId) {
    return `Target ${targetId}: fallback decision (no specific policy matched). Action: ${dec.action}.`;
  }

  const policy = allPolicies.find((p) => p.id === dec.appliedPolicyId);
  if (!policy) {
    return `Target ${targetId}: policy ID ${dec.appliedPolicyId} not found in policy list.`;
  }

  return `Target ${targetId}: policy "${policy.id}" (type=${policy.type}, priority=${policy.priority}) → action="${dec.action}".`;
}

// ── Internal ──────────────────────────────────────────────────────────────────

function buildEntryReason(
  decision: PolicyDecision,
  policy: RuntimePolicy | undefined,
  score: AmbiguityScore | undefined,
): string {
  const actionLabel = {
    ask:          'Clarification required',
    auto_resolve: 'Auto-resolved by policy',
    defer:        'Deferred (low priority)',
    escalate:     'Escalated to user',
    suppress:     'Suppressed (noise)',
    retry:        'Retry parse triggered',
  }[decision.action] ?? decision.action;

  const parts = [
    `${actionLabel}: ${decision.reason}`,
    policy ? `[Policy: ${policy.id}]` : '[Fallback]',
  ];
  if (score) parts.push(`[Score: ${score.score}/100]`);
  return parts.join(' ');
}
