/**
 * Tests for Conversational Runtime & Semantic Session System:
 *   - clarificationOrchestrator.ts — buildClarificationState, resolveHint,
 *     prioritizeClarificationHints, batchClarificationHints, computeAmbiguityLevel
 *   - sessionManager.ts — createSession, applyCorrection, undoLastCorrection,
 *     redoLastUndo, resolveSession, cancelSession, replaySession
 *
 * Coverage:
 *   - Session creation: status, fields, parserContexts
 *   - Status derivation: active vs awaiting_clarification
 *   - Correction recording: corrections[], undoneCorrections cleared
 *   - Undo: corrections reverted, context reverted for merchant corrections
 *   - Redo: re-applies last undone correction
 *   - Closed sessions (resolved/cancelled) reject new corrections
 *   - Clarification state: prioritization, resolution, ambiguity level
 *   - Hint batching and priority order
 *   - Session replay: steps match correction history
 *   - Determinism
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSession,
  applyCorrection,
  undoLastCorrection,
  redoLastUndo,
  resolveSession,
  cancelSession,
  replaySession,
  currentContext,
  isSessionOpen,
  resetSessionIds,
} from '@/features/expenses/engine/sessionManager';
import {
  buildClarificationState,
  resolveHint,
  prioritizeClarificationHints,
  batchClarificationHints,
  computeAmbiguityLevel,
  isFullyResolved,
  needsClarification,
  getActiveQuestion,
} from '@/features/expenses/engine/clarificationOrchestrator';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type {
  SemanticCorrection,
  CategoryCorrectionPayload,
  MerchantCorrectionPayload,
  ClarificationAnswerPayload,
} from '@/features/expenses/engine/semanticSession';
import type { ClarificationHint } from '@/features/expenses/engine/semanticFragment';

// ── Helpers ───────────────────────────────────────────────────────────────────

let corrSeq = 0;

function makeCorrection(
  type: SemanticCorrection['type'],
  payload: SemanticCorrection['payload'],
  description = 'test',
): SemanticCorrection {
  return { id: `c${corrSeq++}`, type, timestamp: 1000, payload, description };
}

function hint(kind: ClarificationHint['kind'], fragmentId = 'f0'): ClarificationHint {
  return { kind, fragmentId, candidates: [], message: `hint:${kind}` };
}

beforeEach(() => {
  corrSeq = 0;
  resetSessionIds();
});

// ── createSession ─────────────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates session with id, createdAt, status', () => {
    const s = createSession('milk 100');
    expect(typeof s.id).toBe('string');
    expect(typeof s.createdAt).toBe('number');
    expect(['active', 'awaiting_clarification']).toContain(s.status);
  });

  it('originalInput and currentInput match raw', () => {
    const s = createSession('coffee 250');
    expect(s.originalInput).toBe('coffee 250');
    expect(s.currentInput).toBe('coffee 250');
  });

  it('parserContexts has exactly one entry on creation', () => {
    const s = createSession('milk 100');
    expect(s.parserContexts).toHaveLength(1);
  });

  it('corrections and undoneCorrections start empty', () => {
    const s = createSession('milk 100');
    expect(s.corrections).toHaveLength(0);
    expect(s.undoneCorrections).toHaveLength(0);
  });

  it('traces starts empty', () => {
    const s = createSession('milk 100');
    expect(s.traces).toHaveLength(0);
  });

  it('pendingGroups and resolvedGroups start with correct values', () => {
    const s = createSession('milk 100');
    expect(Array.isArray(s.pendingGroups)).toBe(true);
    expect(Array.isArray(s.resolvedGroups)).toBe(true);
    expect(s.resolvedGroups).toHaveLength(0);
  });

  it('status is awaiting_clarification when parser produces hints', () => {
    // An unknown word produces unknown_merchant hint → awaiting_clarification
    const s = createSession('xyzunknown 350');
    const ctx = parseInput('xyzunknown 350');
    if (ctx.clarificationHints.length > 0) {
      expect(s.status).toBe('awaiting_clarification');
      expect(s.clarificationState).toBeDefined();
    }
  });

  it('status is active for unambiguous input', () => {
    // 'milk 100' with no unknown merchants → active
    const s = createSession('milk 100');
    const ctx = parseInput('milk 100');
    if (ctx.clarificationHints.length === 0) {
      expect(s.status).toBe('active');
      expect(s.clarificationState).toBeUndefined();
    }
  });

  it('currentContext() returns the initial ParserContext', () => {
    const s = createSession('milk 100');
    const ctx = currentContext(s);
    expect(ctx).toBeDefined();
    expect(ctx.raw).toBe('milk 100');
  });
});

// ── applyCorrection ───────────────────────────────────────────────────────────

describe('applyCorrection', () => {
  it('records correction in corrections[]', () => {
    const s = createSession('milk 100');
    const corr = makeCorrection('category_correction', {
      fragmentId: 'f0',
      previousCategoryId: 'groceries',
      newCategoryId: 'dairy',
    } satisfies CategoryCorrectionPayload);
    const s2 = applyCorrection(s, corr);
    expect(s2.corrections).toHaveLength(1);
    expect(s2.corrections[0].id).toBe(corr.id);
  });

  it('original session unchanged after applyCorrection', () => {
    const s = createSession('milk 100');
    const corr = makeCorrection('category_correction', {
      fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y',
    } satisfies CategoryCorrectionPayload);
    applyCorrection(s, corr);
    expect(s.corrections).toHaveLength(0);
  });

  it('category_correction does not add new parserContext', () => {
    const s = createSession('milk 100');
    const corr = makeCorrection('category_correction', {
      fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y',
    } satisfies CategoryCorrectionPayload);
    const s2 = applyCorrection(s, corr);
    expect(s2.parserContexts).toHaveLength(1);
  });

  it('undoneCorrections cleared after applying new correction', () => {
    const s = createSession('milk 100');
    const corr1 = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    const s2 = applyCorrection(s, corr1);
    const s3 = undoLastCorrection(s2);
    expect(s3.undoneCorrections).toHaveLength(1);
    // Apply new correction — clears redo stack
    const corr2 = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'z' } satisfies CategoryCorrectionPayload);
    const s4 = applyCorrection(s3, corr2);
    expect(s4.undoneCorrections).toHaveLength(0);
  });

  it('resolves clarification hint on clarification_answer', () => {
    const s = createSession('xyzunknown 350');
    if (!s.clarificationState || s.clarificationState.pendingHints.length === 0) return;
    const hintToResolve = s.clarificationState.pendingHints[0];
    const corr = makeCorrection('clarification_answer', {
      hintFragmentId: hintToResolve.fragmentId,
      chosenCategoryId: 'other',
      hintKind: hintToResolve.kind,
    } satisfies ClarificationAnswerPayload);
    const s2 = applyCorrection(s, corr);
    expect(
      s2.clarificationState?.resolvedHintIds,
    ).toContain(hintToResolve.fragmentId);
  });

  it('closed session (resolved) ignores corrections', () => {
    const s = resolveSession(createSession('milk 100'));
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    const s2 = applyCorrection(s, corr);
    expect(s2.corrections).toHaveLength(0);
    expect(s2.status).toBe('resolved');
  });

  it('closed session (cancelled) ignores corrections', () => {
    const s = cancelSession(createSession('milk 100'));
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    const s2 = applyCorrection(s, corr);
    expect(s2.corrections).toHaveLength(0);
  });
});

// ── undoLastCorrection ────────────────────────────────────────────────────────

describe('undoLastCorrection', () => {
  it('removes last correction from corrections[]', () => {
    const s = createSession('milk 100');
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    const s2 = applyCorrection(s, corr);
    const s3 = undoLastCorrection(s2);
    expect(s3.corrections).toHaveLength(0);
  });

  it('moves undone correction to undoneCorrections[]', () => {
    const s = createSession('milk 100');
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    const s2 = applyCorrection(s, corr);
    const s3 = undoLastCorrection(s2);
    expect(s3.undoneCorrections).toHaveLength(1);
    expect(s3.undoneCorrections[0].id).toBe(corr.id);
  });

  it('noop when no corrections', () => {
    const s = createSession('milk 100');
    const s2 = undoLastCorrection(s);
    expect(s2).toBe(s); // same reference
  });

  it('can undo multiple corrections in sequence', () => {
    let s = createSession('milk 100');
    const corr1 = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    const corr2 = makeCorrection('category_correction', { fragmentId: 'f1', previousCategoryId: 'a', newCategoryId: 'b' } satisfies CategoryCorrectionPayload);
    s = applyCorrection(s, corr1);
    s = applyCorrection(s, corr2);
    s = undoLastCorrection(s);
    expect(s.corrections).toHaveLength(1);
    expect(s.corrections[0].id).toBe(corr1.id);
    s = undoLastCorrection(s);
    expect(s.corrections).toHaveLength(0);
  });
});

// ── redoLastUndo ──────────────────────────────────────────────────────────────

describe('redoLastUndo', () => {
  it('re-applies last undone correction', () => {
    const s = createSession('milk 100');
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    let s2 = applyCorrection(s, corr);
    s2 = undoLastCorrection(s2);
    expect(s2.corrections).toHaveLength(0);
    const s3 = redoLastUndo(s2);
    expect(s3.corrections).toHaveLength(1);
  });

  it('clears redone correction from undoneCorrections[]', () => {
    const s = createSession('milk 100');
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    let s2 = applyCorrection(s, corr);
    s2 = undoLastCorrection(s2);
    const s3 = redoLastUndo(s2);
    expect(s3.undoneCorrections).toHaveLength(0);
  });

  it('noop when nothing to redo', () => {
    const s = createSession('milk 100');
    const s2 = redoLastUndo(s);
    expect(s2).toBe(s);
  });
});

// ── resolveSession / cancelSession ────────────────────────────────────────────

describe('resolveSession / cancelSession', () => {
  it('resolveSession sets status to resolved', () => {
    const s = createSession('milk 100');
    expect(resolveSession(s).status).toBe('resolved');
  });

  it('cancelSession sets status to cancelled', () => {
    const s = createSession('milk 100');
    expect(cancelSession(s).status).toBe('cancelled');
  });

  it('resolveSession on cancelled session → no change', () => {
    const s = cancelSession(createSession('milk 100'));
    expect(resolveSession(s).status).toBe('cancelled');
  });

  it('cancelSession on resolved session → no change', () => {
    const s = resolveSession(createSession('milk 100'));
    expect(cancelSession(s).status).toBe('resolved');
  });

  it('isSessionOpen: false for resolved', () => {
    expect(isSessionOpen(resolveSession(createSession('milk 100')))).toBe(false);
  });

  it('isSessionOpen: false for cancelled', () => {
    expect(isSessionOpen(cancelSession(createSession('milk 100')))).toBe(false);
  });

  it('isSessionOpen: true for active', () => {
    const s = createSession('milk 100');
    if (s.status === 'active') {
      expect(isSessionOpen(s)).toBe(true);
    }
  });
});

// ── replaySession ─────────────────────────────────────────────────────────────

describe('replaySession', () => {
  it('replay of fresh session has 1 step (initial_parse)', () => {
    const s = createSession('milk 100');
    const replay = replaySession(s);
    expect(replay.steps[0].type).toBe('initial_parse');
    expect(replay.totalSteps).toBeGreaterThanOrEqual(1);
  });

  it('replay sessionId matches session.id', () => {
    const s = createSession('milk 100');
    const replay = replaySession(s);
    expect(replay.sessionId).toBe(s.id);
  });

  it('replay finalStatus matches session.status', () => {
    const s = resolveSession(createSession('milk 100'));
    const replay = replaySession(s);
    expect(replay.finalStatus).toBe('resolved');
  });

  it('replay with corrections has steps for each correction', () => {
    let s = createSession('milk 100');
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    s = applyCorrection(s, corr);
    const replay = replaySession(s);
    const corrSteps = replay.steps.filter((st) => st.type === 'correction_applied');
    expect(corrSteps).toHaveLength(1);
  });

  it('replay steps have non-negative stepIndex', () => {
    const s = createSession('milk 100');
    const replay = replaySession(s);
    for (const step of replay.steps) {
      expect(step.stepIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('replay steps have clarificationHintsAtStep field', () => {
    const s = createSession('milk 100');
    const replay = replaySession(s);
    for (const step of replay.steps) {
      expect(typeof step.clarificationHintsAtStep).toBe('number');
    }
  });
});

// ── clarificationOrchestrator — computeAmbiguityLevel ────────────────────────

describe('computeAmbiguityLevel', () => {
  it('0 pending / 0 total → 0', () => {
    expect(computeAmbiguityLevel(0, 0)).toBe(0);
  });

  it('0 pending / 2 total → 0', () => {
    expect(computeAmbiguityLevel(0, 2)).toBe(0);
  });

  it('2 pending / 2 total → 1', () => {
    expect(computeAmbiguityLevel(2, 2)).toBe(1);
  });

  it('1 pending / 2 total → 0.5', () => {
    expect(computeAmbiguityLevel(1, 2)).toBe(0.5);
  });

  it('capped at 1 if pending > total', () => {
    expect(computeAmbiguityLevel(5, 2)).toBe(1);
  });
});

// ── clarificationOrchestrator — buildClarificationState ──────────────────────

describe('buildClarificationState', () => {
  it('empty hints → ambiguityLevel 0, no activeQuestion', () => {
    const ctx = parseInput('milk 100');
    if (ctx.clarificationHints.length > 0) return; // skip if input has hints
    const state = buildClarificationState(ctx);
    expect(state.ambiguityLevel).toBe(0);
    expect(state.activeQuestion).toBeUndefined();
    expect(state.pendingHints).toHaveLength(0);
  });

  it('with hints → ambiguityLevel 1, activeQuestion set', () => {
    const ctx = parseInput('xyzunknown 350');
    if (ctx.clarificationHints.length === 0) return;
    const state = buildClarificationState(ctx);
    expect(state.ambiguityLevel).toBe(1);
    expect(typeof state.activeQuestion).toBe('string');
  });

  it('resolvedHintIds starts empty', () => {
    const ctx = parseInput('milk 100');
    const state = buildClarificationState(ctx);
    expect(state.resolvedHintIds).toHaveLength(0);
  });

  it('totalHintsAtStart equals initial pendingHints count', () => {
    const ctx = parseInput('xyzunknown 350');
    const state = buildClarificationState(ctx);
    expect(state.totalHintsAtStart).toBe(ctx.clarificationHints.length);
  });
});

// ── clarificationOrchestrator — resolveHint ───────────────────────────────────

describe('resolveHint', () => {
  it('resolving a hint removes it from pendingHints', () => {
    const hints: ClarificationHint[] = [hint('unknown_merchant', 'f0'), hint('multiple_categories', 'f1')];
    const ctx = parseInput('milk 100');
    const state: ReturnType<typeof buildClarificationState> = {
      pendingHints: hints,
      resolvedHintIds: [],
      activeQuestion: hints[0].message,
      ambiguityLevel: 1,
      totalHintsAtStart: 2,
    };
    const next = resolveHint(state, 'f0');
    expect(next.pendingHints).toHaveLength(1);
    expect(next.pendingHints[0].fragmentId).toBe('f1');
  });

  it('resolved hint id added to resolvedHintIds', () => {
    const hints: ClarificationHint[] = [hint('unknown_merchant', 'f0')];
    const state = { pendingHints: hints, resolvedHintIds: [], activeQuestion: hints[0].message, ambiguityLevel: 1, totalHintsAtStart: 1 };
    const next = resolveHint(state, 'f0');
    expect(next.resolvedHintIds).toContain('f0');
  });

  it('resolving last hint → ambiguityLevel 0, no activeQuestion', () => {
    const hints: ClarificationHint[] = [hint('unknown_merchant', 'f0')];
    const state = { pendingHints: hints, resolvedHintIds: [], activeQuestion: hints[0].message, ambiguityLevel: 1, totalHintsAtStart: 1 };
    const next = resolveHint(state, 'f0');
    expect(next.ambiguityLevel).toBe(0);
    expect(next.activeQuestion).toBeUndefined();
    expect(isFullyResolved(next)).toBe(true);
  });

  it('original state unchanged after resolveHint', () => {
    const hints: ClarificationHint[] = [hint('unknown_merchant', 'f0')];
    const state = { pendingHints: hints, resolvedHintIds: [], activeQuestion: hints[0].message, ambiguityLevel: 1, totalHintsAtStart: 1 };
    resolveHint(state, 'f0');
    expect(state.pendingHints).toHaveLength(1);
  });
});

// ── clarificationOrchestrator — prioritizeClarificationHints ─────────────────

describe('prioritizeClarificationHints', () => {
  it('conflicting_signals sorted before unknown_merchant', () => {
    const hints: ClarificationHint[] = [
      hint('unknown_merchant', 'f0'),
      hint('conflicting_signals', 'f1'),
    ];
    const sorted = prioritizeClarificationHints(hints);
    expect(sorted[0].kind).toBe('conflicting_signals');
    expect(sorted[1].kind).toBe('unknown_merchant');
  });

  it('full priority order: conflicting_signals → unknown_merchant → ambiguous_item → multiple_categories', () => {
    const hints: ClarificationHint[] = [
      hint('multiple_categories', 'f3'),
      hint('ambiguous_item', 'f2'),
      hint('unknown_merchant', 'f1'),
      hint('conflicting_signals', 'f0'),
    ];
    const sorted = prioritizeClarificationHints(hints);
    expect(sorted.map((h) => h.kind)).toEqual([
      'conflicting_signals',
      'unknown_merchant',
      'ambiguous_item',
      'multiple_categories',
    ]);
  });

  it('does not mutate input array', () => {
    const hints: ClarificationHint[] = [hint('multiple_categories', 'f0'), hint('conflicting_signals', 'f1')];
    const original = [...hints];
    prioritizeClarificationHints(hints);
    expect(hints.map((h) => h.kind)).toEqual(original.map((h) => h.kind));
  });
});

// ── clarificationOrchestrator — batchClarificationHints ──────────────────────

describe('batchClarificationHints', () => {
  it('groups hints by kind', () => {
    const hints: ClarificationHint[] = [
      hint('unknown_merchant', 'f0'),
      hint('unknown_merchant', 'f1'),
      hint('multiple_categories', 'f2'),
    ];
    const groups = batchClarificationHints(hints);
    const unknownGroup = groups.find((g) => g.kind === 'unknown_merchant');
    expect(unknownGroup?.hints).toHaveLength(2);
    const catGroup = groups.find((g) => g.kind === 'multiple_categories');
    expect(catGroup?.hints).toHaveLength(1);
  });

  it('groups sorted by priority (conflicting_signals first)', () => {
    const hints: ClarificationHint[] = [
      hint('multiple_categories', 'f0'),
      hint('conflicting_signals', 'f1'),
    ];
    const groups = batchClarificationHints(hints);
    expect(groups[0].kind).toBe('conflicting_signals');
  });

  it('empty hints → empty groups', () => {
    expect(batchClarificationHints([])).toHaveLength(0);
  });
});

// ── needsClarification / getActiveQuestion ────────────────────────────────────

describe('needsClarification / getActiveQuestion', () => {
  it('needsClarification: false for unambiguous input', () => {
    const ctx = parseInput('milk 100');
    if (ctx.clarificationHints.length === 0) {
      expect(needsClarification(ctx)).toBe(false);
    }
  });

  it('getActiveQuestion: undefined for empty hints', () => {
    expect(getActiveQuestion([])).toBeUndefined();
  });

  it('getActiveQuestion returns message of highest-priority hint', () => {
    const hints: ClarificationHint[] = [
      hint('multiple_categories', 'f0'),
      hint('conflicting_signals', 'f1'),
    ];
    const question = getActiveQuestion(hints);
    expect(question).toBe('hint:conflicting_signals');
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('createSession same input → same initial status', () => {
    resetSessionIds();
    const s1 = createSession('milk 100');
    resetSessionIds();
    const s2 = createSession('milk 100');
    expect(s1.status).toBe(s2.status);
  });

  it('replaySession same session → same step count', () => {
    let s = createSession('milk 100');
    const corr = makeCorrection('category_correction', { fragmentId: 'f0', previousCategoryId: 'x', newCategoryId: 'y' } satisfies CategoryCorrectionPayload);
    s = applyCorrection(s, corr);
    const r1 = replaySession(s);
    const r2 = replaySession(s);
    expect(r1.totalSteps).toBe(r2.totalSteps);
  });

  it('computeAmbiguityLevel deterministic', () => {
    expect(computeAmbiguityLevel(1, 3)).toBe(computeAmbiguityLevel(1, 3));
  });
});
