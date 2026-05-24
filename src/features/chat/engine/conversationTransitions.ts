/**
 * LAYER: conversation transitions — explicit, validated state machine for ConversationSession.
 *
 * All session status changes MUST go through this module.
 * No implicit mutations. No hidden transitions.
 *
 * Valid transition graph:
 *   idle       → parsing | cancelled
 *   parsing    → clarifying | confirming | cancelled
 *   clarifying → confirming | parsing | cancelled
 *   confirming → completed | clarifying | cancelled
 *   completed  → (terminal)
 *   cancelled  → (terminal)
 *
 * Architecture invariants:
 *   - Pure functions. No side effects. No Redux.
 *   - canTransition() is the gatekeeper — always validate before applying.
 *   - Transitions append STATUS_CHANGED to session history.
 *   - Terminal states (completed, cancelled) cannot be transitioned out of.
 *   - applyTransition() returns null for invalid transitions — never throws.
 */

import type { ConversationSession, SessionStatus } from '../types/conversationSession';
import { buildConversationEvent } from '../types/conversationEvents';

// ── Transition table ──────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Readonly<Record<SessionStatus, SessionStatus[]>> = {
  idle:       ['parsing', 'cancelled'],
  parsing:    ['clarifying', 'confirming', 'cancelled'],
  clarifying: ['confirming', 'parsing', 'cancelled'],
  confirming: ['completed', 'clarifying', 'cancelled'],
  completed:  [],
  cancelled:  [],
};

// ── Public API ────────────────────────────────────────────────────────────────

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function validNextStatuses(status: SessionStatus): SessionStatus[] {
  return [...(VALID_TRANSITIONS[status] ?? [])];
}

export function isTerminalStatus(status: SessionStatus): boolean {
  return (VALID_TRANSITIONS[status]?.length ?? 0) === 0;
}

/**
 * Apply a status transition. Returns null if the transition is invalid.
 * Appends STATUS_CHANGED to session.history.
 */
export function applyTransition(
  session: ConversationSession,
  toStatus: SessionStatus,
  reason: string,
  now = new Date().toISOString(),
): ConversationSession | null {
  if (!canTransition(session.status, toStatus)) return null;

  const event = buildConversationEvent(
    'STATUS_CHANGED',
    session.id,
    { from: session.status, to: toStatus, reason },
    now,
  );

  return {
    ...session,
    status: toStatus,
    updatedAt: now,
    history: [...session.history, event],
  };
}

// ── Named semantic transitions ────────────────────────────────────────────────

/**
 * idle → parsing: user started input.
 * Appends INPUT_RECEIVED event in addition to STATUS_CHANGED.
 */
export function startParsing(
  session: ConversationSession,
  input: string,
  now = new Date().toISOString(),
): ConversationSession | null {
  const next = applyTransition(session, 'parsing', 'input received', now);
  if (!next) return null;
  const inputEvent = buildConversationEvent('INPUT_RECEIVED', session.id, { input }, now);
  return {
    ...next,
    currentInput: input,
    history: [...next.history, inputEvent],
  };
}

/**
 * parsing | confirming → clarifying: ambiguous signals require user input.
 */
export function requestClarification(
  session: ConversationSession,
  reason: string,
  now = new Date().toISOString(),
): ConversationSession | null {
  return applyTransition(session, 'clarifying', reason, now);
}

/**
 * parsing | clarifying → confirming: context is ready, suggest confirmation.
 */
export function readyToConfirm(
  session: ConversationSession,
  reason: string,
  now = new Date().toISOString(),
): ConversationSession | null {
  return applyTransition(session, 'confirming', reason, now);
}

/**
 * confirming → completed: expense saved.
 */
export function completeSession(
  session: ConversationSession,
  now = new Date().toISOString(),
): ConversationSession | null {
  const next = applyTransition(session, 'completed', 'expense confirmed', now);
  if (!next) return null;
  const confirmEvent = buildConversationEvent(
    'EXPENSE_CONFIRMED',
    session.id,
    {},
    now,
  );
  return { ...next, history: [...next.history, confirmEvent] };
}

/**
 * any open → cancelled: user or system cancelled.
 */
export function cancelSession(
  session: ConversationSession,
  reason = 'user cancelled',
  now = new Date().toISOString(),
): ConversationSession | null {
  const next = applyTransition(session, 'cancelled', reason, now);
  if (!next) return null;
  const cancelEvent = buildConversationEvent('SESSION_CANCELLED', session.id, {}, now);
  return { ...next, history: [...next.history, cancelEvent] };
}

/**
 * clarifying → parsing: user revised their input — re-parse from scratch.
 * Clears pending clarifications since the context will be rebuilt.
 */
export function reparseSession(
  session: ConversationSession,
  newInput: string,
  now = new Date().toISOString(),
): ConversationSession | null {
  const next = applyTransition(session, 'parsing', 'input revised', now);
  if (!next) return null;
  const inputEvent = buildConversationEvent('INPUT_RECEIVED', session.id, { input: newInput }, now);
  return {
    ...next,
    currentInput: newInput,
    pendingClarifications: [],
    history: [...next.history, inputEvent],
  };
}
