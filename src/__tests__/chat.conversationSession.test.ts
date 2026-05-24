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

