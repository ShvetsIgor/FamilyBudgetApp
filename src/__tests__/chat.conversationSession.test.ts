/**
 * Tests for the centralized conversation state architecture.
 *
 * Covers:
 *   - ConversationSession model + mutations
 *   - ConversationEvents factory + queries
 *   - ConversationTransitions (state machine)
 *   - ExpenseDraft model + mutations + undo
 *   - IntentClassifier (deterministic rules)
 *   - SessionMemory isolation (global vs session)
 *   - ConversationInspector (debug utilities)
 *   - QuickAddBridge (QuickAddState ↔ ConversationSession)
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Session model
import {
  createConversationSession,
  addClarification,
  resolveClarification,
  selectCategory,
  clearSelectedCategories,
  isSessionOpen,
  hasUnresolvedClarifications,
  hasSplitDraft,
  isReadyToConfirm,
  unresolvedClarifications,
  type ConversationSession,
  type PendingClarification,
  type SelectedCategory,
  type SplitDraft,
} from '../features/chat/types/conversationSession';

// Events
import {
  buildConversationEvent,
  getLatestEvent,
  countEvents,
  filterEvents,
  eventsAfter,
  type ConversationEvent,
} from '../features/chat/types/conversationEvents';

// Transitions
import {
  canTransition,
  validNextStatuses,
  isTerminalStatus,
  applyTransition,
  startParsing,
  requestClarification,
  readyToConfirm,
  completeSession,
  cancelSession,
  reparseSession,
} from '../features/chat/engine/conversationTransitions';

// ExpenseDraft
import {
  createExpenseDraft,
  setDraftAmount,
  setDraftCategory,
  setDraftMerchant,
  initDraftSplit,
  updateDraftSplitItem,
  removeDraftSplitItem,
  setDraftComment,
  confirmDraft,
  undoLastRevision,
  isDraftConfirmable,
  isDraftSplitBalanced,
  draftSplitResolvedCount,
  draftPrimaryCategory,
  resetDraftCounters,
  type DraftSplitItem,
} from '../features/expenses/types/expenseDraft';

// IntentClassifier
import {
  classifyIntent,
  intentIs,
  isModificationIntent,
  isDestructiveIntent,
  isTerminalIntent,
} from '../features/chat/engine/intentClassifier';

// SessionMemory
import {
  createSessionMemory,
  setTentativeMerchant,
  addTentativeCategory,
  addTentativeTag,
  addReferencedSplitId,
  addContextualReferent,
  removeContextualReferent,
  buildGlobalMemoryPatch,
  resolveReferent,
  getLatestReferent,
  hasContextualReferents,
  hasTentativeData,
} from '../features/chat/engine/sessionMemory';

// ConversationInspector
import {
  inspectConversationSession,
  explainTransition,
  explainClarification,
  buildSessionTimeline,
  explainLastTransition,
  explainAllClarifications,
} from '../features/chat/engine/conversationInspector';

// QuickAddBridge
import {
  sessionStatusToQuickAddStatus,
  quickAddFromSession,
  applyQuickAddToSession,
  initialQuickAddForSession,
} from '../features/chat/engine/quickAddBridge';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = '2026-05-24T12:00:00.000Z';

function makeSession(overrides?: Partial<ConversationSession>): ConversationSession {
  const s = createConversationSession(NOW);
  return { ...s, ...overrides };
}

function makeClarification(overrides?: Partial<PendingClarification>): PendingClarification {
  return {
    id: 'clar-1',
    kind: 'unknown_merchant',
    question: 'Какой мерчант?',
    isRequired: true,
    ...overrides,
  };
}

function makeSelectedCategory(overrides?: Partial<SelectedCategory>): SelectedCategory {
  return { categoryId: 'food', confidence: 0.8, source: 'suggestion', ...overrides };
}

// ── ConversationSession ───────────────────────────────────────────────────────

describe('conversationSession', () => {
  describe('createConversationSession', () => {
    it('creates idle session with empty state', () => {
      const s = createConversationSession(NOW);
      expect(s.status).toBe('idle');
      expect(s.currentInput).toBe('');
      expect(s.pendingClarifications).toHaveLength(0);
      expect(s.selectedCategories).toHaveLength(0);
      expect(s.history).toHaveLength(0);
      expect(s.splitDraft).toBeUndefined();
      expect(s.createdAt).toBe(NOW);
    });

    it('generates unique ids', () => {
      const a = createConversationSession(NOW);
      const b = createConversationSession(NOW);
      expect(a.id).not.toBe(b.id);
    });

    it('is immutable by convention — original unchanged after mutation', () => {
      const s = createConversationSession(NOW);
      addClarification(s, makeClarification());
      expect(s.pendingClarifications).toHaveLength(0);
    });
  });

  describe('addClarification', () => {
    it('appends clarification to list', () => {
      const s = makeSession();
      const c = makeClarification();
      const next = addClarification(s, c);
      expect(next.pendingClarifications).toHaveLength(1);
      expect(next.pendingClarifications[0].id).toBe('clar-1');
    });

    it('updates updatedAt', () => {
      const s = makeSession();
      const next = addClarification(s, makeClarification(), '2026-05-24T13:00:00.000Z');
      expect(next.updatedAt).toBe('2026-05-24T13:00:00.000Z');
    });

    it('does not modify original', () => {
      const s = makeSession();
      addClarification(s, makeClarification());
      expect(s.pendingClarifications).toHaveLength(0);
    });
  });

  describe('resolveClarification', () => {
    it('marks clarification as resolved', () => {
      const s = makeSession();
      const withClar = addClarification(s, makeClarification());
      const resolved = resolveClarification(withClar, 'clar-1', 'food-store', NOW);
      expect(resolved.pendingClarifications[0].resolvedAt).toBe(NOW);
      expect(resolved.pendingClarifications[0].resolvedWith).toBe('food-store');
    });

    it('leaves non-matching clarifications untouched', () => {
      const s = makeSession();
      const c1 = makeClarification({ id: 'c1' });
      const c2 = makeClarification({ id: 'c2', kind: 'missing_amount' });
      const withBoth = addClarification(addClarification(s, c1), c2);
      const resolved = resolveClarification(withBoth, 'c1', 'x', NOW);
      expect(resolved.pendingClarifications[0].resolvedAt).toBe(NOW);
      expect(resolved.pendingClarifications[1].resolvedAt).toBeUndefined();
    });
  });

  describe('selectCategory', () => {
    it('adds category to front', () => {
      const s = makeSession();
      const next = selectCategory(s, makeSelectedCategory());
      expect(next.selectedCategories[0].categoryId).toBe('food');
    });

    it('does not duplicate same category', () => {
      const s = makeSession();
      const next = selectCategory(
        selectCategory(s, makeSelectedCategory()),
        makeSelectedCategory(),
      );
      expect(next.selectedCategories).toHaveLength(1);
    });
  });

  describe('clearSelectedCategories', () => {
    it('empties selected categories', () => {
      const s = selectCategory(makeSession(), makeSelectedCategory());
      const cleared = clearSelectedCategories(s);
      expect(cleared.selectedCategories).toHaveLength(0);
    });
  });

  describe('query helpers', () => {
    it('isSessionOpen is false for completed', () => {
      const s = makeSession({ status: 'completed' });
      expect(isSessionOpen(s)).toBe(false);
    });

    it('isSessionOpen is false for cancelled', () => {
      const s = makeSession({ status: 'cancelled' });
      expect(isSessionOpen(s)).toBe(false);
    });

    it('isSessionOpen is true for clarifying', () => {
      expect(isSessionOpen(makeSession({ status: 'clarifying' }))).toBe(true);
    });

    it('hasUnresolvedClarifications is true when required clar unresolved', () => {
      const s = addClarification(makeSession(), makeClarification({ isRequired: true }));
      expect(hasUnresolvedClarifications(s)).toBe(true);
    });

    it('hasUnresolvedClarifications is false when all resolved', () => {
      const s = addClarification(makeSession(), makeClarification({ isRequired: true }));
      const resolved = resolveClarification(s, 'clar-1', 'x', NOW);
      expect(hasUnresolvedClarifications(resolved)).toBe(false);
    });

    it('hasUnresolvedClarifications ignores optional clarifications', () => {
      const s = addClarification(makeSession(), makeClarification({ isRequired: false }));
      expect(hasUnresolvedClarifications(s)).toBe(false);
    });

    it('hasSplitDraft is false without split', () => {
      expect(hasSplitDraft(makeSession())).toBe(false);
    });

    it('hasSplitDraft is true with split items', () => {
      const draft: SplitDraft = { items: [{ id: '1', label: 'x', categoryId: null, amount: 50, isResolved: false }], totalAmount: 50, isBalanced: false };
      expect(hasSplitDraft(makeSession({ splitDraft: draft }))).toBe(true);
    });

    it('unresolvedClarifications returns only unresolved', () => {
      const s = addClarification(
        addClarification(makeSession(), makeClarification({ id: 'c1' })),
        makeClarification({ id: 'c2' }),
      );
      const afterResolve = resolveClarification(s, 'c1', 'x', NOW);
      expect(unresolvedClarifications(afterResolve)).toHaveLength(1);
      expect(unresolvedClarifications(afterResolve)[0].id).toBe('c2');
    });

    it('isReadyToConfirm requires confirming status + category + amount', () => {
      const s = makeSession({ status: 'confirming' });
      const withCat = selectCategory(s, makeSelectedCategory());
      const withContext = { ...withCat, expenseContext: { amount: 100 } as any };
      expect(isReadyToConfirm(withContext)).toBe(true);
    });

    it('isReadyToConfirm is false without categories', () => {
      const s = makeSession({ status: 'confirming', expenseContext: { amount: 100 } as any });
      expect(isReadyToConfirm(s)).toBe(false);
    });
  });
});

// ── ConversationEvents ────────────────────────────────────────────────────────

describe('conversationEvents', () => {
  it('buildConversationEvent creates event with correct fields', () => {
    const event = buildConversationEvent('INPUT_RECEIVED', 'sess-1', { input: 'coffee 50' }, NOW);
    expect(event.kind).toBe('INPUT_RECEIVED');
    expect(event.sessionId).toBe('sess-1');
    expect(event.timestamp).toBe(NOW);
    expect((event.payload as any).input).toBe('coffee 50');
    expect(event.id).toMatch(/^evt-/);
  });

  it('generates unique event ids', () => {
    const a = buildConversationEvent('INPUT_RECEIVED', 'x', {}, NOW);
    const b = buildConversationEvent('INPUT_RECEIVED', 'x', {}, NOW);
    expect(a.id).not.toBe(b.id);
  });

  describe('getLatestEvent', () => {
    it('returns last matching event', () => {
      const history: ConversationEvent[] = [
        buildConversationEvent('INPUT_RECEIVED', 'x', { input: 'first' }, NOW),
        buildConversationEvent('INPUT_RECEIVED', 'x', { input: 'second' }, NOW),
      ];
      const e = getLatestEvent(history, 'INPUT_RECEIVED');
      expect((e?.payload as any).input).toBe('second');
    });

    it('returns undefined when kind not found', () => {
      expect(getLatestEvent([], 'AMOUNT_DETECTED')).toBeUndefined();
    });
  });

  describe('countEvents', () => {
    it('counts correctly', () => {
      const history = [
        buildConversationEvent('INPUT_RECEIVED', 'x', {}, NOW),
        buildConversationEvent('INPUT_RECEIVED', 'x', {}, NOW),
        buildConversationEvent('AMOUNT_DETECTED', 'x', { amount: 50, confidence: 0.9 }, NOW),
      ];
      expect(countEvents(history, 'INPUT_RECEIVED')).toBe(2);
      expect(countEvents(history, 'AMOUNT_DETECTED')).toBe(1);
      expect(countEvents(history, 'EXPENSE_CONFIRMED')).toBe(0);
    });
  });

  describe('filterEvents', () => {
    it('filters by kind', () => {
      const history = [
        buildConversationEvent('INPUT_RECEIVED', 'x', {}, NOW),
        buildConversationEvent('AMOUNT_DETECTED', 'x', { amount: 50, confidence: 0.9 }, NOW),
      ];
      expect(filterEvents(history, 'INPUT_RECEIVED')).toHaveLength(1);
    });
  });

  describe('eventsAfter', () => {
    it('returns events with later timestamp', () => {
      const history = [
        buildConversationEvent('INPUT_RECEIVED', 'x', {}, '2026-05-24T10:00:00.000Z'),
        buildConversationEvent('AMOUNT_DETECTED', 'x', { amount: 50, confidence: 0.9 }, '2026-05-24T12:00:00.000Z'),
      ];
      const after = eventsAfter(history, '2026-05-24T11:00:00.000Z');
      expect(after).toHaveLength(1);
      expect(after[0].kind).toBe('AMOUNT_DETECTED');
    });
  });
});

// ── ConversationTransitions ───────────────────────────────────────────────────

describe('conversationTransitions', () => {
  describe('canTransition', () => {
    it('allows valid transitions', () => {
      expect(canTransition('idle', 'parsing')).toBe(true);
      expect(canTransition('parsing', 'clarifying')).toBe(true);
      expect(canTransition('parsing', 'confirming')).toBe(true);
      expect(canTransition('clarifying', 'confirming')).toBe(true);
      expect(canTransition('clarifying', 'parsing')).toBe(true);
      expect(canTransition('confirming', 'completed')).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(canTransition('idle', 'completed')).toBe(false);
      expect(canTransition('completed', 'parsing')).toBe(false);
      expect(canTransition('cancelled', 'parsing')).toBe(false);
      expect(canTransition('idle', 'confirming')).toBe(false);
    });

    it('rejects transitions from terminal states', () => {
      expect(canTransition('completed', 'idle')).toBe(false);
      expect(canTransition('cancelled', 'idle')).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it('marks completed and cancelled as terminal', () => {
      expect(isTerminalStatus('completed')).toBe(true);
      expect(isTerminalStatus('cancelled')).toBe(true);
    });

    it('marks other states as non-terminal', () => {
      expect(isTerminalStatus('idle')).toBe(false);
      expect(isTerminalStatus('parsing')).toBe(false);
      expect(isTerminalStatus('confirming')).toBe(false);
    });
  });

  describe('validNextStatuses', () => {
    it('returns correct next statuses for idle', () => {
      expect(validNextStatuses('idle')).toContain('parsing');
      expect(validNextStatuses('idle')).toContain('cancelled');
    });

    it('returns empty for terminal states', () => {
      expect(validNextStatuses('completed')).toHaveLength(0);
      expect(validNextStatuses('cancelled')).toHaveLength(0);
    });
  });

  describe('applyTransition', () => {
    it('returns new session with updated status', () => {
      const s = makeSession({ status: 'idle' });
      const next = applyTransition(s, 'parsing', 'test', NOW);
      expect(next?.status).toBe('parsing');
    });

    it('returns null for invalid transition', () => {
      const s = makeSession({ status: 'completed' });
      expect(applyTransition(s, 'parsing', 'test', NOW)).toBeNull();
    });

    it('appends STATUS_CHANGED to history', () => {
      const s = makeSession({ status: 'idle' });
      const next = applyTransition(s, 'parsing', 'test', NOW)!;
      expect(next.history).toHaveLength(1);
      expect(next.history[0].kind).toBe('STATUS_CHANGED');
    });

    it('does not mutate original', () => {
      const s = makeSession({ status: 'idle' });
      applyTransition(s, 'parsing', 'test', NOW);
      expect(s.status).toBe('idle');
      expect(s.history).toHaveLength(0);
    });
  });

  describe('startParsing', () => {
    it('transitions idle → parsing and sets input', () => {
      const s = makeSession({ status: 'idle' });
      const next = startParsing(s, 'coffee 50', NOW)!;
      expect(next.status).toBe('parsing');
      expect(next.currentInput).toBe('coffee 50');
    });

    it('appends STATUS_CHANGED and INPUT_RECEIVED events', () => {
      const s = makeSession({ status: 'idle' });
      const next = startParsing(s, 'coffee 50', NOW)!;
      const kinds = next.history.map((e) => e.kind);
      expect(kinds).toContain('STATUS_CHANGED');
      expect(kinds).toContain('INPUT_RECEIVED');
    });

    it('returns null when not idle', () => {
      const s = makeSession({ status: 'confirming' });
      expect(startParsing(s, 'x', NOW)).toBeNull();
    });
  });

  describe('requestClarification', () => {
    it('transitions parsing → clarifying', () => {
      const s = makeSession({ status: 'parsing' });
      const next = requestClarification(s, 'ambiguous merchant', NOW)!;
      expect(next.status).toBe('clarifying');
    });

    it('returns null from idle', () => {
      const s = makeSession({ status: 'idle' });
      expect(requestClarification(s, 'x', NOW)).toBeNull();
    });
  });

  describe('readyToConfirm', () => {
    it('transitions parsing → confirming', () => {
      const s = makeSession({ status: 'parsing' });
      expect(readyToConfirm(s, 'confident', NOW)?.status).toBe('confirming');
    });

    it('transitions clarifying → confirming', () => {
      const s = makeSession({ status: 'clarifying' });
      expect(readyToConfirm(s, 'clarified', NOW)?.status).toBe('confirming');
    });
  });

  describe('completeSession', () => {
    it('transitions confirming → completed', () => {
      const s = makeSession({ status: 'confirming' });
      const next = completeSession(s, NOW)!;
      expect(next.status).toBe('completed');
    });

    it('appends EXPENSE_CONFIRMED event', () => {
      const s = makeSession({ status: 'confirming' });
      const next = completeSession(s, NOW)!;
      expect(next.history.some((e) => e.kind === 'EXPENSE_CONFIRMED')).toBe(true);
    });
  });

  describe('cancelSession', () => {
    it('cancels from any open state', () => {
      for (const status of ['idle', 'parsing', 'clarifying', 'confirming'] as const) {
        const next = cancelSession(makeSession({ status }), 'test', NOW);
        expect(next?.status).toBe('cancelled');
      }
    });

    it('returns null from completed', () => {
      expect(cancelSession(makeSession({ status: 'completed' }), 'x', NOW)).toBeNull();
    });

    it('appends SESSION_CANCELLED event', () => {
      const s = makeSession({ status: 'parsing' });
      const next = cancelSession(s, 'test', NOW)!;
      expect(next.history.some((e) => e.kind === 'SESSION_CANCELLED')).toBe(true);
    });
  });

  describe('reparseSession', () => {
    it('transitions clarifying → parsing and sets new input', () => {
      const s = makeSession({ status: 'clarifying' });
      const next = reparseSession(s, 'new input 100', NOW)!;
      expect(next.status).toBe('parsing');
      expect(next.currentInput).toBe('new input 100');
    });

    it('clears pending clarifications', () => {
      const s = addClarification(
        makeSession({ status: 'clarifying' }),
        makeClarification(),
      );
      const next = reparseSession(s, 'new input', NOW)!;
      expect(next.pendingClarifications).toHaveLength(0);
    });

    it('returns null when not in clarifying', () => {
      const s = makeSession({ status: 'confirming' });
      expect(reparseSession(s, 'x', NOW)).toBeNull();
    });
  });
});

// ── ExpenseDraft ──────────────────────────────────────────────────────────────

describe('expenseDraft', () => {
  beforeEach(() => {
    resetDraftCounters();
  });

  describe('createExpenseDraft', () => {
    it('creates empty draft', () => {
      const d = createExpenseDraft('sess-1');
      expect(d.amount).toBeNull();
      expect(d.categories).toHaveLength(0);
      expect(d.splitItems).toHaveLength(0);
      expect(d.isConfirmed).toBe(false);
      expect(d.revisionHistory).toHaveLength(0);
    });

    it('uses given sessionId', () => {
      const d = createExpenseDraft('sess-abc');
      expect(d.sessionId).toBe('sess-abc');
    });
  });

  describe('setDraftAmount', () => {
    it('sets amount and records revision', () => {
      const d = createExpenseDraft('s');
      const next = setDraftAmount(d, 150, NOW);
      expect(next.amount).toBe(150);
      expect(next.revisionHistory).toHaveLength(1);
      expect(next.revisionHistory[0].kind).toBe('amount_changed');
      expect(next.revisionHistory[0].previousValue).toBeNull();
      expect(next.revisionHistory[0].newValue).toBe(150);
    });

    it('does not mutate original', () => {
      const d = createExpenseDraft('s');
      setDraftAmount(d, 200, NOW);
      expect(d.amount).toBeNull();
    });

    it('records previous value in revision', () => {
      const d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      const next = setDraftAmount(d, 200, NOW);
      expect(next.revisionHistory[1].previousValue).toBe(100);
    });
  });

  describe('setDraftCategory', () => {
    it('adds category to front', () => {
      const d = createExpenseDraft('s');
      const cat = { categoryId: 'food', label: 'Еда', confidence: 0.9, source: 'user' as const };
      const next = setDraftCategory(d, cat, NOW);
      expect(next.categories[0].categoryId).toBe('food');
      expect(next.revisionHistory[0].kind).toBe('category_added');
    });

    it('replaces first category on subsequent call', () => {
      const d = createExpenseDraft('s');
      const cat1 = { categoryId: 'food', label: 'Еда', confidence: 0.9, source: 'user' as const };
      const cat2 = { categoryId: 'transport', label: 'Транспорт', confidence: 0.8, source: 'user' as const };
      const next = setDraftCategory(setDraftCategory(d, cat1, NOW), cat2, NOW);
      expect(next.categories[0].categoryId).toBe('transport');
      expect(next.revisionHistory[1].kind).toBe('category_changed');
    });
  });

  describe('setDraftMerchant', () => {
    it('sets merchant and merchantKey', () => {
      const d = createExpenseDraft('s');
      const next = setDraftMerchant(d, 'Starbucks', 'starbucks', NOW);
      expect(next.merchant).toBe('Starbucks');
      expect(next.merchantKey).toBe('starbucks');
      expect(next.revisionHistory[0].kind).toBe('merchant_set');
    });
  });

  describe('initDraftSplit', () => {
    it('enables split and sets items', () => {
      const items: DraftSplitItem[] = [
        { id: '1', label: 'coffee', categoryId: null, amount: 50, isResolved: false },
        { id: '2', label: 'sandwich', categoryId: null, amount: 100, isResolved: false },
      ];
      const d = initDraftSplit(createExpenseDraft('s'), items, NOW);
      expect(d.isSplit).toBe(true);
      expect(d.splitItems).toHaveLength(2);
      expect(d.revisionHistory[0].kind).toBe('split_initiated');
    });
  });

  describe('updateDraftSplitItem', () => {
    it('updates specific item and records revision', () => {
      const items: DraftSplitItem[] = [
        { id: '1', label: 'coffee', categoryId: null, amount: 50, isResolved: false },
      ];
      const d = initDraftSplit(createExpenseDraft('s'), items, NOW);
      const next = updateDraftSplitItem(d, '1', { categoryId: 'food', isResolved: true }, NOW);
      expect(next.splitItems[0].categoryId).toBe('food');
      expect(next.splitItems[0].isResolved).toBe(true);
      expect(next.revisionHistory[1].kind).toBe('split_item_updated');
    });

    it('leaves other items unchanged', () => {
      const items: DraftSplitItem[] = [
        { id: '1', label: 'a', categoryId: null, amount: 50, isResolved: false },
        { id: '2', label: 'b', categoryId: null, amount: 60, isResolved: false },
      ];
      const d = initDraftSplit(createExpenseDraft('s'), items, NOW);
      const next = updateDraftSplitItem(d, '1', { categoryId: 'food' }, NOW);
      expect(next.splitItems[1].categoryId).toBeNull();
    });
  });

  describe('removeDraftSplitItem', () => {
    it('removes item and records revision', () => {
      const items: DraftSplitItem[] = [
        { id: '1', label: 'a', categoryId: null, amount: 50, isResolved: false },
        { id: '2', label: 'b', categoryId: null, amount: 60, isResolved: false },
      ];
      const d = initDraftSplit(createExpenseDraft('s'), items, NOW);
      const next = removeDraftSplitItem(d, '1', NOW);
      expect(next.splitItems).toHaveLength(1);
      expect(next.splitItems[0].id).toBe('2');
    });
  });

  describe('setDraftComment', () => {
    it('sets comment', () => {
      const d = setDraftComment(createExpenseDraft('s'), 'business lunch', NOW);
      expect(d.comment).toBe('business lunch');
      expect(d.revisionHistory[0].kind).toBe('comment_changed');
    });
  });

  describe('confirmDraft', () => {
    it('marks draft as confirmed', () => {
      const d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      expect(confirmDraft(d).isConfirmed).toBe(true);
    });
  });

  describe('undoLastRevision', () => {
    it('removes last revision and returns it', () => {
      const d = setDraftAmount(setDraftAmount(createExpenseDraft('s'), 100, NOW), 200, NOW);
      const result = undoLastRevision(d);
      expect(result).not.toBeNull();
      expect(result!.undone.kind).toBe('amount_changed');
      expect(result!.draft.revisionHistory).toHaveLength(1);
    });

    it('returns null when no revision history', () => {
      expect(undoLastRevision(createExpenseDraft('s'))).toBeNull();
    });

    it('does not mutate original draft', () => {
      const d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      undoLastRevision(d);
      expect(d.revisionHistory).toHaveLength(1);
    });
  });

  describe('isDraftConfirmable', () => {
    it('is false without amount', () => {
      const d = setDraftCategory(createExpenseDraft('s'), { categoryId: 'food', label: 'Еда', confidence: 1, source: 'user' }, NOW);
      expect(isDraftConfirmable(d)).toBe(false);
    });

    it('is false without categories', () => {
      const d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      expect(isDraftConfirmable(d)).toBe(false);
    });

    it('is true with amount and category', () => {
      let d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      d = setDraftCategory(d, { categoryId: 'food', label: 'Еда', confidence: 1, source: 'user' }, NOW);
      expect(isDraftConfirmable(d)).toBe(true);
    });

    it('is false when already confirmed', () => {
      let d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      d = setDraftCategory(d, { categoryId: 'food', label: 'Еда', confidence: 1, source: 'user' }, NOW);
      expect(isDraftConfirmable(confirmDraft(d))).toBe(false);
    });
  });

  describe('isDraftSplitBalanced', () => {
    it('is true for non-split draft', () => {
      expect(isDraftSplitBalanced(createExpenseDraft('s'))).toBe(true);
    });

    it('is true when split items sum to amount', () => {
      const items: DraftSplitItem[] = [
        { id: '1', label: 'a', categoryId: 'food', amount: 60, isResolved: true },
        { id: '2', label: 'b', categoryId: 'transport', amount: 40, isResolved: true },
      ];
      let d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      d = initDraftSplit(d, items, NOW);
      expect(isDraftSplitBalanced(d)).toBe(true);
    });

    it('is false when items do not balance', () => {
      const items: DraftSplitItem[] = [
        { id: '1', label: 'a', categoryId: 'food', amount: 60, isResolved: true },
      ];
      let d = setDraftAmount(createExpenseDraft('s'), 100, NOW);
      d = initDraftSplit(d, items, NOW);
      expect(isDraftSplitBalanced(d)).toBe(false);
    });
  });

  describe('draftSplitResolvedCount', () => {
    it('counts resolved items', () => {
      const items: DraftSplitItem[] = [
        { id: '1', label: 'a', categoryId: 'food', amount: 50, isResolved: true },
        { id: '2', label: 'b', categoryId: null, amount: 50, isResolved: false },
      ];
      const d = initDraftSplit(createExpenseDraft('s'), items, NOW);
      expect(draftSplitResolvedCount(d)).toBe(1);
    });
  });

  describe('draftPrimaryCategory', () => {
    it('returns null when no categories', () => {
      expect(draftPrimaryCategory(createExpenseDraft('s'))).toBeNull();
    });

    it('returns first category', () => {
      const d = setDraftCategory(
        createExpenseDraft('s'),
        { categoryId: 'food', label: 'Еда', confidence: 1, source: 'user' },
        NOW,
      );
      expect(draftPrimaryCategory(d)?.categoryId).toBe('food');
    });
  });
});

// ── IntentClassifier ──────────────────────────────────────────────────────────

describe('intentClassifier', () => {
  const idleSession = makeSession({ status: 'idle' });
  const parsingSession = makeSession({ status: 'parsing' });
  const confirmingSession = makeSession({ status: 'confirming' });
  const sessionWithHistory = makeSession({
    status: 'clarifying',
    history: [buildConversationEvent('INPUT_RECEIVED', 'x', { input: 'test' }, NOW)],
  });
  const sessionWithSplit = makeSession({
    status: 'clarifying',
    splitDraft: { items: [], totalAmount: 100, isBalanced: false },
  });

  describe('CANCEL intent', () => {
    it('detects cancel from open session', () => {
      const r = classifyIntent('отмена', parsingSession);
      expect(r.intent).toBe('CANCEL');
      expect(r.confidence).toBeGreaterThan(0.9);
    });

    it('does not trigger cancel from idle session', () => {
      const r = classifyIntent('нет', idleSession);
      expect(r.intent).not.toBe('CANCEL');
    });

    it('detects English cancel', () => {
      const r = classifyIntent('cancel', parsingSession);
      expect(r.intent).toBe('CANCEL');
    });
  });

  describe('CONFIRM intent', () => {
    it('detects confirm in confirming state', () => {
      const r = classifyIntent('да', confirmingSession);
      expect(r.intent).toBe('CONFIRM');
    });

    it('does not trigger confirm in parsing state', () => {
      const r = classifyIntent('да', parsingSession);
      expect(r.intent).not.toBe('CONFIRM');
    });

    it('detects multiple confirm keywords', () => {
      expect(classifyIntent('yes', confirmingSession).intent).toBe('CONFIRM');
      expect(classifyIntent('верно', confirmingSession).intent).toBe('CONFIRM');
    });
  });

  describe('UNDO intent', () => {
    it('detects undo with history', () => {
      const r = classifyIntent('назад', sessionWithHistory);
      expect(r.intent).toBe('UNDO');
    });

    it('does not trigger undo without history', () => {
      const r = classifyIntent('назад', parsingSession);
      expect(r.intent).not.toBe('UNDO');
    });
  });

  describe('MODIFY_SPLIT intent', () => {
    it('detects split modification when split is active', () => {
      const r = classifyIntent('еще tools 200', sessionWithSplit);
      expect(r.intent).toBe('MODIFY_SPLIT');
    });

    it('does not trigger split modification without split draft', () => {
      const r = classifyIntent('еще tools 200', parsingSession);
      expect(r.intent).not.toBe('MODIFY_SPLIT');
    });
  });

  describe('ADD_EXPENSE intent', () => {
    it('detects add expense with amount', () => {
      const r = classifyIntent('кофе 150', idleSession);
      expect(r.intent).toBe('ADD_EXPENSE');
      expect(r.confidence).toBeGreaterThan(0.5);
    });

    it('is ambiguous without amount', () => {
      const r = classifyIntent('кофе', idleSession);
      expect(r.intent).toBe('ADD_EXPENSE');
      expect(r.isAmbiguous).toBe(true);
    });
  });

  describe('query helpers', () => {
    it('intentIs matches specific intents', () => {
      const r = classifyIntent('кофе 150', idleSession);
      expect(intentIs(r, 'ADD_EXPENSE')).toBe(true);
      expect(intentIs(r, 'CANCEL')).toBe(false);
    });

    it('isModificationIntent is true for modification intents', () => {
      const cancel = classifyIntent('отмена', parsingSession);
      const undo = classifyIntent('назад', sessionWithHistory);
      expect(isModificationIntent(undo)).toBe(true);
      expect(isModificationIntent(cancel)).toBe(false);
    });

    it('isDestructiveIntent is true for CANCEL', () => {
      const cancel = classifyIntent('отмена', parsingSession);
      expect(isDestructiveIntent(cancel)).toBe(true);
    });

    it('isTerminalIntent is true for CONFIRM and CANCEL', () => {
      expect(isTerminalIntent(classifyIntent('да', confirmingSession))).toBe(true);
      expect(isTerminalIntent(classifyIntent('отмена', parsingSession))).toBe(true);
      expect(isTerminalIntent(classifyIntent('кофе 50', idleSession))).toBe(false);
    });
  });
});

// ── SessionMemory ─────────────────────────────────────────────────────────────

describe('sessionMemory', () => {
  describe('createSessionMemory', () => {
    it('creates empty session memory', () => {
      const m = createSessionMemory('sess-1', NOW);
      expect(m.sessionId).toBe('sess-1');
      expect(m.tentativeCategories).toHaveLength(0);
      expect(m.tentativeTags).toHaveLength(0);
      expect(m.contextualReferents).toHaveLength(0);
      expect(m.tentativeMerchant).toBeUndefined();
    });
  });

  describe('setTentativeMerchant', () => {
    it('sets merchant and key', () => {
      const m = setTentativeMerchant(createSessionMemory('s'), 'Starbucks', 'starbucks');
      expect(m.tentativeMerchant).toBe('Starbucks');
      expect(m.tentativeMerchantKey).toBe('starbucks');
    });

    it('does not mutate original', () => {
      const m = createSessionMemory('s');
      setTentativeMerchant(m, 'x', 'x');
      expect(m.tentativeMerchant).toBeUndefined();
    });
  });

  describe('addTentativeCategory', () => {
    it('adds category to list', () => {
      const m = addTentativeCategory(createSessionMemory('s'), 'food');
      expect(m.tentativeCategories).toContain('food');
    });

    it('does not duplicate categories', () => {
      const m = addTentativeCategory(addTentativeCategory(createSessionMemory('s'), 'food'), 'food');
      expect(m.tentativeCategories).toHaveLength(1);
    });
  });

  describe('addTentativeTag', () => {
    it('adds and normalizes tag', () => {
      const m = addTentativeTag(createSessionMemory('s'), 'ЕДА');
      expect(m.tentativeTags).toContain('еда');
    });

    it('does not duplicate tags', () => {
      const m = addTentativeTag(addTentativeTag(createSessionMemory('s'), 'еда'), 'еда');
      expect(m.tentativeTags).toHaveLength(1);
    });
  });

  describe('addReferencedSplitId', () => {
    it('adds split id', () => {
      const m = addReferencedSplitId(createSessionMemory('s'), 'split-1');
      expect(m.referencedSplitIds).toContain('split-1');
    });

    it('does not duplicate', () => {
      const m = addReferencedSplitId(addReferencedSplitId(createSessionMemory('s'), 'x'), 'x');
      expect(m.referencedSplitIds).toHaveLength(1);
    });
  });

  describe('contextual referents', () => {
    const ref = {
      kind: 'split_item' as const,
      referentId: 'item-1',
      label: 'tools',
      addedAt: NOW,
    };

    it('adds referent', () => {
      const m = addContextualReferent(createSessionMemory('s'), ref);
      expect(m.contextualReferents).toHaveLength(1);
    });

    it('resolveReferent finds by id', () => {
      const m = addContextualReferent(createSessionMemory('s'), ref);
      expect(resolveReferent(m, 'item-1')).toBeDefined();
      expect(resolveReferent(m, 'item-99')).toBeUndefined();
    });

    it('removeContextualReferent removes by id', () => {
      const m = removeContextualReferent(
        addContextualReferent(createSessionMemory('s'), ref),
        'item-1',
      );
      expect(m.contextualReferents).toHaveLength(0);
    });

    it('getLatestReferent returns last added', () => {
      const ref2 = { ...ref, referentId: 'item-2', label: 'food' };
      const m = addContextualReferent(addContextualReferent(createSessionMemory('s'), ref), ref2);
      expect(getLatestReferent(m)?.referentId).toBe('item-2');
    });

    it('hasContextualReferents returns false when empty', () => {
      expect(hasContextualReferents(createSessionMemory('s'))).toBe(false);
    });
  });

  describe('buildGlobalMemoryPatch', () => {
    it('extracts tentative data for global memory', () => {
      let m = createSessionMemory('s');
      m = setTentativeMerchant(m, 'Starbucks', 'starbucks');
      m = addTentativeCategory(m, 'food');
      m = addTentativeTag(m, 'кофе');
      const patch = buildGlobalMemoryPatch(m);
      expect(patch.merchantKey).toBe('starbucks');
      expect(patch.merchantDisplay).toBe('Starbucks');
      expect(patch.confirmedCategoryIds).toContain('food');
      expect(patch.confirmedTags).toContain('кофе');
    });

    it('returns empty arrays when no tentative data', () => {
      const patch = buildGlobalMemoryPatch(createSessionMemory('s'));
      expect(patch.confirmedCategoryIds).toHaveLength(0);
      expect(patch.confirmedTags).toHaveLength(0);
    });
  });

  describe('hasTentativeData', () => {
    it('is false for empty session memory', () => {
      expect(hasTentativeData(createSessionMemory('s'))).toBe(false);
    });

    it('is true when merchant is set', () => {
      const m = setTentativeMerchant(createSessionMemory('s'), 'x', 'x');
      expect(hasTentativeData(m)).toBe(true);
    });

    it('is true when category is set', () => {
      const m = addTentativeCategory(createSessionMemory('s'), 'food');
      expect(hasTentativeData(m)).toBe(true);
    });
  });
});

// ── ConversationInspector ─────────────────────────────────────────────────────

describe('conversationInspector', () => {
  describe('inspectConversationSession', () => {
    it('returns basic idle session report', () => {
      const report = inspectConversationSession(makeSession({ status: 'idle' }));
      expect(report.status).toBe('idle');
      expect(report.isTerminal).toBe(false);
      expect(report.hasExpenseContext).toBe(false);
      expect(report.eventCount).toBe(0);
      expect(report.clarificationCount).toBe(0);
    });

    it('reports terminal status correctly', () => {
      const report = inspectConversationSession(makeSession({ status: 'completed' }));
      expect(report.isTerminal).toBe(true);
      expect(report.validNextStatuses).toHaveLength(0);
    });

    it('counts clarifications correctly', () => {
      const s = addClarification(
        addClarification(makeSession(), makeClarification({ id: 'c1' })),
        makeClarification({ id: 'c2' }),
      );
      const resolved = resolveClarification(s, 'c1', 'x', NOW);
      const report = inspectConversationSession(resolved);
      expect(report.clarificationCount).toBe(2);
      expect(report.resolvedClarificationCount).toBe(1);
      expect(report.unresolvedRequiredCount).toBe(1);
    });

    it('reports event kind summary', () => {
      const s = startParsing(makeSession(), 'coffee 50', NOW)!;
      const report = inspectConversationSession(s);
      expect(report.eventKindSummary).toContain('STATUS_CHANGED');
      expect(report.eventKindSummary).toContain('INPUT_RECEIVED');
    });

    it('reports isReadyToConfirm correctly', () => {
      const s = makeSession({
        status: 'confirming',
        expenseContext: { amount: 100 } as any,
        selectedCategories: [makeSelectedCategory()],
      });
      const report = inspectConversationSession(s);
      expect(report.isReadyToConfirm).toBe(true);
    });
  });

  describe('explainTransition', () => {
    it('explains valid transition', () => {
      const explanation = explainTransition('idle', 'parsing');
      expect(explanation.isValid).toBe(true);
      expect(explanation.reason).toContain('пользователь');
    });

    it('marks invalid transition', () => {
      const explanation = explainTransition('completed', 'parsing');
      expect(explanation.isValid).toBe(false);
    });

    it('includes trigger event kind', () => {
      const event = buildConversationEvent('INPUT_RECEIVED', 'x', { input: 'test' }, NOW);
      const explanation = explainTransition('idle', 'parsing', event);
      expect(explanation.triggerEventKind).toBe('INPUT_RECEIVED');
    });
  });

  describe('explainClarification', () => {
    it('explains unknown merchant clarification', () => {
      const c = makeClarification({ kind: 'unknown_merchant' });
      const e = explainClarification(c);
      expect(e.kind).toBe('unknown_merchant');
      expect(e.isRequired).toBe(true);
      expect(e.isResolved).toBe(false);
      expect(e.dominantSignal).toBeTruthy();
      expect(e.advice).toBeTruthy();
    });

    it('marks resolved clarification', () => {
      const c = makeClarification({ resolvedAt: NOW, resolvedWith: 'food-store' });
      const e = explainClarification(c);
      expect(e.isResolved).toBe(true);
      expect(e.resolvedWith).toBe('food-store');
    });
  });

  describe('buildSessionTimeline', () => {
    it('produces timeline strings', () => {
      const s = startParsing(makeSession(), 'coffee 50', NOW)!;
      const timeline = buildSessionTimeline(s);
      expect(timeline.length).toBeGreaterThan(0);
      timeline.forEach((line) => {
        expect(line).toMatch(/^\[\d{2}:\d{2}:\d{2}\]/);
      });
    });

    it('returns empty array for idle session', () => {
      expect(buildSessionTimeline(makeSession())).toHaveLength(0);
    });
  });

  describe('explainLastTransition', () => {
    it('returns null for idle session', () => {
      expect(explainLastTransition(makeSession())).toBeNull();
    });

    it('explains most recent transition', () => {
      const s = startParsing(makeSession(), 'x', NOW)!;
      const explanation = explainLastTransition(s);
      expect(explanation).not.toBeNull();
      expect(explanation!.from).toBe('idle');
      expect(explanation!.to).toBe('parsing');
    });
  });

  describe('explainAllClarifications', () => {
    it('returns explanation for each clarification', () => {
      const s = addClarification(
        addClarification(makeSession(), makeClarification({ id: 'c1' })),
        makeClarification({ id: 'c2', kind: 'missing_amount' }),
      );
      const explanations = explainAllClarifications(s);
      expect(explanations).toHaveLength(2);
      expect(explanations[0].kind).toBe('unknown_merchant');
      expect(explanations[1].kind).toBe('missing_amount');
    });
  });
});

// ── QuickAddBridge ────────────────────────────────────────────────────────────

describe('quickAddBridge', () => {
  describe('sessionStatusToQuickAddStatus', () => {
    it('maps idle → idle', () => {
      expect(sessionStatusToQuickAddStatus(makeSession({ status: 'idle' }))).toBe('idle');
    });

    it('maps parsing → parsing', () => {
      expect(sessionStatusToQuickAddStatus(makeSession({ status: 'parsing' }))).toBe('parsing');
    });

    it('maps clarifying without split → suggesting', () => {
      const s = makeSession({ status: 'clarifying', pendingClarifications: [] });
      expect(sessionStatusToQuickAddStatus(s)).toBe('suggesting');
    });

    it('maps clarifying with ambiguous_split → split_pending', () => {
      const s = addClarification(
        makeSession({ status: 'clarifying' }),
        makeClarification({ kind: 'ambiguous_split' }),
      );
      expect(sessionStatusToQuickAddStatus(s)).toBe('split_pending');
    });

    it('maps confirming → confirmed', () => {
      expect(sessionStatusToQuickAddStatus(makeSession({ status: 'confirming' }))).toBe('confirmed');
    });

    it('maps completed → confirmed', () => {
      expect(sessionStatusToQuickAddStatus(makeSession({ status: 'completed' }))).toBe('confirmed');
    });

    it('maps cancelled → idle', () => {
      expect(sessionStatusToQuickAddStatus(makeSession({ status: 'cancelled' }))).toBe('idle');
    });
  });

  describe('quickAddFromSession', () => {
    it('creates QuickAddState matching session status', () => {
      const s = makeSession({ status: 'parsing', currentInput: 'coffee 50' });
      const qa = quickAddFromSession(s, 0);
      expect(qa.status).toBe('parsing');
      expect(qa.rawInput).toBe('coffee 50');
    });

    it('populates pendingConfirmation when confirmed with category and amount', () => {
      const s = makeSession({
        status: 'confirming',
        currentInput: 'coffee 50',
        expenseContext: { amount: 50, merchant: 'Starbucks', candidateCategories: [] } as any,
        selectedCategories: [makeSelectedCategory({ categoryId: 'food' })],
      });
      const qa = quickAddFromSession(s, 0);
      expect(qa.pendingConfirmation).not.toBeNull();
      expect(qa.pendingConfirmation?.amount).toBe(50);
      expect(qa.pendingConfirmation?.categoryId).toBe('food');
    });

    it('has null pendingConfirmation without selection', () => {
      const s = makeSession({ status: 'confirming' });
      const qa = quickAddFromSession(s, 0);
      expect(qa.pendingConfirmation).toBeNull();
    });
  });

  describe('applyQuickAddToSession', () => {
    it('syncs input and context from QuickAddState to session', () => {
      const session = makeSession({ status: 'idle' });
      const qa = { rawInput: 'coffee 100', context: { amount: 100 } as any, status: 'parsing' as const, liveSuggestions: [], splitPresets: [], pendingConfirmation: null, lastUpdatedAt: 0 };
      const next = applyQuickAddToSession(session, qa, NOW);
      expect(next.currentInput).toBe('coffee 100');
      expect(next.expenseContext).toBeDefined();
    });

    it('does not change session status', () => {
      const session = makeSession({ status: 'idle' });
      const qa = { rawInput: 'x', context: null, status: 'parsing' as const, liveSuggestions: [], splitPresets: [], pendingConfirmation: null, lastUpdatedAt: 0 };
      const next = applyQuickAddToSession(session, qa, NOW);
      expect(next.status).toBe('idle');
    });
  });

  describe('initialQuickAddForSession', () => {
    it('creates idle QuickAdd with session input', () => {
      const s = makeSession({ currentInput: 'test' });
      const qa = initialQuickAddForSession(s);
      expect(qa.status).toBe('idle');
      expect(qa.rawInput).toBe('test');
    });
  });
});
