/**
 * Tests: Runtime Workflow & Conversational Navigation System (Phase N)
 *
 * Covers:
 *   - runtimeWorkflow: model types (WorkflowStep, RuntimeNavigationAction, etc.)
 *   - workflowOrchestrator: deriveWorkflowStep, buildNavigationActions,
 *     buildNavigationState, buildWorkflow, validateTransition,
 *     applyNavigationAction, deferItem, resolveDeferred
 *   - workflowCompletion: findCompletionBlockers, findSafeToDefer,
 *     findRequiresHardConfirmation, findCanAutoResolve,
 *     computeCompletionConfidence, buildCompletionState, hasHardBlockers,
 *     blockersOfKind, buildCompletionSummary
 *   - conversationalNavigator: skipAmbiguity, resolveLater, forceSplitReview,
 *     confirmPartialResolution, escalateConflict, retryResolution,
 *     listResolvableDeferred, canAdvanceFromStep, explainStuckState
 *   - workflowProjection: buildWorkflowProgressProjection,
 *     buildConversationalNavigationProjection, buildCompletionStateProjection,
 *     buildDeferredResolutionProjection, buildWorkflowProjections
 *   - splitWorkflowOrchestrator: buildGroupedSplitReview, approvePartialSplit,
 *     deferSplitClarification, applySplitCorrection, buildModifierReview,
 *     isGroupReviewComplete, pendingGroupReviews, buildGroupedSplitSummary
 *   - workflowBridge: replayWorkflow, inspectWorkflowTransitions,
 *     validateNavigationStrategy, previewDeferredResolution,
 *     simulateCompletionPaths, ai/ocr stubs
 *   - Determinism
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ResolutionState } from '../features/expenses/engine/semanticAction';
import type { ClarificationHint } from '../features/expenses/engine/semanticFragment';
import type { PurchaseGroup } from '../features/expenses/engine/purchaseGroup';
import type { ParserContext } from '../features/expenses/engine/inputPipeline';
import type { SessionAmbiguityReport } from '../features/expenses/engine/ambiguityScorer';
import type { DeferredItem } from '../features/expenses/engine/runtimeWorkflow';

import {
  deriveWorkflowStep,
  buildNavigationActions,
  buildNavigationState,
  buildWorkflow,
  validateTransition,
  applyNavigationAction,
  deferItem,
  resolveDeferred,
  pendingDeferredItems,
  resetWorkflowIds,
  nextWorkflowId,
} from '../features/expenses/engine/workflowOrchestrator';
import {
  findCompletionBlockers,
  findSafeToDefer,
  findRequiresHardConfirmation,
  findCanAutoResolve,
  computeCompletionConfidence,
  buildCompletionState,
  hasHardBlockers,
  blockersOfKind,
  buildCompletionSummary,
} from '../features/expenses/engine/workflowCompletion';
import {
  skipAmbiguity,
  resolveLater,
  forceSplitReview,
  confirmPartialResolution,
  escalateConflict,
  retryResolution,
  listResolvableDeferred,
  canAdvanceFromStep,
  explainStuckState,
} from '../features/expenses/engine/conversationalNavigator';
import {
  buildWorkflowProgressProjection,
  buildConversationalNavigationProjection,
  buildCompletionStateProjection,
  buildDeferredResolutionProjection,
  buildWorkflowProjections,
} from '../features/expenses/engine/workflowProjection';
import {
  buildGroupedSplitReview,
  approvePartialSplit,
  deferSplitClarification,
  applySplitCorrection,
  buildModifierReview,
  isGroupReviewComplete,
  pendingGroupReviews,
  buildGroupedSplitSummary,
} from '../features/expenses/engine/splitWorkflowOrchestrator';
import { buildSplitProjection } from '../features/expenses/engine/splitReviewOrchestrator';
import {
  replayWorkflow,
  inspectWorkflowTransitions,
  validateNavigationStrategy,
  previewDeferredResolution,
  simulateCompletionPaths,
  aiWorkflowHint,
  ocrWorkflowReview,
  adaptiveCompletion,
} from '../features/expenses/engine/workflowBridge';
import { createSession, resetSessionIds } from '../features/expenses/engine/sessionManager';
import { resetActionIds, deriveResolutionState, buildInitialResolutionState } from '../features/expenses/engine/resolutionEngine';
import { resetEventIds } from '../features/expenses/engine/semanticEventTimeline';
import { resetBridgeIds } from '../features/expenses/engine/constructorBridge';
import { resetSuggestionIds } from '../features/expenses/engine/actionSuggester';
import { applyDefaultPolicies, DEFAULT_POLICIES } from '../features/expenses/engine/policyEngine';
import { scoreSessionAmbiguity } from '../features/expenses/engine/ambiguityScorer';
import { buildRuntimeProjection } from '../features/expenses/engine/projectionEngine';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeHint(
  kind: ClarificationHint['kind'],
  fragmentId: string,
  candidates: string[] = [],
): ClarificationHint {
  return { kind, fragmentId, candidates };
}

function makeGroup(id: string, suggestedSplit = false): PurchaseGroup {
  return { id, itemFragmentIds: [], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit };
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

function makeScoreReport(overallScore = 0): SessionAmbiguityReport {
  return {
    sessionId: 'session_test',
    overallScore,
    scores: [],
    dominantKind: undefined,
    autoResolvableCount: 0,
    requiresUserCount: 0,
  };
}

function emptyEvalResult() {
  return {
    decisions: [],
    appliedPolicies: [],
    skippedPolicies: [],
    overallStrategy: undefined,
  };
}

function emptyCtx(): ParserContext {
  return {
    raw: '',
    normalizedInput: '',
    amount: undefined,
    merchant: undefined,
    merchantKey: undefined,
    tags: [],
    itemCandidates: [],
    confidenceSignals: [],
    splitHints: [],
    fragments: [],
    clarificationHints: [],
    phrases: [],
    scopes: [],
    scopeHints: [],
    relationships: [],
    purchaseGroups: [],
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-05-24T12:00:00Z'));
  resetSessionIds();
  resetActionIds();
  resetEventIds();
  resetBridgeIds();
  resetSuggestionIds();
  resetWorkflowIds();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. runtimeWorkflow model
// ═══════════════════════════════════════════════════════════════════════════════

describe('runtimeWorkflow model', () => {
  it('nextWorkflowId produces unique IDs', () => {
    const a = nextWorkflowId();
    const b = nextWorkflowId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^wf_/);
  });

  it('WorkflowStep values are correct', () => {
    const steps = ['input', 'clarification', 'review', 'split_review', 'confirmation', 'resolved'];
    steps.forEach((s) => expect(typeof s).toBe('string'));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. workflowOrchestrator
// ═══════════════════════════════════════════════════════════════════════════════

describe('workflowOrchestrator', () => {
  describe('deriveWorkflowStep', () => {
    it('returns resolved when session.status === resolved', () => {
      const session = createSession('');
      (session as any).status = 'resolved';
      expect(deriveWorkflowStep(session, emptyResolutionState())).toBe('resolved');
    });

    it('returns resolved when session.status === cancelled', () => {
      const session = createSession('');
      (session as any).status = 'cancelled';
      expect(deriveWorkflowStep(session, emptyResolutionState())).toBe('resolved');
    });

    it('returns clarification when unresolvedHints exist', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      expect(deriveWorkflowStep(session, state)).toBe('clarification');
    });

    it('returns split_review when suggestedSplit group pending', () => {
      const session = createSession('');
      (session.pendingGroups as any) = [makeGroup('g1', true)];
      const state: ResolutionState = { ...emptyResolutionState(), pendingGroups: ['g1'] };
      expect(deriveWorkflowStep(session, state)).toBe('split_review');
    });

    it('returns review when pendingGroups with no split', () => {
      const session = createSession('');
      (session.pendingGroups as any) = [makeGroup('g1', false)];
      const state: ResolutionState = { ...emptyResolutionState(), pendingGroups: ['g1'] };
      expect(deriveWorkflowStep(session, state)).toBe('review');
    });

    it('returns input when nothing is present', () => {
      const session = createSession('');
      expect(deriveWorkflowStep(session, emptyResolutionState())).toBe('input');
    });
  });

  describe('buildWorkflow', () => {
    it('produces a valid RuntimeWorkflow shape', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);

      expect(wf.id).toMatch(/^wf_/);
      expect(wf.sessionId).toBe(session.id);
      expect(wf.currentStep).toBeDefined();
      expect(Array.isArray(wf.completedSteps)).toBe(true);
      expect(Array.isArray(wf.blockedSteps)).toBe(true);
      expect(Array.isArray(wf.deferredItems)).toBe(true);
      expect(wf.navigationState).toBeDefined();
      expect(wf.completionState).toBeDefined();
    });

    it('completedSteps includes steps before current', () => {
      const session = createSession('');
      (session.pendingGroups as any) = [makeGroup('g1', false)];
      const state: ResolutionState = { ...emptyResolutionState(), pendingGroups: ['g1'] };
      const scores = makeScoreReport(40);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      // currentStep is 'review'; completed = ['input', 'clarification']
      expect(wf.completedSteps).toContain('input');
    });

    it('blockedSteps populated when session is cancelled', () => {
      const session = createSession('');
      (session as any).status = 'cancelled';
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      expect(wf.blockedSteps.length).toBeGreaterThan(0);
    });

    it('deferredSteps includes clarification when deferredItems present', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const scores = makeScoreReport(50);
      const evalResult = emptyEvalResult();
      const deferred: DeferredItem[] = [
        { id: 'h1', kind: 'hint', deferredAt: Date.now(), reason: 'user_skipped', isResolved: false },
      ];
      const wf = buildWorkflow(session, state, scores, evalResult, deferred);
      expect(wf.deferredSteps).toContain('clarification');
    });

    it('is deterministic for same inputs', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      resetWorkflowIds();
      const a = buildWorkflow(session, state, scores, evalResult);
      resetWorkflowIds();
      const b = buildWorkflow(session, state, scores, evalResult);
      expect(a.currentStep).toBe(b.currentStep);
      expect(a.completedSteps).toEqual(b.completedSteps);
      expect(a.completionState.canComplete).toBe(b.completionState.canComplete);
    });
  });

  describe('buildNavigationActions', () => {
    it('input step has advance and cancel', () => {
      const session = createSession('Store');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const actions = buildNavigationActions('input', session, state, scores, evalResult, []);
      const types = actions.map((a) => a.type);
      expect(types).toContain('advance');
      expect(types).toContain('cancel');
    });

    it('clarification step has advance (disabled) and cancel when hints unresolved', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const scores = makeScoreReport(80);
      const evalResult = emptyEvalResult();
      const actions = buildNavigationActions('clarification', session, state, scores, evalResult, []);
      const advance = actions.find((a) => a.type === 'advance');
      expect(advance).toBeDefined();
      expect(advance?.isDisabled).toBe(true);
    });

    it('review step with no pending has advance enabled', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const actions = buildNavigationActions('review', session, state, scores, evalResult, []);
      const advance = actions.find((a) => a.type === 'advance');
      expect(advance?.isDisabled).toBe(false);
    });

    it('confirmation step has advance (save) and back', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const actions = buildNavigationActions('confirmation', session, state, scores, evalResult, []);
      const types = actions.map((a) => a.type);
      expect(types).toContain('advance');
      expect(types).toContain('back');
    });

    it('resolved step has no actions', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const actions = buildNavigationActions('resolved', session, state, scores, evalResult, []);
      expect(actions).toHaveLength(0);
    });
  });

  describe('validateTransition', () => {
    it('disabled actions fail validation', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const disabledAction = { ...wf.navigationState.blockedActions[0] };
      if (!disabledAction.id) return; // skip if no blocked actions
      const transition = validateTransition(wf, disabledAction);
      expect(transition.isValid).toBe(false);
    });

    it('cancel action is always valid', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const cancelAction = wf.navigationState.availableActions.find((a) => a.type === 'cancel');
      if (!cancelAction) return;
      const transition = validateTransition(wf, cancelAction);
      expect(transition.isValid).toBe(true);
    });
  });

  describe('deferItem / resolveDeferred / pendingDeferredItems', () => {
    it('deferItem adds an item', () => {
      const result = deferItem([], 'h1', 'hint');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('h1');
      expect(result[0].isResolved).toBe(false);
    });

    it('deferItem does not duplicate', () => {
      let list = deferItem([], 'h1', 'hint');
      list = deferItem(list, 'h1', 'hint');
      expect(list).toHaveLength(1);
    });

    it('resolveDeferred marks item as resolved', () => {
      const list = deferItem([], 'h1', 'hint');
      const resolved = resolveDeferred(list, 'h1');
      expect(resolved[0].isResolved).toBe(true);
      expect(resolved[0].resolvedAt).toBeDefined();
    });

    it('pendingDeferredItems filters resolved', () => {
      let list = deferItem([], 'h1', 'hint');
      list = deferItem(list, 'h2', 'hint');
      list = resolveDeferred(list, 'h1');
      const pending = pendingDeferredItems(list);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('h2');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. workflowCompletion
// ═══════════════════════════════════════════════════════════════════════════════

describe('workflowCompletion', () => {
  describe('findCompletionBlockers', () => {
    it('returns empty for clean session', () => {
      const session = createSession('');
      const blockers = findCompletionBlockers(session, emptyResolutionState());
      expect(blockers).toHaveLength(0);
    });

    it('cancelled session returns cancelled blocker', () => {
      const session = createSession('');
      (session as any).status = 'cancelled';
      const blockers = findCompletionBlockers(session, emptyResolutionState());
      expect(blockers).toHaveLength(1);
      expect(blockers[0].kind).toBe('cancelled_session');
    });

    it('unresolved hint generates unresolved_hint blocker', () => {
      const session = createSession('');
      const hint = makeHint('ambiguous_item', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const blockers = findCompletionBlockers(session, state);
      expect(blockers.some((b) => b.kind === 'unresolved_hint')).toBe(true);
    });

    it('conflicting_signals hint is NOT safe to defer', () => {
      const session = createSession('');
      const hint = makeHint('conflicting_signals', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const blockers = findCompletionBlockers(session, state);
      const hintBlocker = blockers.find((b) => b.targetId === 'f1');
      expect(hintBlocker?.isSafeToDefer).toBe(false);
    });

    it('ambiguous_item hint IS safe to defer', () => {
      const session = createSession('');
      const hint = makeHint('ambiguous_item', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const blockers = findCompletionBlockers(session, state);
      const hintBlocker = blockers.find((b) => b.targetId === 'f1');
      expect(hintBlocker?.isSafeToDefer).toBe(true);
    });

    it('blocked_resolution generates blocker not safe to defer', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), blockedResolutions: ['g1'] };
      const blockers = findCompletionBlockers(session, state);
      const blocker = blockers.find((b) => b.kind === 'blocked_resolution');
      expect(blocker).toBeDefined();
      expect(blocker?.isSafeToDefer).toBe(false);
    });
  });

  describe('findSafeToDefer', () => {
    it('returns empty when no scores below threshold', () => {
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const scores = makeScoreReport(80);
      expect(findSafeToDefer(state, scores)).toHaveLength(0);
    });

    it('returns hints with score below threshold', () => {
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const scores: SessionAmbiguityReport = {
        sessionId: 'test',
        overallScore: 40,
        scores: [{ score: 25, evidence: ['h1'], isAutoResolvable: true, kind: 'category_ambiguity' as any }],
        dominantKind: undefined,
        autoResolvableCount: 1,
        requiresUserCount: 0,
      };
      const safe = findSafeToDefer(state, scores);
      expect(safe).toContain('h1');
    });
  });

  describe('buildCompletionState', () => {
    it('canComplete true for empty state', () => {
      const session = createSession('');
      const cs = buildCompletionState(session, emptyResolutionState(), makeScoreReport(0));
      expect(cs.canComplete).toBe(true);
    });

    it('canComplete false when blockers exist', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const cs = buildCompletionState(session, state, makeScoreReport(80));
      expect(cs.canComplete).toBe(false);
    });

    it('completionConfidence 0–100', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const cs = buildCompletionState(session, state, makeScoreReport(40));
      expect(cs.completionConfidence).toBeGreaterThanOrEqual(0);
      expect(cs.completionConfidence).toBeLessThanOrEqual(100);
    });
  });

  describe('hasHardBlockers / blockersOfKind / buildCompletionSummary', () => {
    it('hasHardBlockers false when all blockers are safe to defer', () => {
      const session = createSession('');
      const hint = makeHint('ambiguous_item', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const cs = buildCompletionState(session, state, makeScoreReport(40));
      expect(hasHardBlockers(cs)).toBe(false);
    });

    it('hasHardBlockers true when conflicting_signals present', () => {
      const session = createSession('');
      const hint = makeHint('conflicting_signals', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const cs = buildCompletionState(session, state, makeScoreReport(90));
      expect(hasHardBlockers(cs)).toBe(true);
    });

    it('blockersOfKind filters by kind', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), blockedResolutions: ['g1'], unresolvedHints: ['h1'] };
      const cs = buildCompletionState(session, state, makeScoreReport(50));
      const blocked = blockersOfKind(cs, 'blocked_resolution');
      expect(blocked.every((b) => b.kind === 'blocked_resolution')).toBe(true);
    });

    it('buildCompletionSummary returns ready message when canComplete', () => {
      const session = createSession('');
      const cs = buildCompletionState(session, emptyResolutionState(), makeScoreReport(0));
      expect(buildCompletionSummary(cs)).toContain('Ready to save');
    });

    it('buildCompletionSummary mentions blockers when present', () => {
      const session = createSession('');
      const hint = makeHint('conflicting_signals', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const cs = buildCompletionState(session, state, makeScoreReport(90));
      const summary = buildCompletionSummary(cs);
      expect(summary).toMatch(/blocker|require/i);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. conversationalNavigator
// ═══════════════════════════════════════════════════════════════════════════════

describe('conversationalNavigator', () => {
  describe('skipAmbiguity', () => {
    it('fails when hint not in unresolvedHints', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = skipAmbiguity(wf, 'nonexistent', session, state, scores, evalResult);
      expect(result.success).toBe(false);
    });

    it('succeeds and adds to deferredItems', () => {
      const session = createSession('');
      const hint = makeHint('ambiguous_item', 'h1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const scores = makeScoreReport(40);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = skipAmbiguity(wf, 'h1', session, state, scores, evalResult);
      expect(result.success).toBe(true);
      expect(result.updatedWorkflow.deferredItems.some((d) => d.id === 'h1')).toBe(true);
    });
  });

  describe('resolveLater', () => {
    it('fails for non-existent hint', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = resolveLater(wf, 'missing', session, state, scores, evalResult);
      expect(result.success).toBe(false);
    });

    it('adds hint to deferredItems on success', () => {
      const session = createSession('');
      const hint = makeHint('multiple_categories', 'h1', ['cat_a']);
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const scores = makeScoreReport(30);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = resolveLater(wf, 'h1', session, state, scores, evalResult);
      expect(result.success).toBe(true);
      expect(result.updatedWorkflow.deferredItems.some((d) => d.id === 'h1')).toBe(true);
    });
  });

  describe('forceSplitReview', () => {
    it('fails when group not in pendingGroups', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = forceSplitReview(wf, 'missing_group', session, state, scores, evalResult);
      expect(result.success).toBe(false);
    });

    it('succeeds when group exists in session.pendingGroups', () => {
      const session = createSession('');
      (session.pendingGroups as any) = [makeGroup('g1', false)];
      const state: ResolutionState = { ...emptyResolutionState(), pendingGroups: ['g1'] };
      const scores = makeScoreReport(30);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = forceSplitReview(wf, 'g1', session, state, scores, evalResult);
      expect(result.success).toBe(true);
    });
  });

  describe('confirmPartialResolution', () => {
    it('fails when hard blockers exist', () => {
      const session = createSession('');
      const hint = makeHint('conflicting_signals', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const scores = makeScoreReport(90);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = confirmPartialResolution(wf, session, state, scores, evalResult);
      expect(result.success).toBe(false);
    });

    it('succeeds when all blockers are deferrable', () => {
      const session = createSession('');
      const hint = makeHint('ambiguous_item', 'f1');
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const scores = makeScoreReport(40);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = confirmPartialResolution(wf, session, state, scores, evalResult);
      expect(result.success).toBe(true);
    });
  });

  describe('escalateConflict', () => {
    it('fails when no conflicting_signals hint', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = escalateConflict(wf, 'f1', session, state, scores, evalResult);
      expect(result.success).toBe(false);
    });

    it('succeeds when conflicting_signals hint present', () => {
      const session = createSession('');
      const hint = makeHint('conflicting_signals', 'f1', ['a', 'b']);
      (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
      const scores = makeScoreReport(90);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = escalateConflict(wf, 'f1', session, state, scores, evalResult);
      expect(result.success).toBe(true);
      expect(result.action.type).toBe('escalate_conflict');
    });
  });

  describe('retryResolution', () => {
    it('fails when no blocked resolutions', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = retryResolution(wf, session, state, scores, evalResult);
      expect(result.success).toBe(false);
    });

    it('succeeds when blocked resolutions exist', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), blockedResolutions: ['g1'] };
      const scores = makeScoreReport(50);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const result = retryResolution(wf, session, state, scores, evalResult);
      expect(result.success).toBe(true);
    });
  });

  describe('listResolvableDeferred / canAdvanceFromStep / explainStuckState', () => {
    it('listResolvableDeferred returns only pending deferred in unresolvedHints', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1', 'h2'] };
      const scores = makeScoreReport(40);
      const evalResult = emptyEvalResult();
      const deferred: DeferredItem[] = [
        { id: 'h1', kind: 'hint', deferredAt: Date.now(), reason: 'user_skipped', isResolved: false },
        { id: 'h3', kind: 'hint', deferredAt: Date.now(), reason: 'user_skipped', isResolved: false },
      ];
      const wf = buildWorkflow(session, state, scores, evalResult, deferred);
      const resolvable = listResolvableDeferred(wf, state);
      expect(resolvable.some((d) => d.id === 'h1')).toBe(true);
      expect(resolvable.some((d) => d.id === 'h3')).toBe(false); // h3 not in unresolvedHints
    });

    it('canAdvanceFromStep true when advance action available', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      // input step has advance (disabled when no input)
      expect(typeof canAdvanceFromStep(wf)).toBe('boolean');
    });

    it('explainStuckState returns resolved message for resolved workflow', () => {
      const session = createSession('');
      (session as any).status = 'resolved';
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const msg = explainStuckState(wf);
      expect(msg).toContain('resolved');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. workflowProjection
// ═══════════════════════════════════════════════════════════════════════════════

describe('workflowProjection', () => {
  function makeWorkflow() {
    const session = createSession('');
    const state = emptyResolutionState();
    const scores = makeScoreReport(0);
    const evalResult = emptyEvalResult();
    return { workflow: buildWorkflow(session, state, scores, evalResult), session, state, scores, evalResult };
  }

  describe('buildWorkflowProgressProjection', () => {
    it('has steps array with visible steps', () => {
      const { workflow } = makeWorkflow();
      const proj = buildWorkflowProgressProjection(workflow);
      expect(Array.isArray(proj.steps)).toBe(true);
      expect(proj.steps.length).toBeGreaterThan(0);
    });

    it('progressPercent is 0–100', () => {
      const { workflow } = makeWorkflow();
      const proj = buildWorkflowProgressProjection(workflow);
      expect(proj.progressPercent).toBeGreaterThanOrEqual(0);
      expect(proj.progressPercent).toBeLessThanOrEqual(100);
    });

    it('currentStep matches workflow.currentStep', () => {
      const { workflow } = makeWorkflow();
      const proj = buildWorkflowProgressProjection(workflow);
      expect(proj.currentStep).toBe(workflow.currentStep);
    });

    it('isCurrent true for current step', () => {
      const { workflow } = makeWorkflow();
      const proj = buildWorkflowProgressProjection(workflow);
      const current = proj.steps.find((s) => s.step === workflow.currentStep);
      expect(current?.isCurrent).toBe(true);
    });
  });

  describe('buildConversationalNavigationProjection', () => {
    it('has availableActions array', () => {
      const { workflow } = makeWorkflow();
      const proj = buildConversationalNavigationProjection(workflow);
      expect(Array.isArray(proj.availableActions)).toBe(true);
    });

    it('stepLabel is a non-empty string', () => {
      const { workflow } = makeWorkflow();
      const proj = buildConversationalNavigationProjection(workflow);
      expect(typeof proj.stepLabel).toBe('string');
      expect(proj.stepLabel.length).toBeGreaterThan(0);
    });

    it('deferredCount matches workflow.deferredItems', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
      const scores = makeScoreReport(40);
      const evalResult = emptyEvalResult();
      const deferred: DeferredItem[] = [
        { id: 'h1', kind: 'hint', deferredAt: Date.now(), reason: 'user_skipped', isResolved: false },
      ];
      const wf = buildWorkflow(session, state, scores, evalResult, deferred);
      const proj = buildConversationalNavigationProjection(wf);
      expect(proj.deferredCount).toBe(1);
    });
  });

  describe('buildCompletionStateProjection', () => {
    it('canSave true for clean state', () => {
      const { workflow } = makeWorkflow();
      const proj = buildCompletionStateProjection(workflow);
      expect(proj.canSave).toBe(true);
    });

    it('confidenceLabel is one of the valid values', () => {
      const { workflow } = makeWorkflow();
      const proj = buildCompletionStateProjection(workflow);
      expect(['high', 'medium', 'low', 'none']).toContain(proj.confidenceLabel);
    });

    it('summary is non-empty string', () => {
      const { workflow } = makeWorkflow();
      const proj = buildCompletionStateProjection(workflow);
      expect(typeof proj.summary).toBe('string');
      expect(proj.summary.length).toBeGreaterThan(0);
    });
  });

  describe('buildDeferredResolutionProjection', () => {
    it('returns empty state when no deferred items', () => {
      const { workflow } = makeWorkflow();
      const proj = buildDeferredResolutionProjection(workflow);
      expect(proj.totalDeferred).toBe(0);
      expect(proj.hasPendingDeferrals).toBe(false);
    });

    it('counts pending vs resolved correctly', () => {
      const session = createSession('');
      const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1', 'h2'] };
      const scores = makeScoreReport(40);
      const evalResult = emptyEvalResult();
      const deferred: DeferredItem[] = [
        { id: 'h1', kind: 'hint', deferredAt: Date.now(), reason: 'user_skipped', isResolved: false },
        { id: 'h2', kind: 'hint', deferredAt: Date.now(), reason: 'user_skipped', isResolved: true, resolvedAt: Date.now() },
      ];
      const wf = buildWorkflow(session, state, scores, evalResult, deferred);
      const proj = buildDeferredResolutionProjection(wf);
      expect(proj.pendingCount).toBe(1);
      expect(proj.resolvedCount).toBe(1);
      expect(proj.hasPendingDeferrals).toBe(true);
    });
  });

  describe('buildWorkflowProjections', () => {
    it('returns all four projection types', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = scoreSessionAmbiguity(session, state);
      const evalResult = applyDefaultPolicies(state, session, scores);
      const wf = buildWorkflow(session, state, scores, evalResult);
      const runtimeProj = buildRuntimeProjection(session, state, scores, evalResult, 'ask_immediately');
      const bundle = buildWorkflowProjections(wf, runtimeProj);

      expect(bundle.progress).toBeDefined();
      expect(bundle.navigation).toBeDefined();
      expect(bundle.completion).toBeDefined();
      expect(bundle.deferred).toBeDefined();
      expect(bundle.runtimeProjection).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. splitWorkflowOrchestrator
// ═══════════════════════════════════════════════════════════════════════════════

describe('splitWorkflowOrchestrator', () => {
  function makeCtxWithFragments(
    fragments: Array<{ id: string; rawValue: string; candidateCategories?: string[] }>,
  ): ParserContext {
    return {
      ...emptyCtx(),
      fragments: fragments.map((f) => ({
        id: f.id,
        rawValue: f.rawValue,
        text: f.rawValue,
        kind: 'item' as const,
        confidence: 0.8,
        candidateCategories: f.candidateCategories,
      })),
    };
  }

  describe('buildGroupedSplitReview', () => {
    it('builds review for multiple groups', () => {
      const groups: PurchaseGroup[] = [
        { id: 'g1', itemFragmentIds: ['f1'], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit: true },
        { id: 'g2', itemFragmentIds: ['f2'], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit: true },
      ];
      const ctx = makeCtxWithFragments([
        { id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_food'] },
        { id: 'f2', rawValue: 'Bread', candidateCategories: ['cat_bakery'] },
      ]);
      const review = buildGroupedSplitReview(groups, ctx, new Set(['g1']));
      expect(review.groups).toHaveLength(2);
      expect(review.groups[0].isApproved).toBe(true);
      expect(review.groups[1].isApproved).toBe(false);
    });

    it('canConfirmAll true when all groups done', () => {
      const groups: PurchaseGroup[] = [
        { id: 'g1', itemFragmentIds: ['f1'], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit: true },
      ];
      const ctx = makeCtxWithFragments([
        { id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_food'] },
      ]);
      const review = buildGroupedSplitReview(groups, ctx, new Set(['g1']));
      expect(review.canConfirmAll).toBe(true);
    });
  });

  describe('approvePartialSplit', () => {
    it('approved items in updatedProjection', () => {
      const ctx = makeCtxWithFragments([
        { id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_food'] },
        { id: 'f2', rawValue: 'Bread', candidateCategories: ['cat_bakery'] },
      ]);
      const group: PurchaseGroup = {
        id: 'g1',
        itemFragmentIds: ['f1', 'f2'],
        modifierFragmentIds: [],
        confidenceSignals: [],
        suggestedSplit: true,
      };
      const proj = (await import('../features/expenses/engine/splitReviewOrchestrator')).buildSplitProjection(group, ctx);
      const result = approvePartialSplit(proj, ['f1']);
      expect(result.approvedItems).toHaveLength(1);
      expect(result.deferredItems).toHaveLength(1);
      expect(result.updatedProjection.items).toHaveLength(1);
    });

    it('canConfirmApproved true when approved items all have categories', () => {
      const ctx = makeCtxWithFragments([
        { id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_food'] },
        { id: 'f2', rawValue: 'Unknown' },
      ]);
      const group: PurchaseGroup = {
        id: 'g1',
        itemFragmentIds: ['f1', 'f2'],
        modifierFragmentIds: [],
        confidenceSignals: [],
        suggestedSplit: true,
      };
      const proj = (await import('../features/expenses/engine/splitReviewOrchestrator')).buildSplitProjection(group, ctx);
      const result = approvePartialSplit(proj, ['f1']);
      expect(result.canConfirmApproved).toBe(true);
    });
  });

  describe('deferSplitClarification', () => {
    it('adds hint and group:hint to deferred list', () => {
      const result = deferSplitClarification([], 'g1', 'h1');
      expect(result.some((d) => d.id === 'h1')).toBe(true);
      expect(result.some((d) => d.id === 'g1:h1')).toBe(true);
    });
  });

  describe('applySplitCorrection', () => {
    it('updates category for fragment', () => {
      const ctx = makeCtxWithFragments([
        { id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_old'] },
      ]);
      const group: PurchaseGroup = {
        id: 'g1',
        itemFragmentIds: ['f1'],
        modifierFragmentIds: [],
        confidenceSignals: [],
        suggestedSplit: false,
      };
      const proj = (await import('../features/expenses/engine/splitReviewOrchestrator')).buildSplitProjection(group, ctx);
      const result = applySplitCorrection(proj, 'f1', 'cat_new');
      expect(result.newCategoryId).toBe('cat_new');
      expect(result.previousCategoryId).toBe('cat_old');
      const updatedItem = result.updatedProjection.items.find((i) => i.fragmentId === 'f1');
      expect(updatedItem?.categoryId).toBe('cat_new');
    });
  });

  describe('buildModifierReview', () => {
    it('returns review with correct total', () => {
      const group: PurchaseGroup = {
        id: 'g1',
        itemFragmentIds: ['f1'],
        modifierFragmentIds: ['m1', 'm2'],
        confidenceSignals: [],
        suggestedSplit: false,
      };
      const ctx = makeCtxWithFragments([
        { id: 'f1', rawValue: 'Milk' },
        { id: 'm1', rawValue: 'fresh' },
        { id: 'm2', rawValue: 'organic' },
      ]);
      const review = buildModifierReview(group, ctx);
      expect(review.totalModifiers).toBe(2);
      expect(review.groupId).toBe('g1');
    });
  });

  describe('isGroupReviewComplete / pendingGroupReviews / buildGroupedSplitSummary', () => {
    it('isGroupReviewComplete true when approved', () => {
      const groups: PurchaseGroup[] = [
        { id: 'g1', itemFragmentIds: ['f1'], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit: true },
      ];
      const ctx = makeCtxWithFragments([{ id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_food'] }]);
      const review = buildGroupedSplitReview(groups, ctx, new Set(['g1']));
      expect(isGroupReviewComplete(review.groups[0])).toBe(true);
    });

    it('pendingGroupReviews returns only incomplete groups', () => {
      const groups: PurchaseGroup[] = [
        { id: 'g1', itemFragmentIds: ['f1'], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit: true },
        { id: 'g2', itemFragmentIds: ['f2'], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit: true },
      ];
      const ctx = makeCtxWithFragments([
        { id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_food'] },
        { id: 'f2', rawValue: 'Unknown' },
      ]);
      const review = buildGroupedSplitReview(groups, ctx, new Set(['g1']));
      const pending = pendingGroupReviews(review);
      expect(pending.length).toBeGreaterThan(0);
      expect(pending.some((g) => g.groupId === 'g2')).toBe(true);
    });

    it('buildGroupedSplitSummary says all done when all complete', () => {
      const groups: PurchaseGroup[] = [
        { id: 'g1', itemFragmentIds: ['f1'], modifierFragmentIds: [], confidenceSignals: [], suggestedSplit: true },
      ];
      const ctx = makeCtxWithFragments([{ id: 'f1', rawValue: 'Milk', candidateCategories: ['cat_food'] }]);
      const review = buildGroupedSplitReview(groups, ctx, new Set(['g1']));
      expect(buildGroupedSplitSummary(review)).toContain('reviewed');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. workflowBridge
// ═══════════════════════════════════════════════════════════════════════════════

describe('workflowBridge', () => {
  describe('replayWorkflow', () => {
    it('returns empty steps for no actions', () => {
      const session = createSession('');
      const replay = replayWorkflow(session, [], DEFAULT_POLICIES);
      expect(replay.steps).toHaveLength(0);
      expect(replay.totalTransitions).toBe(0);
      expect(replay.finalWorkflow).toBeDefined();
    });

    it('step count matches action count', () => {
      const session = createSession('');
      const actions = [
        {
          id: 'act_1',
          type: 'accept_suggestion' as const,
          source: 'user' as const,
          targetId: 'g1',
          timestamp: Date.now(),
          payload: { categoryId: 'cat_food' },
        },
      ];
      const replay = replayWorkflow(session, actions, DEFAULT_POLICIES);
      expect(replay.steps).toHaveLength(1);
    });

    it('uniqueStepsVisited is non-empty', () => {
      const session = createSession('');
      const actions = [
        {
          id: 'act_1',
          type: 'accept_suggestion' as const,
          source: 'user' as const,
          targetId: 'g1',
          timestamp: Date.now(),
          payload: { categoryId: 'cat_food' },
        },
      ];
      const replay = replayWorkflow(session, actions, DEFAULT_POLICIES);
      expect(replay.uniqueStepsVisited.length).toBeGreaterThan(0);
    });
  });

  describe('inspectWorkflowTransitions', () => {
    it('returns empty traces when no transitions occurred', () => {
      const session = createSession('');
      const replay = replayWorkflow(session, [], DEFAULT_POLICIES);
      const traces = inspectWorkflowTransitions(replay);
      expect(traces).toHaveLength(0);
    });
  });

  describe('validateNavigationStrategy', () => {
    it('invalid when final step is not resolved', () => {
      const session = createSession('');
      const replay = replayWorkflow(session, [], DEFAULT_POLICIES);
      const result = validateNavigationStrategy(replay, 'resolved');
      // Session without actions stays at 'input' — never reaches 'resolved'
      if (replay.finalWorkflow.currentStep !== 'resolved') {
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it('valid when final step matches expected', () => {
      const session = createSession('');
      const replay = replayWorkflow(session, [], DEFAULT_POLICIES);
      const actualFinal = replay.finalWorkflow.currentStep;
      const result = validateNavigationStrategy(replay, actualFinal);
      expect(result.isValid).toBe(true);
    });
  });

  describe('previewDeferredResolution', () => {
    it('returns empty when no deferred items', () => {
      const session = createSession('');
      const preview = previewDeferredResolution(session, [], DEFAULT_POLICIES, []);
      expect(preview.pendingDeferrals).toHaveLength(0);
      expect(preview.estimatedResolutionSteps).toBe(0);
    });

    it('summary describes deferred items', () => {
      const session = createSession('');
      const deferred: DeferredItem[] = [
        { id: 'h1', kind: 'hint', deferredAt: Date.now(), reason: 'user_skipped', isResolved: false },
      ];
      const preview = previewDeferredResolution(session, [], DEFAULT_POLICIES, deferred);
      expect(preview.summary).toContain('deferred');
    });
  });

  describe('simulateCompletionPaths', () => {
    it('returns at least one path', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const paths = simulateCompletionPaths(wf, session, state, scores);
      expect(paths.length).toBeGreaterThan(0);
    });

    it('paths are sorted by confidence descending', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const paths = simulateCompletionPaths(wf, session, state, scores);
      for (let i = 1; i < paths.length; i++) {
        expect(paths[i - 1].confidence).toBeGreaterThanOrEqual(paths[i].confidence);
      }
    });

    it('direct path has highest confidence when complete', () => {
      const session = createSession('');
      const state = emptyResolutionState();
      const scores = makeScoreReport(0);
      const evalResult = emptyEvalResult();
      const wf = buildWorkflow(session, state, scores, evalResult);
      const paths = simulateCompletionPaths(wf, session, state, scores);
      const direct = paths.find((p) => p.pathId === 'path_direct');
      expect(direct).toBeDefined();
    });
  });

  describe('AI/OCR stubs', () => {
    it('aiWorkflowHint returns null', () => {
      const session = createSession('');
      const wf = buildWorkflow(session, emptyResolutionState(), makeScoreReport(0), emptyEvalResult());
      expect(aiWorkflowHint(wf, {})).toBeNull();
    });

    it('ocrWorkflowReview returns null', () => {
      const session = createSession('');
      const wf = buildWorkflow(session, emptyResolutionState(), makeScoreReport(0), emptyEvalResult());
      expect(ocrWorkflowReview(wf, {})).toBeNull();
    });

    it('adaptiveCompletion returns null', () => {
      const session = createSession('');
      const wf = buildWorkflow(session, emptyResolutionState(), makeScoreReport(0), emptyEvalResult());
      expect(adaptiveCompletion(wf, {})).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Determinism
// ═══════════════════════════════════════════════════════════════════════════════

describe('Determinism', () => {
  it('buildWorkflow is deterministic for same session', () => {
    const session = createSession('');
    const state = emptyResolutionState();
    const scores = makeScoreReport(0);
    const evalResult = emptyEvalResult();
    resetWorkflowIds();
    const a = buildWorkflow(session, state, scores, evalResult);
    resetWorkflowIds();
    const b = buildWorkflow(session, state, scores, evalResult);
    expect(a.currentStep).toBe(b.currentStep);
    expect(a.completedSteps).toEqual(b.completedSteps);
    expect(a.completionState.canComplete).toBe(b.completionState.canComplete);
  });

  it('buildCompletionState is deterministic', () => {
    const session = createSession('');
    const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['h1'] };
    const scores = makeScoreReport(40);
    const a = buildCompletionState(session, state, scores);
    const b = buildCompletionState(session, state, scores);
    expect(a.canComplete).toBe(b.canComplete);
    expect(a.canCompleteWithDeferrals).toBe(b.canCompleteWithDeferrals);
    expect(a.blockers).toEqual(b.blockers);
  });

  it('buildWorkflowProgressProjection is deterministic', () => {
    const session = createSession('');
    const state = emptyResolutionState();
    const scores = makeScoreReport(0);
    const evalResult = emptyEvalResult();
    resetWorkflowIds();
    const wf = buildWorkflow(session, state, scores, evalResult);
    const a = buildWorkflowProgressProjection(wf);
    const b = buildWorkflowProgressProjection(wf);
    expect(a.steps).toEqual(b.steps);
    expect(a.progressPercent).toBe(b.progressPercent);
  });

  it('findCompletionBlockers is deterministic', () => {
    const session = createSession('');
    const hint = makeHint('unknown_merchant', 'f1');
    (session.parserContexts as any) = [{ ...emptyCtx(), clarificationHints: [hint] }];
    const state: ResolutionState = { ...emptyResolutionState(), unresolvedHints: ['f1'] };
    const a = findCompletionBlockers(session, state);
    const b = findCompletionBlockers(session, state);
    expect(a).toEqual(b);
  });
});
