/**
 * LAYER: transient input session state.
 *
 * An ExpenseInputSession is NOT a persisted expense.
 * It lives only as long as the user is in an active input flow.
 *
 * Lifecycle:
 *   idle → typing (processInput called) →
 *   parsing / clarification / editing / split →
 *   confirm (user taps save) →
 *   saved  (save completed — briefly shown for UX feedback) →
 *   clear  (session destroyed after saved timeout)
 *
 * Sessions are never written to Firestore.
 * Clearing a session does not cancel an in-flight save — they're independent.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ScoredSuggestion } from '../engine/suggestionEngine';

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
        state.session.stage = action.payload;
      }
    },

    /** Transition to 'saved' — use for post-save UX feedback. Auto-clear via useExpenseInputFlow. */
    markSaved(state) {
      if (state.session) {
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
