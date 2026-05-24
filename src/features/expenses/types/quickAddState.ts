/**
 * LAYER: quick add state — architecture foundation for live expense entry UX.
 *
 * Defines the state machine and pure transition functions for the quick add flow:
 *
 *   idle → parsing → suggesting ┬→ confirmed
 *                               └→ split_pending → confirmed
 *
 * This module provides:
 *   QuickAddState   — the full state shape
 *   QuickAddStatus  — state machine enum
 *   PendingExpense  — what gets saved on confirmation
 *   Transition fns  — initialQuickAddState, applyContextToQuickAdd,
 *                     confirmSuggestion, confirmSplitPreset, resetQuickAdd
 *
 * Architecture invariants:
 *   - Pure functions. No Redux. No mutations. No side effects.
 *   - State transitions always return new objects.
 *   - No UI logic. No components. Foundation only.
 *   - Compatible with future debounce/optimistic hooks.
 */

import type { ExpenseContext } from './expenseContext';
import type { ScoredSuggestion } from '../engine/suggestionEngine';
import type { SplitPreset } from '../engine/splitMemoryEngine';
import { SCORING_POLICY } from '../engine/scoringPolicy';

// ── Status ────────────────────────────────────────────────────────────────────

export type QuickAddStatus =
  | 'idle'           // no input or input cleared
  | 'parsing'        // debounce in progress — context not yet available
  | 'suggesting'     // context ready, suggestions visible, awaiting category pick
  | 'split_pending'  // amount + merchant suggest split — awaiting user choice
  | 'confirmed';     // category selected, ready to save

// ── Pending expense ───────────────────────────────────────────────────────────

/** The confirmed expense data ready to be saved. */
export interface PendingExpense {
  amount: number;
  categoryId: string;
  merchant: string | null;
  /** Set when user confirmed a split preset rather than a single category. */
  splitPresetId?: string;
  splitCategoryIds?: string[];
}

// ── State ─────────────────────────────────────────────────────────────────────

export interface QuickAddState {
  rawInput: string;
  status: QuickAddStatus;
  context: ExpenseContext | null;
  liveSuggestions: ScoredSuggestion[];
  splitPresets: SplitPreset[];
  pendingConfirmation: PendingExpense | null;
  lastUpdatedAt: number; // timestamp of last state change
}

// ── Transitions ───────────────────────────────────────────────────────────────

/** Create the initial empty state. */
export function initialQuickAddState(): QuickAddState {
  return {
    rawInput: '',
    status: 'idle',
    context: null,
    liveSuggestions: [],
    splitPresets: [],
    pendingConfirmation: null,
    lastUpdatedAt: 0,
  };
}

/**
 * Apply a freshly built ExpenseContext to the state.
 * Determines the next status based on the context signals.
 */
export function applyContextToQuickAdd(
  state: QuickAddState,
  context: ExpenseContext,
  splitPresets: SplitPreset[] = [],
  now = Date.now(),
): QuickAddState {
  const hasSplit = context.parserContext.splitHints.length > 0;
  const hasPresets = splitPresets.length > 0;
  const goodCategory =
    context.candidateCategories.length > 0 &&
    context.candidateCategories[0].score >= SCORING_POLICY.thresholds.confidentScore;

  let status: QuickAddStatus = 'suggesting';
  if (hasSplit && hasPresets) status = 'split_pending';
  else if (!goodCategory && context.candidateCategories.length > 0) status = 'suggesting';

  return {
    ...state,
    rawInput: context.rawInput,
    status,
    context,
    liveSuggestions: context.candidateCategories.map((c) => ({
      categoryId: c.categoryId,
      score: c.score,
      reasons: [],
    })),
    splitPresets,
    pendingConfirmation: null,
    lastUpdatedAt: now,
  };
}

/**
 * Mark the state as parsing (debounce in progress).
 */
export function markParsing(state: QuickAddState, rawInput: string, now = Date.now()): QuickAddState {
  return { ...state, rawInput, status: 'parsing', lastUpdatedAt: now };
}

/**
 * Confirm a single-category selection.
 * Returns a new state with status 'confirmed' and pendingConfirmation populated.
 */
export function confirmSuggestion(
  state: QuickAddState,
  categoryId: string,
  now = Date.now(),
): QuickAddState {
  if (!state.context || state.context.amount === null) return state;
  return {
    ...state,
    status: 'confirmed',
    pendingConfirmation: {
      amount: state.context.amount,
      categoryId,
      merchant: state.context.merchant,
    },
    lastUpdatedAt: now,
  };
}

/**
 * Confirm a split preset selection.
 */
export function confirmSplitPreset(
  state: QuickAddState,
  preset: SplitPreset,
  now = Date.now(),
): QuickAddState {
  if (!state.context || state.context.amount === null) return state;
  return {
    ...state,
    status: 'confirmed',
    pendingConfirmation: {
      amount: state.context.amount,
      categoryId: preset.categoryIds[0] ?? '',
      merchant: state.context.merchant,
      splitPresetId: preset.id,
      splitCategoryIds: preset.categoryIds,
    },
    lastUpdatedAt: now,
  };
}

/** Reset to initial empty state. */
export function resetQuickAdd(): QuickAddState {
  return initialQuickAddState();
}

// ── Query helpers ─────────────────────────────────────────────────────────────

/** True when the state has a confirmed expense ready to save. */
export function isReadyToSave(state: QuickAddState): boolean {
  return state.status === 'confirmed' && state.pendingConfirmation !== null;
}

/** True when suggestions are available for the user to choose from. */
export function hasSuggestions(state: QuickAddState): boolean {
  return state.liveSuggestions.length > 0;
}

/** True when a split flow is pending. */
export function isSplitPending(state: QuickAddState): boolean {
  return state.status === 'split_pending';
}
