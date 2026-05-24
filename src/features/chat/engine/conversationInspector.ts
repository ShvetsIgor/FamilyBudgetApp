/**
 * LAYER: conversation inspector — debug and explainability utilities.
 *
 * Provides human-readable explanations of:
 *   - current session state and event history
 *   - why a status transition occurred
 *   - why a clarification was requested
 *   - which signals influenced the session flow
 *
 * Used for: debug panels, test assertions, logging.
 *
 * Architecture Audit Note (TASK 10):
 *   The following files in expenses/engine are consolidation candidates —
 *   they contain debugging utilities that partially overlap this layer:
 *     - workflowBridge.ts (replayWorkflow, inspectWorkflowTransitions — SemanticSession level)
 *     - policyBridge.ts (compareStrategies, inspectEscalationPath — policy level)
 *     - constructorBridge.ts (buildSessionTimeline — uses semanticEventTimeline)
 *   These operate on SemanticSession (lower-level parser/resolution context).
 *   This inspector operates on ConversationSession (higher-level UI/UX context).
 *   They serve different purposes and should remain separate.
 *
 * Architecture invariants:
 *   - Pure functions. No side effects.
 *   - Output is plain data only — no rendering.
 *   - Depends on ConversationSession and ExpenseContext.
 */

import type { ConversationSession, PendingClarification, SessionStatus } from '../types/conversationSession';
import type { ConversationEvent } from '../types/conversationEvents';
import type { StatusChangedPayload } from '../types/conversationEvents';
import { inspectExpenseContext } from '@/features/expenses/engine/suggestionInspector';
import { isTerminalStatus, validNextStatuses, canTransition } from './conversationTransitions';

// ── Report types ──────────────────────────────────────────────────────────────

export interface SessionInspectionReport {
  sessionId: string;
  status: SessionStatus;
  isTerminal: boolean;
  validNextStatuses: SessionStatus[];
  inputSummary: string;
  eventCount: number;
  eventKindSummary: string;
  clarificationCount: number;
  resolvedClarificationCount: number;
  unresolvedRequiredCount: number;
  hasExpenseContext: boolean;
  expenseContextSummary?: string;
  selectedCategoryIds: string[];
  hasSplitDraft: boolean;
  suggestedActionKinds: string[];
  lastEventKind: string | null;
  isReadyToConfirm: boolean;
}

export interface TransitionExplanation {
  from: SessionStatus;
  to: SessionStatus;
  isValid: boolean;
  reason: string;
  triggerEventKind: string | null;
}

export interface ClarificationExplanation {
  id: string;
  kind: string;
  question: string;
  isRequired: boolean;
  isResolved: boolean;
  resolvedWith?: string;
  dominantSignal: string;
  advice: string;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function inspectConversationSession(session: ConversationSession): SessionInspectionReport {
  const eventKindCounts = countEventKinds(session.history);
  const eventKindSummary = Object.entries(eventKindCounts)
    .map(([k, v]) => `${k}×${v}`)
    .join(' ');

  const lastEvent = session.history[session.history.length - 1] ?? null;

  const resolvedClarifications = session.pendingClarifications.filter((c) => !!c.resolvedAt).length;
  const unresolvedRequired = session.pendingClarifications.filter((c) => !c.resolvedAt && c.isRequired).length;

  let expenseContextSummary: string | undefined;
  if (session.expenseContext) {
    try {
      expenseContextSummary = inspectExpenseContext(session.expenseContext).summary;
    } catch {
      expenseContextSummary = '(inspection error)';
    }
  }

  const isReadyToConfirm =
    session.status === 'confirming' &&
    unresolvedRequired === 0 &&
    session.selectedCategories.length > 0 &&
    (session.expenseContext?.amount ?? null) !== null;

  return {
    sessionId: session.id,
    status: session.status,
    isTerminal: isTerminalStatus(session.status),
    validNextStatuses: validNextStatuses(session.status),
    inputSummary: session.currentInput || '(empty)',
    eventCount: session.history.length,
    eventKindSummary,
    clarificationCount: session.pendingClarifications.length,
    resolvedClarificationCount: resolvedClarifications,
    unresolvedRequiredCount: unresolvedRequired,
    hasExpenseContext: session.expenseContext !== undefined,
    expenseContextSummary,
    selectedCategoryIds: session.selectedCategories.map((c) => c.categoryId),
    hasSplitDraft: session.splitDraft !== undefined,
    suggestedActionKinds: session.suggestedActions.map((a) => a.kind),
    lastEventKind: lastEvent?.kind ?? null,
    isReadyToConfirm,
  };
}

export function explainTransition(
  from: SessionStatus,
  to: SessionStatus,
  triggerEvent?: ConversationEvent,
): TransitionExplanation {
  const isValid = canTransition(from, to);
  const reason = TRANSITION_REASONS[`${from}→${to}`] ?? 'переход не описан';

  return {
    from,
    to,
    isValid,
    reason,
    triggerEventKind: triggerEvent?.kind ?? null,
  };
}

export function explainClarification(clarification: PendingClarification): ClarificationExplanation {
  return {
    id: clarification.id,
    kind: clarification.kind,
    question: clarification.question,
    isRequired: clarification.isRequired,
    isResolved: !!clarification.resolvedAt,
    resolvedWith: clarification.resolvedWith,
    dominantSignal: CLARIFICATION_SIGNALS[clarification.kind] ?? 'нет данных',
    advice: CLARIFICATION_ADVICE[clarification.kind] ?? 'уточните детали',
  };
}

/**
 * Build a human-readable timeline of session events.
 */
export function buildSessionTimeline(session: ConversationSession): string[] {
  return session.history.map((event) => {
    const ts = event.timestamp.slice(11, 19);
    return `[${ts}] ${event.kind}`;
  });
}

/**
 * Find and explain the most recent STATUS_CHANGED event.
 */
export function explainLastTransition(session: ConversationSession): TransitionExplanation | null {
  const statusEvents = session.history.filter((e) => e.kind === 'STATUS_CHANGED');
  if (statusEvents.length === 0) return null;
  const last = statusEvents[statusEvents.length - 1];
  const payload = last.payload as StatusChangedPayload;
  return explainTransition(payload.from as SessionStatus, payload.to as SessionStatus, last);
}

/**
 * Explain all pending clarifications.
 */
export function explainAllClarifications(session: ConversationSession): ClarificationExplanation[] {
  return session.pendingClarifications.map(explainClarification);
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const TRANSITION_REASONS: Record<string, string> = {
  'idle→parsing':         'пользователь начал ввод',
  'idle→cancelled':       'сессия отменена без ввода',
  'parsing→clarifying':   'обнаружены неоднозначные сигналы — требуется уточнение',
  'parsing→confirming':   'контекст разобран уверенно — готов к подтверждению',
  'parsing→cancelled':    'пользователь отменил ввод во время разбора',
  'clarifying→confirming':'все уточнения получены',
  'clarifying→parsing':   'пользователь изменил ввод — повторный разбор',
  'clarifying→cancelled': 'пользователь отменил в процессе уточнения',
  'confirming→completed': 'расход подтверждён и сохранён',
  'confirming→clarifying':'требуется дополнительное уточнение',
  'confirming→cancelled': 'пользователь отменил перед сохранением',
};

const CLARIFICATION_SIGNALS: Record<string, string> = {
  unknown_merchant:      'мерчант не найден в памяти',
  ambiguous_category:    'несколько категорий с близким весом',
  ambiguous_split:       'несколько товаров без чёткого разделения',
  missing_amount:        'сумма не найдена во вводе',
  conflicting_signals:   'противоречивые сигналы от разных источников',
};

const CLARIFICATION_ADVICE: Record<string, string> = {
  unknown_merchant:      'укажите категорию вручную или добавьте мерчант в память',
  ambiguous_category:    'выберите подходящую категорию из предложенных',
  ambiguous_split:       'разделите позиции по категориям',
  missing_amount:        'добавьте сумму к вводу',
  conflicting_signals:   'уточните мерчант или категорию',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function countEventKinds(history: ConversationEvent[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of history) {
    counts[event.kind] = (counts[event.kind] ?? 0) + 1;
  }
  return counts;
}
