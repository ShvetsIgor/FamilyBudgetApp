/**
 * LAYER: transient input session state.
 *
 * An ExpenseInputSession is NOT a persisted expense.
 * It lives only as long as the user is in an active input flow.
 *
 * Stage lifecycle with branching:
 *
 *   idle
 *     ↓ (processInput called)
 *   parsing          — input received, amount not yet detected
 *     ↓ (amount detected)
 *   clarification    — amount detected, suggestions ambiguous
 *   ├─→ split        — user requests split (requestSplit) OR large amount, no confident winner
 *   └─→ confirm      — user picks a category from clarification → saveWithCategory
 *   editing          — no memory signal, user picks manually from full grid
 *   confirm          — clear winner → one-tap save
 *     ↓ (saveWithCategory)
 *   saved            — save completed — shown briefly for UX feedback
 *     ↓ (auto-clear after 1200ms)
 *   null (idle)
 *
 * Branching invariants:
 *   - split can be entered from clarification or directly when large amount + no confident winner
 *   - previousStage records which stage preceded a branch (for UX context)
 *   - clearSession always resets to null — no stale branch state can accumulate
 *
 * Sessions are never written to Firestore.
 * Clearing a session does not cancel an in-flight save — they're independent.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ScoredSuggestion } from '../engine/suggestionEngine';
import type { DetectedIntent } from '../engine/intentDetector';

export type InputStage =
  | 'idle'
  | 'parsing'       // input received, amount not yet detected
  | 'clarification' // amount detected, suggestions ambiguous
  | 'editing'       // user in full numpad entry (no memory signal)
  | 'split'         // large amount or explicit split request
  | 'confirm'       // clear winner, ready for one-tap save
  | 'saved';        // save completed — shown briefly for feedback, then session cleared

export interface ExpenseInputSession {
  rawInput: string;
  detectedMerchant?: string;
  detectedAmount?: number;
  suggestions: ScoredSuggestion[];
  stage: InputStage;
  /** Records which stage preceded a branch transition (split/confirm from clarification). */
  previousStage?: InputStage;
  /**
   * Non-expense intent detected from the raw input (e.g. income, transfer, recurring).
   * Null means the input is treated as an expense (the default).
   * Advisory only — does not affect stage machine or ranking.
   */
  detectedIntent?: DetectedIntent | null;
}

interface InputSessionState {
  session: ExpenseInputSession | null;
}

const initialState: InputSessionState = { session: null };

const inputSessionSlice = createSlice({
  name: 'inputSession',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<ExpenseInputSession>) {
      state.session = action.payload;
    },

    advanceStage(state, action: PayloadAction<InputStage>) {
      if (state.session) {
        state.session.previousStage = state.session.stage;
        state.session.stage = action.payload;
      }
    },

    /** Transition to 'saved' — use for post-save UX feedback. Auto-clear via useExpenseInputFlow. */
    markSaved(state) {
      if (state.session) {
        state.session.previousStage = state.session.stage;
        state.session.stage = 'saved';
      }
    },

    clearSession(state) {
      state.session = null;
    },
  },
});

export const { setSession, advanceStage, markSaved, clearSession } = inputSessionSlice.actions;
export default inputSessionSlice.reducer;
