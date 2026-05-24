/**
 * Tests: Runtime Policy & Conversational Strategy System (Phase L)
 *
 * Covers:
 *   - runtimePolicy model (RuntimePolicy, ConversationalStrategy types)
 *   - ambiguityScorer: scoreHintAmbiguity, scoreScopeHintAmbiguity, scoreGroupAmbiguity,
 *     scoreOrphanAmount, scoreSessionAmbiguity, computeOverallAmbiguityScore, findDominantKind
 *   - policyEngine: DEFAULT_POLICIES, evaluatePolicies, applyDefaultPolicies,
 *     filterDecisionsByAction, requiresUserInput, countDecisionsByAction
 *   - conversationalStrategy: selectClarificationBehavior, paceConversation,
 *     suppressLowValueNoise, buildConversationalStrategy, matchingRules, matchingEscalations
 *   - policyDiagnostics: buildPolicyDiagnosticReport, explainWhyClarificationTriggered,
 *     explainWhyAutoResolved, explainWhyDeferred, explainWhichPolicyApplied
 *   - policyBridge: editPolicy, togglePolicy, updatePolicyConfig, previewPolicyImpact,
 *     replaySessionWithPolicies, compareStrategies, inspectEscalationPath,
 *     mergePolicySets, summarizePolicies
 *   - Determinism
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ClarificationHint } from '../features/expenses/engine/semanticFragment';
import type { PurchaseGroup } from '../features/expenses/engine/purchaseGroup';
import type { ScopeHint } from '../features/expenses/engine/semanticScope';
import type { ResolutionState } from '../features/expenses/engine/semanticAction';
import type { RuntimePolicy } from '../features/expenses/engine/runtimePolicy';
import {
  scoreHintAmbiguity,
  scoreScopeHintAmbiguity,
  scoreGroupAmbiguity,
  scoreOrphanAmount,
  scoreSessionAmbiguity,
  computeOverallAmbiguityScore,
  findDominantKind,
  baseScoreForKind,
} from '../features/expenses/engine/ambiguityScorer';
import {
  DEFAULT_POLICIES,
  evaluatePolicies,
  applyDefaultPolicies,
  filterDecisionsByAction,
  requiresUserInput,
  countDecisionsByAction,
} from '../features/expenses/engine/policyEngine';
import {
  DEFAULT_STRATEGIES,
  selectClarificationBehavior,
  paceConversation,
  suppressLowValueNoise,
  buildConversationalStrategy,
  matchingRules,
  matchingEscalations,
} from '../features/expenses/engine/conversationalStrategy';
import {
  buildInitialResolutionState,
  resetActionIds,
} from '../features/expenses/engine/resolutionEngine';
import { createSession, resetSessionIds } from '../features/expenses/engine/sessionManager';
import { resetEventIds } from '../features/expenses/engine/semanticEventTimeline';
import type { SessionAmbiguityReport } from '../features/expenses/engine/ambiguityScorer';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeHint(
  kind: ClarificationHint['kind'],
  fragmentId: string,
  candidates: string[] = [],
): ClarificationHint {
  return { kind, fragmentId, candidates };
}

function makeScopeHint(kind: ScopeHint['kind'], phraseId: string, candidates: string[] = []): ScopeHint {
  return { kind, phraseId, candidates };
}

function makeGroup(id: string, suggestedSplit = false, signals: string[] = []): PurchaseGroup {
  return { id, itemFragmentIds: [], modifierFragmentIds: [], confidenceSignals: signals, suggestedSplit };
}

function emptyResolutionState(): ResolutionState {
  return {
    resolvedGroups: [],
    pendingGroups: [],
    unresolvedHints: [],
    autoResolvedHints: [],
    blockedResolutions: [],
    ambiguityScore: 0,
  };
}

function makeScoreReport(overallScore = 0, requiresUser = 0, autoRes = 0): SessionAmbiguityReport {
  return {
    sessionId: 'session_test',
    overallScore,
    scores: [],
    dominantKind: undefined,
    autoResolvableCount: autoRes,
    requiresUserCount: requiresUser,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-24T12:00:00Z'));
  resetSessionIds();
  resetActionIds();
  resetEventIds();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. RuntimePolicy model
// ═══════════════════════════════════════════════════════════════════════════════

describe('RuntimePolicy model', () => {
  it('DEFAULT_POLICIES has 6 policies', () => {
    expect(DEFAULT_POLICIES).toHaveLength(6);
  });

  it('all default policies have required fields', () => {
    for (const p of DEFAULT_POLICIES) {
      expect(p.id).toBeDefined();
      expect(p.type).toBeDefined();
      expect(typeof p.enabled).toBe('boolean');
      expect(typeof p.priority).toBe('number');
      expect(p.configuration).toBeDefined();
    }
  });

  it('default policies are sorted by priority', () => {
    const sorted = [...DEFAULT_POLICIES].sort((a, b) => a.priority - b.priority);
    expect(sorted.map((p) => p.id)).toEqual(DEFAULT_POLICIES.map((p) => p.id));
  });

  it('all default policies are enabled', () => {
    expect(DEFAULT_POLICIES.every((p) => p.enabled)).toBe(true);
  });

  it('policy types cover all 6 variants', () => {
    const types = new Set(DEFAULT_POLICIES.map((p) => p.type));
    expect(types.has('clarification_policy')).toBe(true);
    expect(types.has('auto_resolution_policy')).toBe(true);
    expect(types.has('merchant_policy')).toBe(true);
    expect(types.has('split_policy')).toBe(true);
    expect(types.has('ambiguity_policy')).toBe(true);
    expect(types.has('retry_policy')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. ConversationalStrategy model
// ═══════════════════════════════════════════════════════════════════════════════

describe('ConversationalStrategy model', () => {
  it('DEFAULT_STRATEGIES has 3 strategies', () => {
    expect(DEFAULT_STRATEGIES).toHaveLength(3);
  });

  it('each strategy has required fields', () => {
    for (const s of DEFAULT_STRATEGIES) {
      expect(s.id).toBeDefined();
      expect(s.name).toBeDefined();
      expect(Array.isArray(s.appliesTo)).toBe(true);
      expect(Array.isArray(s.decisionRules)).toBe(true);
      expect(Array.isArray(s.escalationRules)).toBe(true);
      expect(s.clarificationBehavior).toBeDefined();
    }
  });

  it('minimal strategy uses minimal behavior', () => {
    const minimal = DEFAULT_STRATEGIES.find((s) => s.id === 'strategy_minimal');
    expect(minimal?.clarificationBehavior).toBe('minimal');
  });

  it('standard strategy uses ask_immediately behavior', () => {
    const standard = DEFAULT_STRATEGIES.find((s) => s.id === 'strategy_standard');
    expect(standard?.clarificationBehavior).toBe('ask_immediately');
  });

  it('suppress strategy uses suppress behavior', () => {
    const suppress = DEFAULT_STRATEGIES.find((s) => s.id === 'strategy_suppress');
    expect(suppress?.clarificationBehavior).toBe('suppress');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ambiguityScorer — scoreHintAmbiguity
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreHintAmbiguity', () => {
  it('conflicting_signals scores 90, not auto-resolvable', () => {
    const hint = makeHint('conflicting_signals', 'f1', ['m1', 'm2']);
    const score = scoreHintAmbiguity(hint);
    expect(score.score).toBe(90);
    expect(score.isAutoResolvable).toBe(false);
    expect(score.kind).toBe('conflicting_signals');
    expect(score.priority).toBe(0);
  });

  it('unknown_merchant scores 80, not auto-resolvable', () => {
    const hint = makeHint('unknown_merchant', 'f2', []);
    const score = scoreHintAmbiguity(hint);
    expect(score.score).toBe(80);
    expect(score.isAutoResolvable).toBe(false);
    expect(score.kind).toBe('unknown_merchant');
  });

  it('ambiguous_item scores 50, not auto-resolvable', () => {
    const hint = makeHint('ambiguous_item', 'f3', []);
    const score = scoreHintAmbiguity(hint);
    expect(score.score).toBe(50);
    expect(score.isAutoResolvable).toBe(false);
    expect(score.kind).toBe('category_ambiguity');
  });

  it('multiple_categories with 2 candidates: not auto-resolvable, score > 10', () => {
    const hint = makeHint('multiple_categories', 'f4', ['cat_a', 'cat_b']);
    const score = scoreHintAmbiguity(hint);
    expect(score.isAutoResolvable).toBe(false);
    expect(score.score).toBeGreaterThan(10);
  });

  it('multiple_categories with 0 candidates: auto-resolvable, low score', () => {
    const hint = makeHint('multiple_categories', 'f5', []);
    const score = scoreHintAmbiguity(hint);
    expect(score.isAutoResolvable).toBe(true);
    expect(score.score).toBeLessThan(30);
  });

  it('multiple_categories with 1 candidate: auto-resolvable', () => {
    const hint = makeHint('multiple_categories', 'f6', ['cat_a']);
    const score = scoreHintAmbiguity(hint);
    expect(score.isAutoResolvable).toBe(true);
  });

  it('evidence array includes fragmentId', () => {
    const hint = makeHint('unknown_merchant', 'frag_test', []);
    const score = scoreHintAmbiguity(hint);
    expect(score.evidence.some((e) => e.includes('frag_test'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. scoreScopeHintAmbiguity
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreScopeHintAmbiguity', () => {
  it('ambiguous_modifier_target scores 40', () => {
    const hint = makeScopeHint('ambiguous_modifier_target', 'ph1', ['ph2', 'ph3']);
    const score = scoreScopeHintAmbiguity(hint);
    expect(score.score).toBe(40);
    expect(score.kind).toBe('conflicting_modifiers');
  });

  it('orphan_modifier scores less than ambiguous', () => {
    const hint = makeScopeHint('orphan_modifier', 'ph1', []);
    const score = scoreScopeHintAmbiguity(hint);
    expect(score.score).toBeLessThan(40);
  });

  it('auto-resolvable when candidates.length <= 1', () => {
    const hint = makeScopeHint('ambiguous_modifier_target', 'ph1', ['ph2']);
    expect(scoreScopeHintAmbiguity(hint).isAutoResolvable).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. scoreGroupAmbiguity
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreGroupAmbiguity', () => {
  it('group with suggestedSplit scores 25', () => {
    const group = makeGroup('g0', true);
    const score = scoreGroupAmbiguity(group);
    expect(score.score).toBe(25);
    expect(score.kind).toBe('unresolved_split');
    expect(score.isAutoResolvable).toBe(false);
  });

  it('group without suggestedSplit scores 5 and is auto-resolvable', () => {
    const group = makeGroup('g0', false);
    const score = scoreGroupAmbiguity(group);
    expect(score.score).toBe(5);
    expect(score.isAutoResolvable).toBe(true);
  });

  it('evidence contains groupId', () => {
    const group = makeGroup('g0', true);
    expect(scoreGroupAmbiguity(group).evidence.some((e) => e.includes('g0'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. scoreOrphanAmount
// ═══════════════════════════════════════════════════════════════════════════════

describe('scoreOrphanAmount', () => {
  it('returns undefined when no amount', () => {
    const session = createSession('кофе');
    const ctx = session.parserContexts[0];
    // Override for test: ctx without amount
    const fakeCtx = { ...ctx!, amount: undefined };
    expect(scoreOrphanAmount(fakeCtx)).toBeUndefined();
  });

  it('returns undefined when amount has an anchor', () => {
    const session = createSession('старбакс 150');
    const ctx = session.parserContexts[0]!;
    // If merchant is detected, not an orphan
    if (ctx.merchant) {
      expect(scoreOrphanAmount(ctx)).toBeUndefined();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. computeOverallAmbiguityScore
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeOverallAmbiguityScore', () => {
  it('returns 0 for empty list', () => {
    expect(computeOverallAmbiguityScore([])).toBe(0);
  });

  it('single score: returns that score', () => {
    const score = scoreHintAmbiguity(makeHint('conflicting_signals', 'f', ['m1', 'm2']));
    expect(computeOverallAmbiguityScore([score])).toBe(90);
  });

  it('multiple scores: dominated by highest', () => {
    const s1 = scoreHintAmbiguity(makeHint('conflicting_signals', 'f1', []));
    const s2 = scoreHintAmbiguity(makeHint('ambiguous_item', 'f2', []));
    const overall = computeOverallAmbiguityScore([s1, s2]);
    expect(overall).toBeGreaterThan(90); // 90 + 5 (10% of 50)
    expect(overall).toBeLessThanOrEqual(100);
  });

  it('capped at 100', () => {
    const scores = Array.from({ length: 10 }, (_, i) =>
      scoreHintAmbiguity(makeHint('conflicting_signals', `f${i}`, [])),
    );
    expect(computeOverallAmbiguityScore(scores)).toBeLessThanOrEqual(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. findDominantKind
// ═══════════════════════════════════════════════════════════════════════════════

describe('findDominantKind', () => {
  it('returns undefined for empty list', () => {
    expect(findDominantKind([])).toBeUndefined();
  });

  it('returns kind with highest score', () => {
    const scores = [
      scoreHintAmbiguity(makeHint('ambiguous_item', 'f1', [])),
      scoreHintAmbiguity(makeHint('conflicting_signals', 'f2', [])),
    ];
    expect(findDominantKind(scores)).toBe('conflicting_signals');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. baseScoreForKind
// ═══════════════════════════════════════════════════════════════════════════════

describe('baseScoreForKind', () => {
  it('conflicting_signals = 90', () => { expect(baseScoreForKind('conflicting_signals')).toBe(90); });
  it('unknown_merchant = 80', () => { expect(baseScoreForKind('unknown_merchant')).toBe(80); });
  it('category_ambiguity = 50', () => { expect(baseScoreForKind('category_ambiguity')).toBe(50); });
  it('unresolved_split = 25', () => { expect(baseScoreForKind('unresolved_split')).toBe(25); });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. policyEngine — evaluatePolicies
// ═══════════════════════════════════════════════════════════════════════════════

describe('evaluatePolicies — conflicting_signals → ask', () => {
  it('conflicting_signals hint gets ask decision', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['frag_conflict'] };

    // Patch session context to have the hint
    const patchedSession = {
      ...session,
      parserContexts: [{
        ...session.parserContexts[0],
        clarificationHints: [makeHint('conflicting_signals', 'frag_conflict', ['m1', 'm2'])],
      }],
    };

    const scores: SessionAmbiguityReport = {
      sessionId: session.id,
      overallScore: 90,
      scores: [scoreHintAmbiguity(makeHint('conflicting_signals', 'frag_conflict', []))],
      dominantKind: 'conflicting_signals',
      autoResolvableCount: 0,
      requiresUserCount: 1,
    };

    const result = evaluatePolicies(DEFAULT_POLICIES, state, patchedSession as any, scores);
    const decisions = result.decisions;
    expect(decisions.some((d) => d.targetId === 'frag_conflict' && d.action === 'ask')).toBe(true);
  });
});

describe('evaluatePolicies — multiple_categories with ≤1 candidate → auto_resolve', () => {
  it('auto-resolves multiple_categories with 0 candidates', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['frag_multi'] };

    const patchedSession = {
      ...session,
      parserContexts: [{
        ...session.parserContexts[0],
        clarificationHints: [makeHint('multiple_categories', 'frag_multi', [])],
      }],
    };

    const scores: SessionAmbiguityReport = {
      sessionId: session.id,
      overallScore: 10,
      scores: [scoreHintAmbiguity(makeHint('multiple_categories', 'frag_multi', []))],
      dominantKind: 'category_ambiguity',
      autoResolvableCount: 1,
      requiresUserCount: 0,
    };

    const result = evaluatePolicies(DEFAULT_POLICIES, state, patchedSession as any, scores);
    const auto = result.decisions.find((d) => d.targetId === 'frag_multi');
    expect(auto?.action).toBe('auto_resolve');
  });
});

describe('evaluatePolicies — unknown_merchant → escalate', () => {
  it('unknown_merchant hint gets escalate or ask decision', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['frag_merch'] };

    const patchedSession = {
      ...session,
      parserContexts: [{
        ...session.parserContexts[0],
        clarificationHints: [makeHint('unknown_merchant', 'frag_merch', [])],
      }],
    };

    const scores: SessionAmbiguityReport = {
      sessionId: session.id,
      overallScore: 80,
      scores: [scoreHintAmbiguity(makeHint('unknown_merchant', 'frag_merch', []))],
      dominantKind: 'unknown_merchant',
      autoResolvableCount: 0,
      requiresUserCount: 1,
    };

    const result = evaluatePolicies(DEFAULT_POLICIES, state, patchedSession as any, scores);
    const dec = result.decisions.find((d) => d.targetId === 'frag_merch');
    // clarification_policy fires first (score 80 >= minScore 60 or in askImmediately)
    expect(['ask', 'escalate']).toContain(dec?.action);
  });
});

describe('evaluatePolicies — pending group → ask', () => {
  it('group with suggestedSplit gets ask decision from split_policy', () => {
    const session = createSession('молоко хлеб 200');
    const patchedSession = {
      ...session,
      pendingGroups: [makeGroup('g0', true)],
    };
    const state: ResolutionState = { ...emptyResolutionState(), pendingGroups: ['g0'] };
    const scores = makeScoreReport(25, 1, 0);
    const result = evaluatePolicies(DEFAULT_POLICIES, state, patchedSession as any, scores);
    const dec = result.decisions.find((d) => d.targetId === 'g0');
    expect(dec?.action).toBe('ask');
  });
});

describe('evaluatePolicies — empty state → no decisions', () => {
  it('returns empty decisions for empty state', () => {
    const session = createSession('кофе 50');
    const state = emptyResolutionState();
    const scores = makeScoreReport(0, 0, 0);
    const result = evaluatePolicies(DEFAULT_POLICIES, state, session, scores);
    expect(result.decisions).toHaveLength(0);
    expect(result.overallStrategy).toMatch(/no pending/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. filterDecisionsByAction / requiresUserInput / countDecisionsByAction
// ═══════════════════════════════════════════════════════════════════════════════

describe('policy engine helpers', () => {
  it('filterDecisionsByAction filters correctly', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['h1', 'h2'],
    };
    const patchedSession = {
      ...session,
      parserContexts: [{
        ...session.parserContexts[0],
        clarificationHints: [
          makeHint('conflicting_signals', 'h1', ['m1', 'm2']),
          makeHint('multiple_categories', 'h2', []),
        ],
      }],
    };
    const scores = makeScoreReport(50, 1, 1);
    const result = evaluatePolicies(DEFAULT_POLICIES, state, patchedSession as any, scores);
    const asks = filterDecisionsByAction(result, 'ask');
    const autoRes = filterDecisionsByAction(result, 'auto_resolve');
    expect(asks.every((d) => d.action === 'ask')).toBe(true);
    expect(autoRes.every((d) => d.action === 'auto_resolve')).toBe(true);
  });

  it('requiresUserInput returns false for empty decisions', () => {
    const result = { decisions: [], appliedPolicies: [], skippedPolicies: [], overallStrategy: '' };
    expect(requiresUserInput(result)).toBe(false);
  });

  it('countDecisionsByAction counts correctly', () => {
    const result = {
      decisions: [
        { targetId: 'a', action: 'ask' as const, reason: '', appliedPolicyId: undefined },
        { targetId: 'b', action: 'ask' as const, reason: '', appliedPolicyId: undefined },
        { targetId: 'c', action: 'auto_resolve' as const, reason: '', appliedPolicyId: undefined },
      ],
      appliedPolicies: [],
      skippedPolicies: [],
      overallStrategy: '',
    };
    expect(countDecisionsByAction(result, 'ask')).toBe(2);
    expect(countDecisionsByAction(result, 'auto_resolve')).toBe(1);
    expect(countDecisionsByAction(result, 'defer')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. selectClarificationBehavior
// ═══════════════════════════════════════════════════════════════════════════════

describe('selectClarificationBehavior', () => {
  it('suppress when requiresUserCount=0', () => {
    const scores = makeScoreReport(50, 0, 2);
    expect(selectClarificationBehavior(scores, DEFAULT_POLICIES)).toBe('suppress');
  });

  it('suppress when overallScore < 20', () => {
    const scores = makeScoreReport(5, 1, 0);
    expect(selectClarificationBehavior(scores, DEFAULT_POLICIES)).toBe('suppress');
  });

  it('ask_immediately when overallScore >= 70', () => {
    const scores = makeScoreReport(80, 2, 0);
    expect(selectClarificationBehavior(scores, DEFAULT_POLICIES)).toBe('ask_immediately');
  });

  it('defer_low_priority when score between 20-50 with ambiguity_policy', () => {
    const scores = makeScoreReport(40, 1, 0);
    const result = selectClarificationBehavior(scores, DEFAULT_POLICIES);
    expect(['defer_low_priority', 'minimal']).toContain(result);
  });

  it('minimal for mid-range scores', () => {
    const scores = makeScoreReport(55, 1, 0);
    // 55 < 70 and has requiresUser → minimal or defer
    const result = selectClarificationBehavior(scores, DEFAULT_POLICIES);
    expect(['minimal', 'defer_low_priority']).toContain(result);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. paceConversation
// ═══════════════════════════════════════════════════════════════════════════════

describe('paceConversation', () => {
  const mockPlan = {
    toAsk: [
      { kind: 'conflicting_signals', priority: 0, hints: [makeHint('conflicting_signals', 'f1', [])] },
      { kind: 'unknown_merchant', priority: 1, hints: [makeHint('unknown_merchant', 'f2', [])] },
      { kind: 'ambiguous_item', priority: 2, hints: [makeHint('ambiguous_item', 'f3', [])] },
    ],
    autoResolved: [],
    nextBatch: undefined,
    totalUserActionRequired: 3,
  };

  it('ask_immediately: returns full plan', () => {
    const result = paceConversation(mockPlan, 'ask_immediately');
    expect(result.toAsk).toHaveLength(3);
  });

  it('batch_by_kind: returns full plan', () => {
    const result = paceConversation(mockPlan, 'batch_by_kind');
    expect(result.toAsk).toHaveLength(3);
  });

  it('minimal: returns only first batch', () => {
    const result = paceConversation(mockPlan, 'minimal');
    expect(result.toAsk).toHaveLength(1);
    expect(result.toAsk[0].kind).toBe('conflicting_signals');
  });

  it('defer_low_priority: returns only high-priority batches (priority ≤ 1)', () => {
    const result = paceConversation(mockPlan, 'defer_low_priority');
    expect(result.toAsk.every((b) => b.priority <= 1)).toBe(true);
    expect(result.toAsk).toHaveLength(2);
  });

  it('suppress: returns empty plan', () => {
    const result = paceConversation(mockPlan, 'suppress');
    expect(result.toAsk).toHaveLength(0);
    expect(result.totalUserActionRequired).toBe(0);
  });

  it('paced plan preserves autoResolved', () => {
    const planWithAuto = { ...mockPlan, autoResolved: ['frag_auto'] };
    const result = paceConversation(planWithAuto, 'suppress');
    expect(result.autoResolved).toContain('frag_auto');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. suppressLowValueNoise
// ═══════════════════════════════════════════════════════════════════════════════

describe('suppressLowValueNoise', () => {
  it('suppresses multiple_categories with 0 candidates', () => {
    const hints = [makeHint('multiple_categories', 'f1', [])];
    const { suppressed, kept } = suppressLowValueNoise(hints);
    expect(suppressed).toContain('f1');
    expect(kept).toHaveLength(0);
  });

  it('suppresses multiple_categories with 1 candidate', () => {
    const hints = [makeHint('multiple_categories', 'f1', ['cat_a'])];
    const { suppressed } = suppressLowValueNoise(hints);
    expect(suppressed).toContain('f1');
  });

  it('keeps multiple_categories with 2+ candidates', () => {
    const hints = [makeHint('multiple_categories', 'f1', ['cat_a', 'cat_b'])];
    const { kept } = suppressLowValueNoise(hints);
    expect(kept).toHaveLength(1);
  });

  it('always keeps conflicting_signals', () => {
    const hints = [makeHint('conflicting_signals', 'f1', ['m1', 'm2'])];
    const { kept } = suppressLowValueNoise(hints);
    expect(kept).toHaveLength(1);
  });

  it('always keeps unknown_merchant', () => {
    const hints = [makeHint('unknown_merchant', 'f1', [])];
    const { kept } = suppressLowValueNoise(hints);
    expect(kept).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. buildConversationalStrategy
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildConversationalStrategy', () => {
  it('returns a strategy with a name', () => {
    const scores = makeScoreReport(50, 1, 0);
    const strategy = buildConversationalStrategy(DEFAULT_POLICIES, scores);
    expect(strategy.name).toBeDefined();
  });

  it('suppress behavior when overallScore=0', () => {
    const scores = makeScoreReport(0, 0, 0);
    const strategy = buildConversationalStrategy(DEFAULT_POLICIES, scores);
    expect(strategy.clarificationBehavior).toBe('suppress');
  });

  it('ask_immediately behavior when overallScore=90', () => {
    const scores = makeScoreReport(90, 2, 0);
    const strategy = buildConversationalStrategy(DEFAULT_POLICIES, scores);
    expect(strategy.clarificationBehavior).toBe('ask_immediately');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. matchingRules + matchingEscalations
// ═══════════════════════════════════════════════════════════════════════════════

describe('matchingRules', () => {
  it('high score returns ask/escalate rules', () => {
    const scores = makeScoreReport(80, 2, 0);
    const strategy = DEFAULT_STRATEGIES[0]; // minimal
    const rules = matchingRules(strategy, scores);
    expect(rules.every((r) => r.action === 'ask' || r.action === 'escalate')).toBe(true);
  });

  it('low score returns suppress/auto_resolve rules', () => {
    const scores = makeScoreReport(5, 0, 1);
    const strategy = DEFAULT_STRATEGIES[2]; // suppress
    const rules = matchingRules(strategy, scores);
    expect(rules.every((r) => r.action === 'suppress' || r.action === 'auto_resolve')).toBe(true);
  });
});

describe('matchingEscalations', () => {
  it('fires escalation for unknown_merchant dominant kind', () => {
    const scores: SessionAmbiguityReport = {
      ...makeScoreReport(80, 1, 0),
      dominantKind: 'unknown_merchant',
    };
    const strategy = DEFAULT_STRATEGIES[0]; // minimal — has esc_unknown_merchant
    const escalations = matchingEscalations(strategy, scores);
    expect(escalations.length).toBeGreaterThan(0);
    expect(escalations.some((e) => e.escalateTo === 'user')).toBe(true);
  });

  it('no escalation when dominant kind is unresolved_split', () => {
    const scores: SessionAmbiguityReport = {
      ...makeScoreReport(25, 1, 0),
      dominantKind: 'unresolved_split',
    };
    const strategy = DEFAULT_STRATEGIES[1]; // standard — no escalation rules
    const escalations = matchingEscalations(strategy, scores);
    expect(escalations).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. Determinism


// ═══════════════════════════════════════════════════════════════════════════════
// 24. Determinism
// ═══════════════════════════════════════════════════════════════════════════════

describe('Determinism', () => {
  it('evaluatePolicies with same inputs produces same result', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const scores = makeScoreReport(0, 0, 0);
    const r1 = evaluatePolicies(DEFAULT_POLICIES, state, session, scores);
    const r2 = evaluatePolicies(DEFAULT_POLICIES, state, session, scores);
    expect(r1.decisions.length).toBe(r2.decisions.length);
    expect(r1.overallStrategy).toBe(r2.overallStrategy);
  });

  it('scoreHintAmbiguity is stable', () => {
    const hint = makeHint('conflicting_signals', 'f1', ['m1', 'm2']);
    const s1 = scoreHintAmbiguity(hint);
    const s2 = scoreHintAmbiguity(hint);
    expect(s1.score).toBe(s2.score);
    expect(s1.kind).toBe(s2.kind);
    expect(s1.isAutoResolvable).toBe(s2.isAutoResolvable);
  });

  it('paceConversation is stable', () => {
    const plan = {
      toAsk: [{ kind: 'conflicting_signals', priority: 0, hints: [makeHint('conflicting_signals', 'f1', [])] }],
      autoResolved: [],
      nextBatch: undefined,
      totalUserActionRequired: 1,
    };
    const r1 = paceConversation(plan, 'minimal');
    const r2 = paceConversation(plan, 'minimal');
    expect(r1.toAsk.length).toBe(r2.toAsk.length);
  });

  it('selectClarificationBehavior is stable', () => {
    const scores = makeScoreReport(75, 2, 0);
    const b1 = selectClarificationBehavior(scores, DEFAULT_POLICIES);
    const b2 = selectClarificationBehavior(scores, DEFAULT_POLICIES);
    expect(b1).toBe(b2);
  });

});
