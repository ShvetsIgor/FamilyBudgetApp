/**
 * LAYER: expense draft — mutable working copy of an expense before confirmation.
 *
 * ExpenseDraft bridges:
 *   parsed input (ExpenseContext) → confirmed expense (Expense to be saved)
 *
 * An expense draft:
 *   - holds parsed amount, selected categories, split data
 *   - tracks unresolved ambiguities
 *   - records revision history for undo support
 *   - is never final until explicitly confirmed
 *
 * Architecture invariants:
 *   - Pure data type. No side effects. No Redux.
 *   - All mutations return new objects — no in-place edits.
 *   - A draft without amount OR without categories cannot be confirmed.
 *   - Split items are pre-confirmation — they do not create Expense records.
 *   - revisionHistory is append-only: undoLastRevision returns metadata, not state.
 */

// ── Supporting types ──────────────────────────────────────────────────────────

export interface DraftCategory {
  categoryId: string;
  label: string;
  confidence: number;
  source: 'user' | 'suggestion' | 'habit' | 'split';
}

export interface DraftSplitItem {
  id: string;
  label: string;
  categoryId: string | null;
  amount: number;
  isResolved: boolean;
}

export type DraftRevisionKind =
  | 'amount_changed'
  | 'category_changed'
  | 'category_added'
  | 'split_initiated'
  | 'split_item_updated'
  | 'split_item_removed'
  | 'merchant_set'
  | 'comment_changed';

export interface DraftRevision {
  id: string;
  kind: DraftRevisionKind;
  timestamp: string;
  previousValue: unknown;
  newValue: unknown;
}

// ── Main model ────────────────────────────────────────────────────────────────

export interface ExpenseDraft {
  id: string;
  sessionId: string;
  amount: number | null;
  categories: DraftCategory[];
  merchant: string | null;
  merchantKey: string | null;
  date: string;
  comment: string;
  isSplit: boolean;
  splitItems: DraftSplitItem[];
  unresolvedAmbiguities: string[];
  isConfirmed: boolean;
  revisionHistory: DraftRevision[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

let _draftCounter = 0;
let _revisionCounter = 0;

export function createExpenseDraft(
  sessionId: string,
  date = new Date().toISOString().slice(0, 10),
): ExpenseDraft {
  return {
    id: `draft-${Date.now()}-${++_draftCounter}`,
    sessionId,
    amount: null,
    categories: [],
    merchant: null,
    merchantKey: null,
    date,
    comment: '',
    isSplit: false,
    splitItems: [],
    unresolvedAmbiguities: [],
    isConfirmed: false,
    revisionHistory: [],
  };
}

// ── Mutation helpers (all return new objects) ─────────────────────────────────

export function setDraftAmount(
  draft: ExpenseDraft,
  amount: number,
  now = new Date().toISOString(),
): ExpenseDraft {
  const revision: DraftRevision = {
    id: `rev-${++_revisionCounter}`,
    kind: 'amount_changed',
    timestamp: now,
    previousValue: draft.amount,
    newValue: amount,
  };
  return { ...draft, amount, revisionHistory: [...draft.revisionHistory, revision] };
}

export function setDraftCategory(
  draft: ExpenseDraft,
  category: DraftCategory,
  now = new Date().toISOString(),
): ExpenseDraft {
  const previous = draft.categories[0] ?? null;
  const kind: DraftRevisionKind = draft.categories.length === 0 ? 'category_added' : 'category_changed';
  const revision: DraftRevision = {
    id: `rev-${++_revisionCounter}`,
    kind,
    timestamp: now,
    previousValue: previous,
    newValue: category,
  };
  return {
    ...draft,
    categories: [category, ...draft.categories.slice(1)],
    revisionHistory: [...draft.revisionHistory, revision],
  };
}

export function setDraftMerchant(
  draft: ExpenseDraft,
  merchant: string,
  merchantKey: string,
  now = new Date().toISOString(),
): ExpenseDraft {
  const revision: DraftRevision = {
    id: `rev-${++_revisionCounter}`,
    kind: 'merchant_set',
    timestamp: now,
    previousValue: draft.merchant,
    newValue: merchant,
  };
  return { ...draft, merchant, merchantKey, revisionHistory: [...draft.revisionHistory, revision] };
}

export function initDraftSplit(
  draft: ExpenseDraft,
  items: DraftSplitItem[],
  now = new Date().toISOString(),
): ExpenseDraft {
  const revision: DraftRevision = {
    id: `rev-${++_revisionCounter}`,
    kind: 'split_initiated',
    timestamp: now,
    previousValue: null,
    newValue: items,
  };
  return {
    ...draft,
    isSplit: true,
    splitItems: items,
    revisionHistory: [...draft.revisionHistory, revision],
  };
}

export function updateDraftSplitItem(
  draft: ExpenseDraft,
  itemId: string,
  patch: Partial<DraftSplitItem>,
  now = new Date().toISOString(),
): ExpenseDraft {
  const previous = draft.splitItems.find((i) => i.id === itemId);
  const updated = draft.splitItems.map((item) =>
    item.id === itemId ? { ...item, ...patch } : item,
  );
  const revision: DraftRevision = {
    id: `rev-${++_revisionCounter}`,
    kind: 'split_item_updated',
    timestamp: now,
    previousValue: previous ?? null,
    newValue: updated.find((i) => i.id === itemId) ?? null,
  };
  return { ...draft, splitItems: updated, revisionHistory: [...draft.revisionHistory, revision] };
}

export function removeDraftSplitItem(
  draft: ExpenseDraft,
  itemId: string,
  now = new Date().toISOString(),
): ExpenseDraft {
  const removed = draft.splitItems.find((i) => i.id === itemId);
  const revision: DraftRevision = {
    id: `rev-${++_revisionCounter}`,
    kind: 'split_item_removed',
    timestamp: now,
    previousValue: removed ?? null,
    newValue: null,
  };
  return {
    ...draft,
    splitItems: draft.splitItems.filter((i) => i.id !== itemId),
    revisionHistory: [...draft.revisionHistory, revision],
  };
}

export function setDraftComment(
  draft: ExpenseDraft,
  comment: string,
  now = new Date().toISOString(),
): ExpenseDraft {
  const revision: DraftRevision = {
    id: `rev-${++_revisionCounter}`,
    kind: 'comment_changed',
    timestamp: now,
    previousValue: draft.comment,
    newValue: comment,
  };
  return { ...draft, comment, revisionHistory: [...draft.revisionHistory, revision] };
}

export function confirmDraft(draft: ExpenseDraft): ExpenseDraft {
  return { ...draft, isConfirmed: true };
}

/**
 * Remove the last revision entry.
 * The caller is responsible for re-applying the previous value from revision.previousValue.
 * Returns null if no revision history to undo.
 */
export function undoLastRevision(draft: ExpenseDraft): { draft: ExpenseDraft; undone: DraftRevision } | null {
  if (draft.revisionHistory.length === 0) return null;
  const undone = draft.revisionHistory[draft.revisionHistory.length - 1];
  return {
    draft: { ...draft, revisionHistory: draft.revisionHistory.slice(0, -1) },
    undone,
  };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function isDraftConfirmable(draft: ExpenseDraft): boolean {
  return (
    draft.amount !== null &&
    draft.amount > 0 &&
    draft.categories.length > 0 &&
    draft.unresolvedAmbiguities.length === 0 &&
    !draft.isConfirmed
  );
}

export function isDraftSplitBalanced(draft: ExpenseDraft): boolean {
  if (!draft.isSplit || draft.amount === null) return true;
  const total = draft.splitItems.reduce((sum, item) => sum + item.amount, 0);
  return Math.abs(total - draft.amount) < 0.01;
}

export function draftSplitResolvedCount(draft: ExpenseDraft): number {
  return draft.splitItems.filter((i) => i.isResolved).length;
}

export function draftPrimaryCategory(draft: ExpenseDraft): DraftCategory | null {
  return draft.categories[0] ?? null;
}

export function resetDraftCounters(): void {
  _draftCounter = 0;
  _revisionCounter = 0;
}
