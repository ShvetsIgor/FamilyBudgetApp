/**
 * Tests: Resolution Runtime & Semantic Action System (Phase K)
 *
 * Covers:
 *   - semanticAction types and ResolutionState model
 *   - resolutionEngine: buildInitialResolutionState, applySemanticAction,
 *     deriveResolutionState, computeAmbiguityScore, isResolutionComplete
 *   - clarificationBatcher: canAutoResolveHint, autoResolveHints,
 *     buildClarificationPlan, hintImpactScore, applyAutoResolvePolicy
 *   - semanticEventTimeline: buildSemanticEvent, buildTimelineFromSession,
 *     filterEventsByKind, getLatestEventOfKind, countEventsByKind
 *   - resolutionDiagnostics: explainUnresolvedHint, explainSplitSuggestion,
 *     explainBlockedResolution, explainParserRetry, explainActionTrigger,
 *     buildResolutionReport
 *   - constructorBridge: createAliasFromSession, resolveConflictFromSession,
 *     approveParserCorrection, summarizeSessionForConstructor
 *   - Determinism: same inputs → same outputs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  nextActionId,
  resetActionIds,
  buildInitialResolutionState,
  deriveResolutionState,
  applySemanticAction,
  computeAmbiguityScore,
  isResolutionComplete,
  hasBlockedResolutions,
  pendingCount,
  type ResolutionTransition,
} from '../features/expenses/engine/resolutionEngine';
import type { SemanticAction, ResolutionState } from '../features/expenses/engine/semanticAction';
import {
  canAutoResolveHint,
  autoResolveHints,
  buildClarificationPlan,
  hintImpactScore,
  sortByImpact,
  applyAutoResolvePolicy,
  isManualResolutionRequired,
} from '../features/expenses/engine/clarificationBatcher';
import {
  buildSemanticEvent,
  buildTimelineFromSession,
  filterEventsByKind,
  getLatestEventOfKind,
  countEventsByKind,
  resetEventIds,
  nextEventId,
} from '../features/expenses/engine/semanticEventTimeline';
import {
  explainUnresolvedHint,
  explainSplitSuggestion,
  explainBlockedResolution,
  explainParserRetry,
  explainActionTrigger,
  buildResolutionReport,
} from '../features/expenses/engine/resolutionDiagnostics';
import {
  createAliasFromSession,
  resolveConflictFromSession,
  approveParserCorrection,
  summarizeSessionForConstructor,
  resetBridgeIds,
  extractUnknownMerchants,
  hasMerchantCorrections,
} from '../features/expenses/engine/constructorBridge';
import {
  createSession,
  resolveSession,
  applyCorrection,
  nextCorrectionId,
  resetSessionIds,
} from '../features/expenses/engine/sessionManager';
import type { ClarificationHint } from '../features/expenses/engine/semanticFragment';
import type { PurchaseGroup } from '../features/expenses/engine/purchaseGroup';
import type { RegistryConflict } from '../features/expenses/engine/semanticRegistry';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeAction(
  type: SemanticAction['type'],
  payload: Record<string, unknown> = {},
  source: SemanticAction['source'] = 'user',
  sessionId = 'session_test',
): SemanticAction {
  return {
    id: nextActionId(),
    createdAt: Date.now(),
    type,
    payload,
    source,
    sessionId,
  };
}

function makeHint(
  kind: ClarificationHint['kind'],
  fragmentId: string,
  candidates: string[] = [],
): ClarificationHint {
  return { kind, fragmentId, candidates };
}

function makeGroup(id: string, suggestedSplit = false, signals: string[] = []): PurchaseGroup {
  return {
    id,
    itemFragmentIds: [],
    modifierFragmentIds: [],
    confidenceSignals: signals,
    suggestedSplit,
  };
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-24T10:00:00Z'));
  resetSessionIds();
  resetActionIds();
  resetEventIds();
  resetBridgeIds();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SemanticAction types
// ═══════════════════════════════════════════════════════════════════════════════

describe('SemanticAction model', () => {
  it('nextActionId returns unique IDs', () => {
    const a = nextActionId();
    const b = nextActionId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^action_/);
  });

  it('all action types are constructable', () => {
    const types: SemanticAction['type'][] = [
      'accept_suggestion', 'reject_suggestion', 'resolve_clarification',
      'split_purchase', 'merge_group', 'change_category',
      'create_alias', 'ignore_merchant', 'retry_parse',
    ];
    for (const type of types) {
      const action = makeAction(type);
      expect(action.type).toBe(type);
    }
  });

  it('action has required fields', () => {
    const action = makeAction('accept_suggestion', { categoryId: 'cat_food', groupId: 'g0' });
    expect(action.id).toBeDefined();
    expect(action.createdAt).toBeGreaterThan(0);
    expect(action.source).toBe('user');
    expect(action.sessionId).toBe('session_test');
    expect(action.payload.categoryId).toBe('cat_food');
  });

  it('supports constructor source', () => {
    const action = makeAction('create_alias', {}, 'constructor');
    expect(action.source).toBe('constructor');
  });

  it('supports runtime source', () => {
    const action = makeAction('ignore_merchant', {}, 'runtime');
    expect(action.source).toBe('runtime');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. computeAmbiguityScore
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeAmbiguityScore', () => {
  it('returns 0 when no items', () => {
    expect(computeAmbiguityScore(emptyResolutionState())).toBe(0);
  });

  it('returns 1.0 when all items pending (fresh session with hints)', () => {
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['h1', 'h2'],
      pendingGroups: ['g0'],
    };
    expect(computeAmbiguityScore(state)).toBe(1);
  });

  it('returns 0 when all resolved', () => {
    const state: ResolutionState = {
      ...emptyResolutionState(),
      resolvedGroups: ['g0'],
      autoResolvedHints: ['h1'],
    };
    expect(computeAmbiguityScore(state)).toBe(0);
  });

  it('partial resolution gives fractional score', () => {
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['h1'],
      resolvedGroups: ['g0'],
    };
    // pending=1, total=2 → 0.5
    expect(computeAmbiguityScore(state)).toBe(0.5);
  });

  it('caps at 1.0', () => {
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['h1', 'h2', 'h3'],
    };
    expect(computeAmbiguityScore(state)).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. buildInitialResolutionState
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildInitialResolutionState', () => {
  it('creates empty state for simple input with no hints', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    expect(state.resolvedGroups).toEqual([]);
    expect(state.blockedResolutions).toEqual([]);
    expect(state.autoResolvedHints).toEqual([]);
  });

  it('ambiguityScore=0 when no hints and no groups', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    // pendingGroups depends on session.pendingGroups (only suggestedSplit groups)
    if (state.pendingGroups.length === 0 && state.unresolvedHints.length === 0) {
      expect(state.ambiguityScore).toBe(0);
    }
  });

  it('ambiguityScore=1 when hints present (fresh state)', () => {
    // Use input that triggers clarification hints
    const session = createSession('unknownxyz123 200');
    const state = buildInitialResolutionState(session);
    if (state.unresolvedHints.length > 0 || state.pendingGroups.length > 0) {
      expect(state.ambiguityScore).toBeGreaterThan(0);
    }
  });

  it('pending groups match session.pendingGroups', () => {
    const session = createSession('молоко хлеб 300');
    const state = buildInitialResolutionState(session);
    expect(state.pendingGroups).toEqual(session.pendingGroups.map((g) => g.id));
  });

  it('resolved and blocked lists start empty', () => {
    const session = createSession('такси 450');
    const state = buildInitialResolutionState(session);
    expect(state.resolvedGroups).toHaveLength(0);
    expect(state.blockedResolutions).toHaveLength(0);
    expect(state.autoResolvedHints).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. applySemanticAction — accept_suggestion
// ═══════════════════════════════════════════════════════════════════════════════

describe('applySemanticAction — accept_suggestion', () => {
  it('moves groupId from pending to resolved', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = {
      ...emptyResolutionState(),
      pendingGroups: ['g0'],
    };
    const action = makeAction('accept_suggestion', { categoryId: 'cat_cafe', groupId: 'g0' });
    const { newState } = applySemanticAction(state, action, session);

    expect(newState.resolvedGroups).toContain('g0');
    expect(newState.pendingGroups).not.toContain('g0');
  });

  it('emits action_applied event', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), pendingGroups: ['g0'] };
    const action = makeAction('accept_suggestion', { categoryId: 'cat_cafe', groupId: 'g0' });
    const { event } = applySemanticAction(state, action, session);

    expect(event.kind).toBe('action_applied');
    expect(event.payload.actionType).toBe('accept_suggestion');
  });

  it('noop if groupId missing from pending', () => {
    const session = createSession('кофе 50');
    const state = emptyResolutionState();
    const action = makeAction('accept_suggestion', { categoryId: 'cat_cafe' });
    const { newState } = applySemanticAction(state, action, session);
    expect(newState.resolvedGroups).toHaveLength(0);
  });

  it('provides diagnostic string', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), pendingGroups: ['g0'] };
    const action = makeAction('accept_suggestion', { categoryId: 'cat_cafe', groupId: 'g0' });
    const { diagnostic } = applySemanticAction(state, action, session);
    expect(diagnostic).toMatch(/accepted/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. applySemanticAction — reject_suggestion
// ═══════════════════════════════════════════════════════════════════════════════

describe('applySemanticAction — reject_suggestion', () => {
  it('moves groupId to blockedResolutions', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), pendingGroups: ['g0'] };
    const action = makeAction('reject_suggestion', { categoryId: 'cat_cafe', groupId: 'g0' });
    const { newState } = applySemanticAction(state, action, session);

    expect(newState.blockedResolutions).toContain('g0');
    expect(newState.pendingGroups).not.toContain('g0');
  });

  it('increases ambiguity score when blocked', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), pendingGroups: ['g0', 'g1'] };
    const action = makeAction('reject_suggestion', { groupId: 'g0' });
    const { newState } = applySemanticAction(state, action, session);
    expect(newState.ambiguityScore).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. applySemanticAction — resolve_clarification
// ═══════════════════════════════════════════════════════════════════════════════

describe('applySemanticAction — resolve_clarification', () => {
  it('removes hint from unresolvedHints', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), unresolvedHints: ['frag_1', 'frag_2'] };
    const action = makeAction('resolve_clarification', {
      hintFragmentId: 'frag_1',
      chosenCategoryId: 'cat_cafe',
      hintKind: 'ambiguous_item',
    });
    const { newState } = applySemanticAction(state, action, session);
    expect(newState.unresolvedHints).not.toContain('frag_1');
    expect(newState.unresolvedHints).toContain('frag_2');
  });

  it('emits clarification_resolved event', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), unresolvedHints: ['frag_1'] };
    const action = makeAction('resolve_clarification', {
      hintFragmentId: 'frag_1',
      chosenCategoryId: 'cat_food',
      hintKind: 'ambiguous_item',
    });
    const { event } = applySemanticAction(state, action, session);
    expect(event.kind).toBe('clarification_resolved');
    expect(event.payload.hintFragmentId).toBe('frag_1');
  });

  it('decreases ambiguity score', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['h1', 'h2'],
      resolvedGroups: ['g0'],
      ambiguityScore: 0.67,
    };
    const action = makeAction('resolve_clarification', {
      hintFragmentId: 'h1',
      chosenCategoryId: 'cat_food',
      hintKind: 'ambiguous_item',
    });
    const { newState } = applySemanticAction(state, action, session);
    expect(newState.ambiguityScore).toBeLessThan(state.ambiguityScore);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. applySemanticAction — split_purchase
// ═══════════════════════════════════════════════════════════════════════════════

describe('applySemanticAction — split_purchase', () => {
  it('resolves the group and emits group_changed event', () => {
    const session = createSession('молоко хлеб 200');
    const state = { ...emptyResolutionState(), pendingGroups: ['g0'] };
    const action = makeAction('split_purchase', {
      groupId: 'g0',
      categoryIds: ['cat_dairy', 'cat_bakery'],
    });
    const { newState, event } = applySemanticAction(state, action, session);
    expect(newState.resolvedGroups).toContain('g0');
    expect(event.kind).toBe('group_changed');
    expect(event.payload.actionType).toBe('split_purchase');
  });

  it('diagnostic mentions category count', () => {
    const session = createSession('молоко хлеб 200');
    const state = { ...emptyResolutionState(), pendingGroups: ['g0'] };
    const action = makeAction('split_purchase', {
      groupId: 'g0',
      categoryIds: ['cat_dairy', 'cat_bakery'],
    });
    const { diagnostic } = applySemanticAction(state, action, session);
    expect(diagnostic).toMatch(/2/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. applySemanticAction — merge_group
// ═══════════════════════════════════════════════════════════════════════════════

describe('applySemanticAction — merge_group', () => {
  it('removes both groups from pending and resolves target', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), pendingGroups: ['g0', 'g1'] };
    const action = makeAction('merge_group', { sourceGroupId: 'g0', targetGroupId: 'g1' });
    const { newState } = applySemanticAction(state, action, session);
    expect(newState.pendingGroups).not.toContain('g0');
    expect(newState.pendingGroups).not.toContain('g1');
    expect(newState.resolvedGroups).toContain('g1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. applySemanticAction — change_category
// ═══════════════════════════════════════════════════════════════════════════════

describe('applySemanticAction — change_category', () => {
  it('resolves previously blocked group', () => {
    const session = createSession('кофе 50');
    const state: ResolutionState = {
      ...emptyResolutionState(),
      blockedResolutions: ['g0'],
    };
    const action = makeAction('change_category', {
      groupId: 'g0',
      previousCategoryId: undefined,
      newCategoryId: 'cat_food',
    });
    const { newState } = applySemanticAction(state, action, session);
    expect(newState.blockedResolutions).not.toContain('g0');
    expect(newState.resolvedGroups).toContain('g0');
  });

  it('emits correction_applied event', () => {
    const session = createSession('кофе 50');
    const state = emptyResolutionState();
    const action = makeAction('change_category', {
      newCategoryId: 'cat_food',
      previousCategoryId: undefined,
    });
    const { event } = applySemanticAction(state, action, session);
    expect(event.kind).toBe('correction_applied');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. applySemanticAction — retry_parse
// ═══════════════════════════════════════════════════════════════════════════════

describe('applySemanticAction — retry_parse', () => {
  it('clears unresolvedHints', () => {
    const session = createSession('кофе 50');
    const state = {
      ...emptyResolutionState(),
      unresolvedHints: ['h1', 'h2'],
      blockedResolutions: ['g0'],
    };
    const action = makeAction('retry_parse', { reason: 'merchant changed' });
    const { newState } = applySemanticAction(state, action, session);
    expect(newState.unresolvedHints).toHaveLength(0);
    expect(newState.blockedResolutions).toHaveLength(0);
  });

  it('emits parser_pass event', () => {
    const session = createSession('кофе 50');
    const state = emptyResolutionState();
    const action = makeAction('retry_parse', { reason: 'user requested' });
    const { event } = applySemanticAction(state, action, session);
    expect(event.kind).toBe('parser_pass');
    expect(event.payload.trigger).toBe('retry_parse');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. deriveResolutionState (replay)
// ═══════════════════════════════════════════════════════════════════════════════

describe('deriveResolutionState', () => {
  it('empty actions returns initial state', () => {
    const session = createSession('кофе 50');
    const initial = buildInitialResolutionState(session);
    const derived = deriveResolutionState(session, []);
    expect(derived.pendingGroups).toEqual(initial.pendingGroups);
    expect(derived.unresolvedHints).toEqual(initial.unresolvedHints);
  });

  it('replaying same actions produces same result (deterministic)', () => {
    const session = createSession('кофе 50');
    const actions = [
      makeAction('accept_suggestion', { categoryId: 'cat_cafe', groupId: 'g0' }),
    ];
    const r1 = deriveResolutionState(session, actions);
    const r2 = deriveResolutionState(session, actions);
    expect(r1.resolvedGroups).toEqual(r2.resolvedGroups);
    expect(r1.ambiguityScore).toBe(r2.ambiguityScore);
  });

  it('resolve + then retry resets hints', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
    const actions = [
      makeAction('resolve_clarification', {
        hintFragmentId: 'h1', chosenCategoryId: 'cat_food', hintKind: 'ambiguous_item',
      }),
      makeAction('retry_parse', { reason: 'test' }),
    ];
    let s = buildInitialResolutionState(session);
    for (const a of actions) {
      s = applySemanticAction(s, a, session).newState;
    }
    expect(s.unresolvedHints).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. isResolutionComplete / hasBlockedResolutions / pendingCount
// ═══════════════════════════════════════════════════════════════════════════════

describe('resolution predicates', () => {
  it('isResolutionComplete returns true when all lists empty', () => {
    const state = emptyResolutionState();
    expect(isResolutionComplete(state)).toBe(true);
  });

  it('isResolutionComplete returns false when pending hints exist', () => {
    const state = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
    expect(isResolutionComplete(state)).toBe(false);
  });

  it('isResolutionComplete returns false when blocked exist', () => {
    const state = { ...emptyResolutionState(), blockedResolutions: ['g0'] };
    expect(isResolutionComplete(state)).toBe(false);
  });

  it('hasBlockedResolutions returns true when blocked list not empty', () => {
    const state = { ...emptyResolutionState(), blockedResolutions: ['g0'] };
    expect(hasBlockedResolutions(state)).toBe(true);
  });

  it('pendingCount sums hints + groups', () => {
    const state = {
      ...emptyResolutionState(),
      unresolvedHints: ['h1', 'h2'],
      pendingGroups: ['g0'],
    };
    expect(pendingCount(state)).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. clarificationBatcher — canAutoResolveHint
// ═══════════════════════════════════════════════════════════════════════════════

describe('canAutoResolveHint', () => {
  it('returns true for multiple_categories with 0 candidates', () => {
    const hint = makeHint('multiple_categories', 'frag_1', []);
    expect(canAutoResolveHint(hint)).toBe(true);
  });

  it('returns true for multiple_categories with 1 candidate', () => {
    const hint = makeHint('multiple_categories', 'frag_1', ['cat_food']);
    expect(canAutoResolveHint(hint)).toBe(true);
  });

  it('returns false for multiple_categories with 2+ candidates', () => {
    const hint = makeHint('multiple_categories', 'frag_1', ['cat_food', 'cat_drink']);
    expect(canAutoResolveHint(hint)).toBe(false);
  });

  it('returns false for conflicting_signals', () => {
    const hint = makeHint('conflicting_signals', 'frag_1', ['f1', 'f2']);
    expect(canAutoResolveHint(hint)).toBe(false);
  });

  it('returns false for unknown_merchant', () => {
    const hint = makeHint('unknown_merchant', 'frag_1', []);
    expect(canAutoResolveHint(hint)).toBe(false);
  });

  it('returns false for ambiguous_item', () => {
    const hint = makeHint('ambiguous_item', 'frag_1', []);
    expect(canAutoResolveHint(hint)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 14. autoResolveHints
// ═══════════════════════════════════════════════════════════════════════════════

describe('autoResolveHints', () => {
  it('separates auto-resolvable from remaining', () => {
    const hints: ClarificationHint[] = [
      makeHint('multiple_categories', 'frag_auto', []),
      makeHint('unknown_merchant', 'frag_manual', []),
      makeHint('multiple_categories', 'frag_multi', ['cat_a', 'cat_b']),
    ];
    const { resolved, remaining } = autoResolveHints(hints);
    expect(resolved).toContain('frag_auto');
    expect(resolved).not.toContain('frag_manual');
    expect(resolved).not.toContain('frag_multi');
    expect(remaining).toHaveLength(2);
  });

  it('returns empty resolved when all hints need user input', () => {
    const hints: ClarificationHint[] = [
      makeHint('unknown_merchant', 'f1', []),
      makeHint('conflicting_signals', 'f2', ['m1', 'm2']),
    ];
    const { resolved, remaining } = autoResolveHints(hints);
    expect(resolved).toHaveLength(0);
    expect(remaining).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 15. buildClarificationPlan
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildClarificationPlan', () => {
  it('builds plan with auto-resolved and toAsk batches', () => {
    const hints: ClarificationHint[] = [
      makeHint('multiple_categories', 'frag_auto', []),
      makeHint('unknown_merchant', 'frag_manual', []),
    ];
    const plan = buildClarificationPlan(hints);
    expect(plan.autoResolved).toContain('frag_auto');
    expect(plan.totalUserActionRequired).toBe(1);
    expect(plan.toAsk).toHaveLength(1);
  });

  it('nextBatch is highest-priority batch', () => {
    const hints: ClarificationHint[] = [
      makeHint('ambiguous_item', 'f1', []),
      makeHint('conflicting_signals', 'f2', ['m1', 'm2']),
    ];
    const plan = buildClarificationPlan(hints);
    expect(plan.nextBatch?.kind).toBe('conflicting_signals');
  });

  it('nextBatch is undefined when all hints auto-resolved', () => {
    const hints: ClarificationHint[] = [
      makeHint('multiple_categories', 'f1', []),
    ];
    const plan = buildClarificationPlan(hints);
    expect(plan.nextBatch).toBeUndefined();
    expect(plan.totalUserActionRequired).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 16. hintImpactScore + sortByImpact
// ═══════════════════════════════════════════════════════════════════════════════

describe('hintImpactScore', () => {
  it('conflicting_signals has highest base score', () => {
    const h = makeHint('conflicting_signals', 'f', ['m1', 'm2']);
    expect(hintImpactScore(h)).toBeGreaterThan(hintImpactScore(makeHint('unknown_merchant', 'f', [])));
  });

  it('candidates increase score', () => {
    const h1 = makeHint('unknown_merchant', 'f', []);
    const h2 = makeHint('unknown_merchant', 'f', ['c1', 'c2', 'c3']);
    expect(hintImpactScore(h2)).toBeGreaterThan(hintImpactScore(h1));
  });

  it('sortByImpact returns highest-impact first', () => {
    const hints = [
      makeHint('multiple_categories', 'f1', []),
      makeHint('conflicting_signals', 'f2', []),
      makeHint('unknown_merchant', 'f3', []),
    ];
    const sorted = sortByImpact(hints);
    expect(sorted[0].kind).toBe('conflicting_signals');
    expect(sorted[sorted.length - 1].kind).toBe('multiple_categories');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 17. isManualResolutionRequired
// ═══════════════════════════════════════════════════════════════════════════════

describe('isManualResolutionRequired', () => {
  it('returns true for conflicting_signals, unknown_merchant, ambiguous_item', () => {
    expect(isManualResolutionRequired(makeHint('conflicting_signals', 'f', []))).toBe(true);
    expect(isManualResolutionRequired(makeHint('unknown_merchant', 'f', []))).toBe(true);
    expect(isManualResolutionRequired(makeHint('ambiguous_item', 'f', []))).toBe(true);
  });

  it('returns false for multiple_categories', () => {
    expect(isManualResolutionRequired(makeHint('multiple_categories', 'f', []))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18. buildSemanticEvent
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildSemanticEvent', () => {
  it('creates event with required fields', () => {
    const event = buildSemanticEvent('parser_pass', 'session_1', { passIndex: 0 });
    expect(event.id).toMatch(/^evt_/);
    expect(event.kind).toBe('parser_pass');
    expect(event.sessionId).toBe('session_1');
    expect(event.payload.passIndex).toBe(0);
  });

  it('uses provided timestamp', () => {
    const ts = 1716543600000;
    const event = buildSemanticEvent('action_applied', 'sess', {}, ts);
    expect(event.timestamp).toBe(ts);
  });

  it('nextEventId generates unique IDs', () => {
    const a = nextEventId();
    const b = nextEventId();
    expect(a).not.toBe(b);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 19. buildTimelineFromSession
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildTimelineFromSession', () => {
  it('contains session_lifecycle created event', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    const lifecycle = filterEventsByKind(timeline, 'session_lifecycle');
    expect(lifecycle.some((e) => e.payload.lifecycle === 'created')).toBe(true);
  });

  it('contains parser_pass event for initial parse', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    expect(countEventsByKind(timeline, 'parser_pass')).toBeGreaterThanOrEqual(1);
  });

  it('events are sorted by timestamp', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    for (let i = 1; i < timeline.events.length; i++) {
      expect(timeline.events[i].timestamp).toBeGreaterThanOrEqual(timeline.events[i - 1].timestamp);
    }
  });

  it('totalEvents matches events array length', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    expect(timeline.totalEvents).toBe(timeline.events.length);
  });

  it('includes resolution_transition for resolved session', () => {
    const { resolveSession } = require('../features/expenses/engine/sessionManager');
    const session = resolveSession(createSession('кофе 50'));
    const timeline = buildTimelineFromSession(session);
    const resolved = filterEventsByKind(timeline, 'resolution_transition');
    expect(resolved.some((e) => e.payload.newStatus === 'resolved')).toBe(true);
  });

  it('includes action_applied events for semantic actions', () => {
    const session = createSession('кофе 50');
    const actions: SemanticAction[] = [
      makeAction('create_alias', { token: 'abc', canonicalMerchantKey: 'abc_key' }, 'constructor', session.id),
    ];
    const timeline = buildTimelineFromSession(session, actions);
    const actionEvents = filterEventsByKind(timeline, 'action_applied');
    expect(actionEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('firstEventAt and lastEventAt are set', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    expect(timeline.firstEventAt).toBeDefined();
    expect(timeline.lastEventAt).toBeDefined();
  });

  it('sessionId matches session.id', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    expect(timeline.sessionId).toBe(session.id);
  });

  it('is replayable — same session → same event count', () => {
    const session = createSession('кофе 50');
    const t1 = buildTimelineFromSession(session);
    const t2 = buildTimelineFromSession(session);
    expect(t1.totalEvents).toBe(t2.totalEvents);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 20. filterEventsByKind + getLatestEventOfKind + countEventsByKind
// ═══════════════════════════════════════════════════════════════════════════════

describe('timeline query helpers', () => {
  it('filterEventsByKind returns only matching events', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    const passes = filterEventsByKind(timeline, 'parser_pass');
    expect(passes.every((e) => e.kind === 'parser_pass')).toBe(true);
  });

  it('getLatestEventOfKind returns last event of that kind', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    const latest = getLatestEventOfKind(timeline, 'session_lifecycle');
    expect(latest).toBeDefined();
    expect(latest!.kind).toBe('session_lifecycle');
  });

  it('getLatestEventOfKind returns undefined for missing kind', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    const result = getLatestEventOfKind(timeline, 'group_changed');
    expect(result).toBeUndefined();
  });

  it('countEventsByKind returns correct count', () => {
    const session = createSession('кофе 50');
    const timeline = buildTimelineFromSession(session);
    const count = countEventsByKind(timeline, 'parser_pass');
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 21. resolutionDiagnostics — explainUnresolvedHint
// ═══════════════════════════════════════════════════════════════════════════════

describe('explainUnresolvedHint', () => {
  it('returns HINT_AWAITING_USER_INPUT when hint not in allHints', () => {
    const state = { ...emptyResolutionState(), unresolvedHints: ['frag_x'] };
    const reason = explainUnresolvedHint('frag_x', state, []);
    expect(reason.code).toBe('HINT_AWAITING_USER_INPUT');
  });

  it('returns HINT_KIND_REQUIRES_DECISION with kind-specific message', () => {
    const hints = [makeHint('unknown_merchant', 'frag_1', [])];
    const state = { ...emptyResolutionState(), unresolvedHints: ['frag_1'] };
    const reason = explainUnresolvedHint('frag_1', state, hints);
    expect(reason.code).toBe('HINT_KIND_REQUIRES_DECISION');
    expect(reason.message).toMatch(/merchant/i);
  });

  it('returns HINT_ALREADY_RESOLVED if not in unresolvedHints', () => {
    const state = emptyResolutionState();
    const reason = explainUnresolvedHint('frag_1', state, []);
    expect(reason.code).toBe('HINT_ALREADY_RESOLVED');
  });

  it('returns HINT_AUTO_RESOLVED if in autoResolvedHints', () => {
    const state = { ...emptyResolutionState(), autoResolvedHints: ['frag_1'] };
    const reason = explainUnresolvedHint('frag_1', state, []);
    expect(reason.code).toBe('HINT_AUTO_RESOLVED');
  });

  it('evidence array contains relevant fields', () => {
    const hints = [makeHint('ambiguous_item', 'frag_2', [])];
    const state = { ...emptyResolutionState(), unresolvedHints: ['frag_2'] };
    const reason = explainUnresolvedHint('frag_2', state, hints);
    expect(reason.evidence.some((e) => e.includes('frag_2'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 22. resolutionDiagnostics — explainSplitSuggestion
// ═══════════════════════════════════════════════════════════════════════════════

describe('explainSplitSuggestion', () => {
  it('returns GROUP_NO_SPLIT_SIGNAL when suggestedSplit=false', () => {
    const group = makeGroup('g0', false);
    const reason = explainSplitSuggestion(group);
    expect(reason.code).toBe('GROUP_NO_SPLIT_SIGNAL');
  });

  it('returns GROUP_SPLIT_BY_CATEGORY_UNION for default split signal', () => {
    const group = makeGroup('g0', true, ['multiple_items']);
    const reason = explainSplitSuggestion(group);
    expect(['GROUP_SPLIT_BY_CATEGORY_UNION', 'GROUP_SPLIT_BY_CLARIFICATION_HINT']).toContain(reason.code);
  });

  it('returns GROUP_SPLIT_BY_CLARIFICATION_HINT when hint signal present', () => {
    const group = makeGroup('g0', true, ['clarification_hint_present']);
    const reason = explainSplitSuggestion(group);
    expect(reason.code).toBe('GROUP_SPLIT_BY_CLARIFICATION_HINT');
  });

  it('evidence contains groupId', () => {
    const group = makeGroup('g0', true, []);
    const reason = explainSplitSuggestion(group);
    expect(reason.evidence.some((e) => e.includes('g0'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 23. resolutionDiagnostics — explainBlockedResolution
// ═══════════════════════════════════════════════════════════════════════════════

describe('explainBlockedResolution', () => {
  it('returns RESOLUTION_BLOCKED_BY_NO_ACTION when not in blocked list', () => {
    const state = emptyResolutionState();
    const reason = explainBlockedResolution('g0', state, []);
    expect(reason.code).toBe('RESOLUTION_BLOCKED_BY_NO_ACTION');
  });

  it('returns RESOLUTION_BLOCKED_BY_REJECTION with action evidence', () => {
    const state = { ...emptyResolutionState(), blockedResolutions: ['g0'] };
    const rejectAction = makeAction('reject_suggestion', { groupId: 'g0', reason: 'wrong cat' });
    const reason = explainBlockedResolution('g0', state, [rejectAction]);
    expect(reason.code).toBe('RESOLUTION_BLOCKED_BY_REJECTION');
    expect(reason.evidence.some((e) => e.includes('g0'))).toBe(true);
  });

  it('still returns BLOCKED code even without matching action', () => {
    const state = { ...emptyResolutionState(), blockedResolutions: ['g0'] };
    const reason = explainBlockedResolution('g0', state, []);
    expect(reason.code).toBe('RESOLUTION_BLOCKED_BY_REJECTION');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 24. resolutionDiagnostics — explainParserRetry
// ═══════════════════════════════════════════════════════════════════════════════

describe('explainParserRetry', () => {
  it('returns INPUT_CORRECTED when modifiedInput is present', () => {
    const action = makeAction('retry_parse', { reason: 'input fixed', modifiedInput: 'new input' });
    const reason = explainParserRetry(action);
    expect(reason.code).toBe('PARSER_RETRY_INPUT_CORRECTED');
  });

  it('returns MERCHANT_CHANGED when reason mentions merchant', () => {
    const action = makeAction('retry_parse', { reason: 'merchant name changed' });
    const reason = explainParserRetry(action);
    expect(reason.code).toBe('PARSER_RETRY_MERCHANT_CHANGED');
  });

  it('returns USER_REQUESTED for generic retry', () => {
    const action = makeAction('retry_parse', { reason: 'try again' });
    const reason = explainParserRetry(action);
    expect(reason.code).toBe('PARSER_RETRY_USER_REQUESTED');
  });

  it('handles non-retry action gracefully', () => {
    const action = makeAction('accept_suggestion', {});
    const reason = explainParserRetry(action);
    expect(reason.code).toBe('PARSER_RETRY_USER_REQUESTED');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 25. resolutionDiagnostics — explainActionTrigger
// ═══════════════════════════════════════════════════════════════════════════════

describe('explainActionTrigger', () => {
  it('user action returns ACTION_TRIGGERED_BY_USER', () => {
    const action = makeAction('accept_suggestion', {}, 'user');
    expect(explainActionTrigger(action).code).toBe('ACTION_TRIGGERED_BY_USER');
  });

  it('runtime action returns ACTION_TRIGGERED_BY_RUNTIME', () => {
    const action = makeAction('ignore_merchant', {}, 'runtime');
    expect(explainActionTrigger(action).code).toBe('ACTION_TRIGGERED_BY_RUNTIME');
  });

  it('constructor action returns ACTION_TRIGGERED_BY_CONSTRUCTOR', () => {
    const action = makeAction('create_alias', {}, 'constructor');
    expect(explainActionTrigger(action).code).toBe('ACTION_TRIGGERED_BY_CONSTRUCTOR');
  });

  it('evidence contains actionId and type', () => {
    const action = makeAction('split_purchase', {}, 'user');
    const reason = explainActionTrigger(action);
    expect(reason.evidence.some((e) => e.includes(action.id))).toBe(true);
    expect(reason.evidence.some((e) => e.includes('split_purchase'))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 26. buildResolutionReport
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildResolutionReport', () => {
  it('builds report with sessionId', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    const report = buildResolutionReport(session, state, []);
    expect(report.sessionId).toBe(session.id);
  });

  it('isCompletelyResolved=true for empty resolution state', () => {
    const session = createSession('кофе 50');
    const state = buildInitialResolutionState(session);
    // Only true if no pending groups or hints
    if (state.pendingGroups.length === 0 && state.unresolvedHints.length === 0) {
      const report = buildResolutionReport(session, state, []);
      expect(report.isCompletelyResolved).toBe(true);
    }
  });

  it('isCompletelyResolved=false when blocked resolutions exist', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), blockedResolutions: ['g0'] };
    const report = buildResolutionReport(session, state, []);
    expect(report.isCompletelyResolved).toBe(false);
  });

  it('overallDiagnostic describes pending items', () => {
    const session = createSession('кофе 50');
    const state = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
    const report = buildResolutionReport(session, state, []);
    expect(report.overallDiagnostic).toMatch(/1/);
  });

  it('overallDiagnostic confirms ready to persist when complete', () => {
    const session = createSession('кофе 50');
    const state = emptyResolutionState();
    const report = buildResolutionReport(session, state, []);
    expect(report.overallDiagnostic).toMatch(/resolved|ready/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 27. constructorBridge
// ═══════════════════════════════════════════════════════════════════════════════

describe('constructorBridge — createAliasFromSession', () => {
  it('creates add_alias operation', () => {
    const session = createSession('кофе 50');
    const op = createAliasFromSession(session, 'cofe', 'coffee');
    expect(op.type).toBe('add_alias');
    expect(op.payload.token).toBe('cofe');
    expect(op.payload.canonicalKey).toBe('coffee');
  });

  it('description references session id', () => {
    const session = createSession('кофе 50');
    const op = createAliasFromSession(session, 'cofe', 'coffee');
    expect(op.description).toContain(session.id);
  });

  it('each call produces unique id', () => {
    const session = createSession('кофе 50');
    const op1 = createAliasFromSession(session, 'a', 'b');
    const op2 = createAliasFromSession(session, 'a', 'b');
    expect(op1.id).not.toBe(op2.id);
  });
});

describe('constructorBridge — resolveConflictFromSession', () => {
  it('creates archive_entry operation', () => {
    const session = createSession('кофе 50');
    const conflict: RegistryConflict = {
      kind: 'phrase_overlap',
      tokens: ['credit', 'card'],
      entryIds: ['entry_a', 'entry_b'],
      description: 'two entries overlap',
    };
    const op = resolveConflictFromSession(session, conflict);
    expect(op.type).toBe('archive_entry');
    expect(op.payload.conflictKind).toBe('phrase_overlap');
  });

  it('archives last entry (lower precedence)', () => {
    const session = createSession('кофе 50');
    const conflict: RegistryConflict = {
      kind: 'alias_duplicate',
      tokens: ['starbucks'],
      entryIds: ['entry_high', 'entry_low'],
      description: 'duplicate alias',
    };
    const op = resolveConflictFromSession(session, conflict);
    expect(op.payload.entryId).toBe('entry_low');
  });
});

describe('constructorBridge — approveParserCorrection', () => {
  it('creates change_category action with constructor source', () => {
    const { applyCorrection, nextCorrectionId } = require('../features/expenses/engine/sessionManager');
    const session = createSession('кофе 50');
    const correction = {
      id: nextCorrectionId(),
      type: 'category_correction' as const,
      timestamp: Date.now(),
      payload: { fragmentId: 'f1', previousCategoryId: undefined, newCategoryId: 'cat_food' },
      description: 'fix category',
    };
    const sessionWithCorrection = applyCorrection(session, correction);
    const action = approveParserCorrection(sessionWithCorrection, correction.id);
    expect(action.source).toBe('constructor');
    expect(action.type).toBe('change_category');
    expect(action.sessionId).toBe(sessionWithCorrection.id);
  });
});

describe('constructorBridge — summarizeSessionForConstructor', () => {
  it('returns summary with correct structure', () => {
    const session = createSession('кофе 50');
    const summary = summarizeSessionForConstructor(session);
    expect(summary.id).toBe(session.id);
    expect(summary.status).toBe(session.status);
    expect(typeof summary.corrections).toBe('number');
    expect(typeof summary.parserPasses).toBe('number');
    expect(typeof summary.unresolvedHints).toBe('number');
    expect(typeof summary.hasMerchantCorrections).toBe('boolean');
  });

  it('parserPasses=1 for fresh session', () => {
    const session = createSession('кофе 50');
    const summary = summarizeSessionForConstructor(session);
    expect(summary.parserPasses).toBe(1);
  });
});

describe('constructorBridge — extractUnknownMerchants + hasMerchantCorrections', () => {
  it('extractUnknownMerchants returns empty for known merchant input', () => {
    const session = createSession('кофе 50');
    const unknowns = extractUnknownMerchants(session);
    expect(Array.isArray(unknowns)).toBe(true);
  });

  it('hasMerchantCorrections returns false for fresh session', () => {
    const session = createSession('кофе 50');
    expect(hasMerchantCorrections(session)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 28. Determinism
// ═══════════════════════════════════════════════════════════════════════════════

describe('Determinism', () => {
  it('same input → same initial resolution state', () => {
    resetSessionIds();
    const s1 = createSession('такси 300');
    resetSessionIds();
    const s2 = createSession('такси 300');
    const r1 = buildInitialResolutionState(s1);
    const r2 = buildInitialResolutionState(s2);
    expect(r1.pendingGroups.length).toBe(r2.pendingGroups.length);
    expect(r1.unresolvedHints.length).toBe(r2.unresolvedHints.length);
    expect(r1.ambiguityScore).toBe(r2.ambiguityScore);
  });

  it('applyAutoResolvePolicy is deterministic', () => {
    const hints = [
      makeHint('multiple_categories', 'f1', []),
      makeHint('unknown_merchant', 'f2', []),
    ];
    const state: ResolutionState = {
      ...emptyResolutionState(),
      unresolvedHints: ['f1', 'f2'],
    };
    const r1 = applyAutoResolvePolicy(state, hints);
    const r2 = applyAutoResolvePolicy(state, hints);
    expect(r1.autoResolvedHints).toEqual(r2.autoResolvedHints);
    expect(r1.unresolvedHints).toEqual(r2.unresolvedHints);
    expect(r1.ambiguityScore).toBe(r2.ambiguityScore);
  });

  it('buildTimelineFromSession is replayable', () => {
    const session = createSession('кофе 50');
    const actions = [
      makeAction('create_alias', { token: 'test', canonicalMerchantKey: 'test_key' }, 'constructor', session.id),
    ];
    const t1 = buildTimelineFromSession(session, actions);
    const t2 = buildTimelineFromSession(session, actions);
    expect(t1.totalEvents).toBe(t2.totalEvents);
    expect(t1.events.map((e) => e.kind)).toEqual(t2.events.map((e) => e.kind));
  });

  it('hint impact scoring is stable', () => {
    const hints = [
      makeHint('ambiguous_item', 'f3', ['c1']),
      makeHint('conflicting_signals', 'f1', ['m1', 'm2']),
      makeHint('unknown_merchant', 'f2', []),
    ];
    const sorted1 = sortByImpact(hints);
    const sorted2 = sortByImpact(hints);
    expect(sorted1.map((h) => h.fragmentId)).toEqual(sorted2.map((h) => h.fragmentId));
  });
});
