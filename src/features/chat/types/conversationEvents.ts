/**
 * LAYER: conversation events — lightweight deterministic event log.
 *
 * ConversationEvent is an append-only record of what happened in a session.
 * This is NOT event sourcing — state is never reconstructed from events.
 * Events exist for: debugging, undo foundation, and session history display.
 *
 * Architecture invariants:
 *   - Pure data. No side effects.
 *   - Append-only. Events are never modified after creation.
 *   - Payloads are plain serializable objects.
 *   - IDs are deterministic within a test context (counter-based).
 */

// ── Event kinds ───────────────────────────────────────────────────────────────

export type ConversationEventKind =
  | 'INPUT_RECEIVED'
  | 'AMOUNT_DETECTED'
  | 'MERCHANT_DETECTED'
  | 'SUGGESTIONS_GENERATED'
  | 'CLARIFICATION_REQUESTED'
  | 'CLARIFICATION_RESOLVED'
  | 'CATEGORY_SELECTED'
  | 'CATEGORY_REVISED'
  | 'SPLIT_INITIATED'
  | 'SPLIT_UPDATED'
  | 'SPLIT_CONFIRMED'
  | 'EXPENSE_CONFIRMED'
  | 'UNDO_TRIGGERED'
  | 'SESSION_CANCELLED'
  | 'STATUS_CHANGED';

// ── Typed payloads ────────────────────────────────────────────────────────────

export interface InputReceivedPayload       { input: string }
export interface AmountDetectedPayload      { amount: number; confidence: number }
export interface MerchantDetectedPayload    { merchant: string; merchantKey: string; isKnown: boolean }
export interface SuggestionsGeneratedPayload { count: number; topCategoryId: string; topScore: number }
export interface ClarificationRequestedPayload { clarificationId: string; kind: string; question: string }
export interface ClarificationResolvedPayload  { clarificationId: string; resolvedWith: string }
export interface CategorySelectedPayload    { categoryId: string; source: 'user' | 'suggestion' | 'habit' }
export interface CategoryRevisedPayload     { previousCategoryId: string; newCategoryId: string }
export interface SplitPayload               { itemCount: number; totalAmount: number }
export interface ExpenseConfirmedPayload    { amount: number; categoryId: string; merchant: string | null }
export interface UndoTriggeredPayload       { revertedEventKind: ConversationEventKind }
export interface StatusChangedPayload       { from: string; to: string; reason: string }

export type ConversationEventPayload =
  | InputReceivedPayload
  | AmountDetectedPayload
  | MerchantDetectedPayload
  | SuggestionsGeneratedPayload
  | ClarificationRequestedPayload
  | ClarificationResolvedPayload
  | CategorySelectedPayload
  | CategoryRevisedPayload
  | SplitPayload
  | ExpenseConfirmedPayload
  | UndoTriggeredPayload
  | StatusChangedPayload
  | Record<string, never>;

// ── Event model ───────────────────────────────────────────────────────────────

export interface ConversationEvent {
  id: string;
  kind: ConversationEventKind;
  timestamp: string;
  sessionId: string;
  payload: ConversationEventPayload;
}

// ── Factory ───────────────────────────────────────────────────────────────────

let _eventCounter = 0;

export function buildConversationEvent(
  kind: ConversationEventKind,
  sessionId: string,
  payload: ConversationEventPayload,
  now = new Date().toISOString(),
): ConversationEvent {
  return {
    id: `evt-${Date.now()}-${++_eventCounter}`,
    kind,
    timestamp: now,
    sessionId,
    payload,
  };
}

export function resetEventCounter(): void {
  _eventCounter = 0;
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getLatestEvent(
  history: ConversationEvent[],
  kind: ConversationEventKind,
): ConversationEvent | undefined {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].kind === kind) return history[i];
  }
  return undefined;
}

export function countEvents(history: ConversationEvent[], kind: ConversationEventKind): number {
  return history.filter((e) => e.kind === kind).length;
}

export function filterEvents(
  history: ConversationEvent[],
  kind: ConversationEventKind,
): ConversationEvent[] {
  return history.filter((e) => e.kind === kind);
}

export function eventsAfter(
  history: ConversationEvent[],
  timestamp: string,
): ConversationEvent[] {
  return history.filter((e) => e.timestamp > timestamp);
}
