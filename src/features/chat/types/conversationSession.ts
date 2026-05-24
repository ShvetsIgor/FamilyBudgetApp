/**
 * LAYER: conversation session — central state container for the conversational expense flow.
 *
 * ConversationSession is the single source of truth for:
 *   - current input and parsed context
 *   - pending clarifications
 *   - category selections and split draft
 *   - suggested actions
 *   - conversation event history (append-only, for debugging and undo)
 *
 * Status machine:
 *   idle → parsing → clarifying → confirming → completed
 *                ╰→ confirming                 (confident parse, no clarification)
 *                                   ╰→ cancelled (at any open status)
 *
 * Architecture invariants:
 *   - Immutable by convention — all transitions return new objects.
 *   - No Redux. No side effects. Pure state container.
 *   - Composed over ExpenseContext — never replaces the parser pipeline.
 *   - History is append-only: used for debugging and undo, not replay.
 *   - ConversationSession is the only state container for the chat expense flow.
 */

import type { ExpenseContext } from '@/features/expenses/types/expenseContext';
import type { ConversationEvent } from './conversationEvents';

// ── Status ────────────────────────────────────────────────────────────────────

export type SessionStatus =
  | 'idle'
  | 'parsing'
  | 'clarifying'
  | 'confirming'
  | 'completed'
  | 'cancelled';

// ── Supporting types ──────────────────────────────────────────────────────────

export type ClarificationKind =
  | 'unknown_merchant'
  | 'ambiguous_category'
  | 'ambiguous_split'
  | 'missing_amount'
  | 'conflicting_signals';

export interface ClarificationOption {
  id: string;
  label: string;
  value: string;
}

export interface PendingClarification {
  id: string;
  kind: ClarificationKind;
  question: string;
  options?: ClarificationOption[];
  isRequired: boolean;
  resolvedAt?: string;
  resolvedWith?: string;
}

export interface SelectedCategory {
  categoryId: string;
  confidence: number;
  source: 'user' | 'suggestion' | 'habit';
}

export interface SplitDraftItem {
  id: string;
  label: string;
  categoryId: string | null;
  amount: number;
  isResolved: boolean;
}

export interface SplitDraft {
  items: SplitDraftItem[];
  totalAmount: number;
  isBalanced: boolean;
}

export interface SuggestedAction {
  id: string;
  kind: 'confirm' | 'clarify' | 'split' | 'cancel' | 'undo' | 'revise';
  label: string;
  priority: 'high' | 'medium' | 'low';
}

// ── Main model ────────────────────────────────────────────────────────────────

export interface ConversationSession {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: SessionStatus;
  currentInput: string;
  expenseContext?: ExpenseContext;
  pendingClarifications: PendingClarification[];
  selectedCategories: SelectedCategory[];
  splitDraft?: SplitDraft;
  suggestedActions: SuggestedAction[];
  history: ConversationEvent[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

let _sessionCounter = 0;

export function createConversationSession(now = new Date().toISOString()): ConversationSession {
  return {
    id: `session-${Date.now()}-${++_sessionCounter}`,
    createdAt: now,
    updatedAt: now,
    status: 'idle',
    currentInput: '',
    expenseContext: undefined,
    pendingClarifications: [],
    selectedCategories: [],
    splitDraft: undefined,
    suggestedActions: [],
    history: [],
  };
}

// ── Clarification mutation helpers ────────────────────────────────────────────

export function addClarification(
  session: ConversationSession,
  clarification: PendingClarification,
  now = new Date().toISOString(),
): ConversationSession {
  return {
    ...session,
    updatedAt: now,
    pendingClarifications: [...session.pendingClarifications, clarification],
  };
}

export function resolveClarification(
  session: ConversationSession,
  clarificationId: string,
  resolvedWith: string,
  now = new Date().toISOString(),
): ConversationSession {
  return {
    ...session,
    updatedAt: now,
    pendingClarifications: session.pendingClarifications.map((c) =>
      c.id === clarificationId ? { ...c, resolvedAt: now, resolvedWith } : c,
    ),
  };
}

// ── Category selection helpers ────────────────────────────────────────────────

export function selectCategory(
  session: ConversationSession,
  category: SelectedCategory,
  now = new Date().toISOString(),
): ConversationSession {
  const without = session.selectedCategories.filter((c) => c.categoryId !== category.categoryId);
  return {
    ...session,
    updatedAt: now,
    selectedCategories: [category, ...without],
  };
}

export function clearSelectedCategories(
  session: ConversationSession,
  now = new Date().toISOString(),
): ConversationSession {
  return { ...session, updatedAt: now, selectedCategories: [] };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function isSessionOpen(session: ConversationSession): boolean {
  return session.status !== 'completed' && session.status !== 'cancelled';
}

export function hasUnresolvedClarifications(session: ConversationSession): boolean {
  return session.pendingClarifications.some((c) => !c.resolvedAt && c.isRequired);
}

export function hasSplitDraft(session: ConversationSession): boolean {
  return session.splitDraft !== undefined && session.splitDraft.items.length > 0;
}

export function isReadyToConfirm(session: ConversationSession): boolean {
  if (session.status !== 'confirming') return false;
  if (hasUnresolvedClarifications(session)) return false;
  if (session.selectedCategories.length === 0) return false;
  if ((session.expenseContext?.amount ?? null) === null) return false;
  return true;
}

export function unresolvedClarifications(session: ConversationSession): PendingClarification[] {
  return session.pendingClarifications.filter((c) => !c.resolvedAt);
}
