/**
 * LAYER: conversational strategy — orchestrates how clarification is presented.
 *
 * Sits above the policy engine and clarification batcher.
 * Transforms a raw ClarificationPlan into a paced, user-friendly presentation.
 *
 * Key responsibilities:
 *   - selectClarificationBehavior: pick ask_immediately/defer/minimal/suppress
 *     based on overall ambiguity + active policies
 *   - paceConversation: filter/trim the clarification plan per behavior mode
 *   - suppressLowValueNoise: remove hints below a score threshold
 *   - buildConversationalStrategy: compose a strategy object from active policies
 *
 * DEFAULT_STRATEGIES covers the two standard presets (minimal + standard).
 *
 * Architecture invariants:
 *   - Pure functions. Same inputs → same output.
 *   - Does not dispatch actions or mutate session state.
 *   - All behavior is explainable: each decision has a reason string.
 */

import type { ClarificationHint } from './semanticFragment';
import type { RuntimePolicy, ConversationalStrategy, ClarificationBehavior, StrategyRule, EscalationRule } from './runtimePolicy';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { ClarificationPlan } from './clarificationBatcher';
import type { ClarificationHintGroup } from './clarificationOrchestrator';

// ── Default strategies ────────────────────────────────────────────────────────

export const DEFAULT_STRATEGIES: ConversationalStrategy[] = [
  {
    id: 'strategy_minimal',
    name: 'Minimal Clarification',
    appliesTo: ['clarification_policy', 'auto_resolution_policy'],
    decisionRules: [
      {
        id: 'rule_auto_trivial',
        condition: 'multiple_categories with ≤1 candidate',
        action: 'auto_resolve',
        priority: 1,
      },
      {
        id: 'rule_ask_conflicting',
        condition: 'conflicting_signals present',
        action: 'ask',
        priority: 2,
      },
      {
        id: 'rule_ask_unknown_merchant',
        condition: 'unknown_merchant present',
        action: 'ask',
        priority: 3,
      },
      {
        id: 'rule_defer_ambiguous_item',
        condition: 'ambiguous_item with low score',
        action: 'defer',
        priority: 4,
      },
    ],
    escalationRules: [
      {
        id: 'esc_unknown_merchant',
        trigger: 'unknown_merchant unresolved',
        escalateTo: 'user',
      },
    ],
    clarificationBehavior: 'minimal',
  },
  {
    id: 'strategy_standard',
    name: 'Standard Clarification',
    appliesTo: ['clarification_policy', 'merchant_policy', 'split_policy'],
    decisionRules: [
      {
        id: 'rule_ask_all_hints',
        condition: 'any unresolved hint',
        action: 'ask',
        priority: 1,
      },
      {
        id: 'rule_ask_splits',
        condition: 'suggestedSplit group present',
        action: 'ask',
        priority: 2,
      },
    ],
    escalationRules: [],
    clarificationBehavior: 'ask_immediately',
  },
  {
    id: 'strategy_suppress',
    name: 'Silent Auto-Resolution',
    appliesTo: ['auto_resolution_policy', 'ambiguity_policy'],
    decisionRules: [
      {
        id: 'rule_auto_all',
        condition: 'any auto-resolvable hint',
        action: 'auto_resolve',
        priority: 1,
      },
      {
        id: 'rule_suppress_noise',
        condition: 'low-score ambiguity',
        action: 'suppress',
        priority: 2,
      },
    ],
    escalationRules: [
      {
        id: 'esc_high_severity',
        trigger: 'conflicting_signals or score >= 80',
        threshold: 80,
        escalateTo: 'user',
      },
    ],
    clarificationBehavior: 'suppress',
  },
];

// ── Behavior selection ────────────────────────────────────────────────────────

/**
 * Select the appropriate ClarificationBehavior based on overall ambiguity
 * and the active policies.
 *
 * Rules (in order):
 *   1. If overallScore < 20 and no manual hints → 'suppress'
 *   2. If requiresUserCount === 0 → 'suppress'
 *   3. If overallScore >= 70 → 'ask_immediately' (high severity)
 *   4. If clarification_policy has batch preference → 'batch_by_kind'
 *   5. If ambiguity_policy is enabled with deferBelow → 'defer_low_priority'
 *   6. Default → 'minimal'
 */
export function selectClarificationBehavior(
  scores: SessionAmbiguityReport,
  policies: RuntimePolicy[],
): ClarificationBehavior {
  const enabledPolicies = policies.filter((p) => p.enabled);

  if (scores.requiresUserCount === 0) return 'suppress';
  if (scores.overallScore < 20) return 'suppress';
  if (scores.overallScore >= 70) return 'ask_immediately';

  const hasAmbigPolicy = enabledPolicies.some((p) => p.type === 'ambiguity_policy');
  if (hasAmbigPolicy && scores.overallScore < 50) return 'defer_low_priority';

  return 'minimal';
}

// ── Conversation pacing ───────────────────────────────────────────────────────

/**
 * Apply conversational pacing to a ClarificationPlan.
 * Returns a filtered/trimmed plan based on the behavior mode.
 *
 *   ask_immediately   → full plan unchanged
 *   batch_by_kind     → full plan (already batched by kind)
 *   minimal           → only the first (highest-priority) batch
 *   defer_low_priority → batches with priority <= 1 (conflicting_signals, unknown_merchant)
 *   suppress          → empty plan
 */
export function paceConversation(
  plan: ClarificationPlan,
  behavior: ClarificationBehavior,
): ClarificationPlan {
  switch (behavior) {
    case 'ask_immediately':
    case 'batch_by_kind':
      return plan;

    case 'minimal': {
      const firstBatch = plan.toAsk[0];
      const toAsk: ClarificationHintGroup[] = firstBatch ? [firstBatch] : [];
      return {
        ...plan,
        toAsk,
        nextBatch: toAsk[0],
        totalUserActionRequired: toAsk.reduce((n, b) => n + b.hints.length, 0),
      };
    }

    case 'defer_low_priority': {
      // Keep only high-priority batches (priority 0 or 1 = conflicting_signals, unknown_merchant)
      const toAsk = plan.toAsk.filter((b) => b.priority <= 1);
      return {
        ...plan,
        toAsk,
        nextBatch: toAsk[0],
        totalUserActionRequired: toAsk.reduce((n, b) => n + b.hints.length, 0),
      };
    }

    case 'suppress':
      return {
        toAsk: [],
        autoResolved: plan.autoResolved,
        nextBatch: undefined,
        totalUserActionRequired: 0,
      };
  }
}

// ── Noise suppression ─────────────────────────────────────────────────────────

/**
 * Remove low-value clarification hints that are not worth asking about.
 *
 * A hint is "low-value noise" if:
 *   - kind === 'multiple_categories' AND candidates.length === 0
 *   - kind === 'multiple_categories' AND scoreBelow threshold (default 20)
 */
export function suppressLowValueNoise(
  hints: ClarificationHint[],
  scoreThreshold = 20,
): { kept: ClarificationHint[]; suppressed: string[] } {
  const kept: ClarificationHint[] = [];
  const suppressed: string[] = [];

  for (const hint of hints) {
    if (hint.kind === 'multiple_categories' && hint.candidates.length === 0) {
      suppressed.push(hint.fragmentId);
      continue;
    }
    // Score-based suppression for multiple_categories only
    if (hint.kind === 'multiple_categories' && hint.candidates.length <= 1) {
      suppressed.push(hint.fragmentId);
      continue;
    }
    kept.push(hint);
  }

  return { kept, suppressed };
}

// ── Strategy builder ──────────────────────────────────────────────────────────

/**
 * Build a ConversationalStrategy from the active policies and session context.
 * Selects and adapts from DEFAULT_STRATEGIES based on which policy types are enabled.
 */
export function buildConversationalStrategy(
  policies: RuntimePolicy[],
  scores: SessionAmbiguityReport,
): ConversationalStrategy {
  const behavior = selectClarificationBehavior(scores, policies);
  const enabledTypes = new Set(policies.filter((p) => p.enabled).map((p) => p.type));

  // Find the best matching default strategy
  let base = DEFAULT_STRATEGIES.find((s) =>
    s.appliesTo.some((type) => enabledTypes.has(type as RuntimePolicy['type'])),
  ) ?? DEFAULT_STRATEGIES[0];

  // Override behavior from what we computed
  if (base.clarificationBehavior !== behavior) {
    base = { ...base, clarificationBehavior: behavior };
  }

  return base;
}

/**
 * Returns strategy rules that match the current ambiguity situation.
 */
export function matchingRules(
  strategy: ConversationalStrategy,
  scores: SessionAmbiguityReport,
): StrategyRule[] {
  // Simple heuristic: if overall score is high, keep 'ask' rules; if low, keep 'suppress'/'defer'
  if (scores.overallScore >= 60) {
    return strategy.decisionRules.filter((r) => r.action === 'ask' || r.action === 'escalate');
  }
  if (scores.overallScore < 20) {
    return strategy.decisionRules.filter((r) => r.action === 'suppress' || r.action === 'auto_resolve');
  }
  return strategy.decisionRules;
}

/**
 * Returns escalation rules that should fire given the current state.
 */
export function matchingEscalations(
  strategy: ConversationalStrategy,
  scores: SessionAmbiguityReport,
): EscalationRule[] {
  return strategy.escalationRules.filter((rule) => {
    if (rule.threshold !== undefined) {
      return scores.overallScore >= rule.threshold;
    }
    // Named trigger: fire if dominant kind matches
    if (rule.trigger.includes('unknown_merchant')) {
      return scores.dominantKind === 'unknown_merchant';
    }
    if (rule.trigger.includes('conflicting_signals')) {
      return scores.dominantKind === 'conflicting_signals';
    }
    return false;
  });
}
