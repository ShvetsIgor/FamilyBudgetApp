/**
 * LAYER: quick add bridge — sync between QuickAddState and ConversationSession.
 *
 * QuickAdd is the UI-facing input layer (fast path, no chat).
 * ConversationSession is the authoritative state container.
 * This bridge ensures QuickAdd is a UI projection of session state,
 * not a separate source of truth.
 *
 * Status mapping:
 *   'idle'          ↔ 'idle'
 *   'parsing'       ↔ 'parsing'
 *   'suggesting'    ← 'clarifying' (no split clarification)
 *   'split_pending' ← 'clarifying' (has ambiguous_split clarification)
 *   'confirmed'     ← 'confirming' | 'completed'
 *   'idle'          ← 'cancelled'
 *
 * Architecture invariants:
 *   - Pure functions. No Redux. No mutations. No side effects.
 *   - QuickAddState is always DERIVED FROM ConversationSession, not the reverse.
 *   - applyQuickAddToSession() patches session input/context only — status
 *     transitions must go through conversationTransitions.ts.
 *   - Never creates circular imports.
 */

import type { ConversationSession } from '../types/conversationSession';
import type { QuickAddState, QuickAddStatus, ScoredSuggestion } from '@/features/expenses/types/quickAddState';
import { initialQuickAddState } from '@/features/expenses/types/quickAddState';

// ── Status mapping ────────────────────────────────────────────────────────────

export function sessionStatusToQuickAddStatus(session: ConversationSession): QuickAddStatus {
  switch (session.status) {
    case 'idle':
      return 'idle';
    case 'parsing':
      return 'parsing';
    case 'clarifying': {
      const hasSplitClarification = session.pendingClarifications.some(
        (c) => c.kind === 'ambiguous_split',
      );
      return hasSplitClarification ? 'split_pending' : 'suggesting';
    }
    case 'confirming':
    case 'completed':
      return 'confirmed';
    case 'cancelled':
      return 'idle';
  }
}

// ── Session → QuickAddState (authoritative direction) ─────────────────────────

/**
 * Derive a QuickAddState from a ConversationSession.
 * QuickAddState is always secondary — ConversationSession is authoritative.
 */
export function quickAddFromSession(
  session: ConversationSession,
  now = Date.now(),
): QuickAddState {
  const status = sessionStatusToQuickAddStatus(session);
  const context = session.expenseContext ?? null;

  const liveSuggestions: ScoredSuggestion[] = (context?.candidateCategories ?? []).map((c) => ({
    categoryId: c.categoryId,
    score: c.score,
    reasons: [],
  }));

  const firstCategory = session.selectedCategories[0];
  const pendingConfirmation =
    status === 'confirmed' &&
    firstCategory &&
    context?.amount !== null &&
    context?.amount !== undefined
      ? {
          amount: context.amount,
          categoryId: firstCategory.categoryId,
          merchant: context.merchant ?? null,
        }
      : null;

  return {
    rawInput: session.currentInput,
    status,
    context,
    liveSuggestions,
    splitPresets: [],
    pendingConfirmation,
    lastUpdatedAt: now,
  };
}

// ── QuickAddState → session patch (input-driven update) ───────────────────────

/**
 * Apply a QuickAdd input update to a session.
 * Only syncs input text and expense context — does NOT change session status.
 * Status transitions must go through conversationTransitions.ts.
 */
export function applyQuickAddToSession(
  session: ConversationSession,
  quickAdd: QuickAddState,
  now = new Date().toISOString(),
): ConversationSession {
  return {
    ...session,
    currentInput: quickAdd.rawInput,
    expenseContext: quickAdd.context ?? session.expenseContext,
    updatedAt: now,
  };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function initialQuickAddForSession(session: ConversationSession): QuickAddState {
  return {
    ...initialQuickAddState(),
    rawInput: session.currentInput,
  };
}
