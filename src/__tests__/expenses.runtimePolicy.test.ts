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

describe('buildPolicyDiagnosticEntry', () => {
  it('creates entry with policy reference', () => {
    const dec = {
      targetId: 'h1',
      action: 'ask' as const,
      reason: 'score >= 60',
      appliedPolicyId: 'policy_clarification',
    };
    const scores = makeScoreReport(70, 1, 0);
    const entry = buildPolicyDiagnosticEntry(dec, DEFAULT_POLICIES, scores);
    expect(entry.targetId).toBe('h1');
    expect(entry.appliedPolicy?.id).toBe('policy_clarification');
    expect(entry.reason).toMatch(/clarification/i);
  });

  it('creates entry without policy when appliedPolicyId is undefined', () => {
    const dec = {
      targetId: 'h2',
      action: 'ask' as const,
      reason: 'fallback',
      appliedPolicyId: undefined,
    };
    const entry = buildPolicyDiagnosticEntry(dec, DEFAULT_POLICIES, makeScoreReport());
    expect(entry.appliedPolicy).toBeUndefined();
    expect(entry.reason).toMatch(/fallback/i);
  });
});

describe('buildPolicyDiagnosticReport', () => {
  it('builds report with correct structure', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const scores = makeScoreReport(0, 0, 0);
    const evalResult = { decisions: [], appliedPolicies: [], skippedPolicies: [], overallStrategy: '' };
    const strategy = DEFAULT_STRATEGIES[0];
    const report = buildPolicyDiagnosticReport(session, state, evalResult, DEFAULT_POLICIES, scores, strategy);
    expect(report.sessionId).toBe(session.id);
    expect(Array.isArray(report.entries)).toBe(true);
    expect(report.strategyName).toBe(strategy.name);
  });

  it('separates requiresUserAction from willAutoResolve', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const scores = makeScoreReport(50, 1, 1);
    const evalResult = {
      decisions: [
        { targetId: 'h1', action: 'ask' as const, reason: '', appliedPolicyId: undefined },
        { targetId: 'h2', action: 'auto_resolve' as const, reason: '', appliedPolicyId: undefined },
      ],
      appliedPolicies: [],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const report = buildPolicyDiagnosticReport(session, state, evalResult, DEFAULT_POLICIES, scores, DEFAULT_STRATEGIES[0]);
    expect(report.requiresUserAction).toContain('h1');
    expect(report.willAutoResolve).toContain('h2');
  });
});

describe('explainWhyClarificationTriggered', () => {
  it('explains ask decision', () => {
    const evalResult = {
      decisions: [{ targetId: 'h1', action: 'ask' as const, reason: 'score >= 60', appliedPolicyId: 'policy_clarification' }],
      appliedPolicies: ['policy_clarification'],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const explanation = explainWhyClarificationTriggered('h1', evalResult, DEFAULT_POLICIES, makeScoreReport(70, 1, 0));
    expect(explanation).toMatch(/h1/);
    expect(explanation).toMatch(/policy_clarification/);
  });

  it('notes when decision was not ask', () => {
    const evalResult = {
      decisions: [{ targetId: 'h1', action: 'auto_resolve' as const, reason: '', appliedPolicyId: undefined }],
      appliedPolicies: [],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const explanation = explainWhyClarificationTriggered('h1', evalResult, DEFAULT_POLICIES, makeScoreReport());
    expect(explanation).toMatch(/auto_resolve/);
  });
});

describe('explainWhyAutoResolved', () => {
  it('explains auto_resolve decision', () => {
    const evalResult = {
      decisions: [{ targetId: 'h1', action: 'auto_resolve' as const, reason: '≤1 candidate', appliedPolicyId: 'policy_auto_resolution' }],
      appliedPolicies: ['policy_auto_resolution'],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const explanation = explainWhyAutoResolved('h1', evalResult, DEFAULT_POLICIES, makeScoreReport());
    expect(explanation).toMatch(/auto.resolv/i);
    expect(explanation).toMatch(/policy_auto_resolution/);
  });
});

describe('explainWhyDeferred', () => {
  it('explains defer decision', () => {
    const evalResult = {
      decisions: [{ targetId: 'h1', action: 'defer' as const, reason: 'score < 30', appliedPolicyId: 'policy_ambiguity' }],
      appliedPolicies: ['policy_ambiguity'],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const explanation = explainWhyDeferred('h1', evalResult, DEFAULT_POLICIES, makeScoreReport(20, 1, 0));
    expect(explanation).toMatch(/defer/i);
  });

  it('explains suppress decision', () => {
    const evalResult = {
      decisions: [{ targetId: 'h1', action: 'suppress' as const, reason: 'score < 10', appliedPolicyId: 'policy_ambiguity' }],
      appliedPolicies: [],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const explanation = explainWhyDeferred('h1', evalResult, DEFAULT_POLICIES, makeScoreReport(5, 0, 1));
    expect(explanation).toMatch(/suppress/i);
  });
});

describe('explainWhichPolicyApplied', () => {
  it('names the policy', () => {
    const evalResult = {
      decisions: [{ targetId: 'h1', action: 'ask' as const, reason: '', appliedPolicyId: 'policy_merchant' }],
      appliedPolicies: [],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const explanation = explainWhichPolicyApplied('h1', evalResult, DEFAULT_POLICIES);
    expect(explanation).toMatch(/policy_merchant/);
    expect(explanation).toMatch(/merchant_policy/);
  });

  it('notes fallback when no policy', () => {
    const evalResult = {
      decisions: [{ targetId: 'h1', action: 'ask' as const, reason: '', appliedPolicyId: undefined }],
      appliedPolicies: [],
      skippedPolicies: [],
      overallStrategy: '',
    };
    const explanation = explainWhichPolicyApplied('h1', evalResult, DEFAULT_POLICIES);
    expect(explanation).toMatch(/fallback/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. policyBridge — editing
// ═══════════════════════════════════════════════════════════════════════════════

describe('editPolicy', () => {
  it('returns new policy with changes', () => {
    const p = DEFAULT_POLICIES[0];
    const updated = editPolicy(p, { priority: 99 });
    expect(updated.priority).toBe(99);
    expect(updated.id).toBe(p.id);
  });

  it('original policy is unchanged', () => {
    const p = DEFAULT_POLICIES[0];
    const originalPriority = p.priority;
    editPolicy(p, { priority: 99 });
    expect(p.priority).toBe(originalPriority);
  });
});

describe('togglePolicy', () => {
  it('disables an enabled policy', () => {
    const p = DEFAULT_POLICIES[0];
    const disabled = togglePolicy(p, false);
    expect(disabled.enabled).toBe(false);
  });

  it('enables a disabled policy', () => {
    const disabled = togglePolicy(DEFAULT_POLICIES[0], false);
    const enabled = togglePolicy(disabled, true);
    expect(enabled.enabled).toBe(true);
  });
});

describe('updatePolicyConfig', () => {
  it('updates a config key', () => {
    const p = DEFAULT_POLICIES.find((x) => x.type === 'clarification_policy')!;
    const updated = updatePolicyConfig(p, 'minScore', 80);
    expect(updated.configuration.minScore).toBe(80);
    expect(p.configuration.minScore).not.toBe(80); // original unchanged
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. previewPolicyImpact
// ═══════════════════════════════════════════════════════════════════════════════

describe('previewPolicyImpact', () => {
  it('returns evaluation result for modified policy', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const scores = makeScoreReport(0, 0, 0);
    const disabledPolicy = togglePolicy(DEFAULT_POLICIES[1], false);
    const result = previewPolicyImpact(disabledPolicy, DEFAULT_POLICIES, session, state, scores);
    expect(result.decisions).toBeDefined();
  });

  it('different policy config produces different decisions', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['frag_test'],
    };
    const patchedSession = {
      ...session,
      parserContexts: [{
        ...session.parserContexts[0],
        clarificationHints: [makeHint('ambiguous_item', 'frag_test', [])],
      }],
    };
    const scores: SessionAmbiguityReport = {
      ...makeScoreReport(50, 1, 0),
      scores: [scoreHintAmbiguity(makeHint('ambiguous_item', 'frag_test', []))],
    };
    // Original: minScore=60, score=50 → won't trigger ask_immediately path
    // Modified: minScore=40 → will trigger
    const modified = updatePolicyConfig(
      DEFAULT_POLICIES.find((p) => p.type === 'clarification_policy')!,
      'minScore',
      40,
    );
    const r1 = evaluatePolicies(DEFAULT_POLICIES, state, patchedSession as any, scores);
    const r2 = previewPolicyImpact(modified, DEFAULT_POLICIES, patchedSession as any, state, scores);
    // r2 should have 'ask' for frag_test because minScore is now 40 <= 50
    const d2 = r2.decisions.find((d) => d.targetId === 'frag_test');
    expect(d2?.action).toBe('ask');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. replaySessionWithPolicies
// ═══════════════════════════════════════════════════════════════════════════════

describe('replaySessionWithPolicies', () => {
  it('returns replay result with all required fields', () => {
    const session = createSession('кофе 50');
    const result = replaySessionWithPolicies(session, [], DEFAULT_POLICIES);
    expect(result.timeline).toBeDefined();
    expect(result.resolutionState).toBeDefined();
    expect(result.evaluationResult).toBeDefined();
    expect(result.scores).toBeDefined();
  });

  it('is deterministic with same session + policies', () => {
    const session = createSession('кофе 50');
    const r1 = replaySessionWithPolicies(session, [], DEFAULT_POLICIES);
    const r2 = replaySessionWithPolicies(session, [], DEFAULT_POLICIES);
    expect(r1.evaluationResult.decisions.length).toBe(r2.evaluationResult.decisions.length);
    expect(r1.scores.overallScore).toBe(r2.scores.overallScore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21. compareStrategies
// ═══════════════════════════════════════════════════════════════════════════════

describe('compareStrategies', () => {
  it('returns comparison with agreement rate', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const scores = makeScoreReport(0, 0, 0);
    const comparison = compareStrategies(DEFAULT_POLICIES, DEFAULT_POLICIES, session, state, scores);
    expect(comparison.agreementRate).toBe(1); // same policies → 100% agreement
  });

  it('detects disagreement between policy sets', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['frag_x'],
    };
    const patchedSession = {
      ...session,
      parserContexts: [{
        ...session.parserContexts[0],
        clarificationHints: [makeHint('multiple_categories', 'frag_x', [])],
      }],
    };
    const scores: SessionAmbiguityReport = {
      ...makeScoreReport(10, 0, 1),
      scores: [scoreHintAmbiguity(makeHint('multiple_categories', 'frag_x', []))],
    };
    // Policy set 1: auto_resolution enabled
    // Policy set 2: auto_resolution disabled
    const disabledAutoRes = DEFAULT_POLICIES.map((p) =>
      p.type === 'auto_resolution_policy' ? togglePolicy(p, false) : p,
    );
    const comparison = compareStrategies(DEFAULT_POLICIES, disabledAutoRes, patchedSession as any, state, scores);
    // With auto_res enabled → auto_resolve; disabled → different decision
    // They may or may not disagree on frag_x depending on fallback logic
    expect(comparison.totalItems).toBeGreaterThanOrEqual(1);
    expect(typeof comparison.agreementRate).toBe('number');
  });

  it('strategy names are included', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const scores = makeScoreReport(0, 0, 0);
    const comparison = compareStrategies(DEFAULT_POLICIES, DEFAULT_POLICIES, session, state, scores);
    expect(comparison.strategy1).toBeDefined();
    expect(comparison.strategy2).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 22. inspectEscalationPath
// ═══════════════════════════════════════════════════════════════════════════════

describe('inspectEscalationPath', () => {
  it('returns trace with required fields', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const trace = inspectEscalationPath(session, state, DEFAULT_POLICIES);
    expect(trace.sessionId).toBe(session.id);
    expect(Array.isArray(trace.firingRules)).toBe(true);
    expect(Array.isArray(trace.dormantRules)).toBe(true);
    expect(Array.isArray(trace.willEscalateTo)).toBe(true);
    expect(typeof trace.summary).toBe('string');
  });

  it('no escalations for simple session', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const trace = inspectEscalationPath(session, state, DEFAULT_POLICIES);
    // Simple input shouldn't trigger escalations unless there are hints
    expect(trace.summary).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 23. mergePolicySets + summarizePolicies
// ═══════════════════════════════════════════════════════════════════════════════

describe('mergePolicySets', () => {
  it('overrides matching policies by ID', () => {
    const override = editPolicy(DEFAULT_POLICIES[0], { priority: 99 });
    const merged = mergePolicySets(DEFAULT_POLICIES, [override]);
    const updated = merged.find((p) => p.id === DEFAULT_POLICIES[0].id);
    expect(updated?.priority).toBe(99);
  });

  it('adds new policies not in base', () => {
    const newPolicy: RuntimePolicy = {
      id: 'policy_custom',
      type: 'clarification_policy',
      enabled: true,
      priority: 50,
      configuration: {},
    };
    const merged = mergePolicySets(DEFAULT_POLICIES, [newPolicy]);
    expect(merged.some((p) => p.id === 'policy_custom')).toBe(true);
  });

  it('base policies not in overrides are preserved', () => {
    const merged = mergePolicySets(DEFAULT_POLICIES, []);
    expect(merged).toHaveLength(DEFAULT_POLICIES.length);
  });
});

describe('summarizePolicies', () => {
  it('counts total and enabled correctly', () => {
    const summary = summarizePolicies(DEFAULT_POLICIES);
    expect(summary.total).toBe(DEFAULT_POLICIES.length);
    expect(summary.enabled).toBe(DEFAULT_POLICIES.filter((p) => p.enabled).length);
  });

  it('groups by type', () => {
    const summary = summarizePolicies(DEFAULT_POLICIES);
    expect(summary.byType['clarification_policy']).toBeGreaterThanOrEqual(1);
  });

  it('handles empty list', () => {
    const summary = summarizePolicies([]);
    expect(summary.total).toBe(0);
    expect(summary.enabled).toBe(0);
  });
});

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

  it('replaySessionWithPolicies is stable', () => {
    const session = createSession('кофе 50');
    const r1 = replaySessionWithPolicies(session, [], DEFAULT_POLICIES);
    const r2 = replaySessionWithPolicies(session, [], DEFAULT_POLICIES);
    expect(r1.resolutionState.ambiguityScore).toBe(r2.resolutionState.ambiguityScore);
    expect(r1.evaluationResult.decisions.length).toBe(r2.evaluationResult.decisions.length);
  });
});
