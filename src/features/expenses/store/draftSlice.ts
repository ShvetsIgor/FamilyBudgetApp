import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface DraftSplit {
  categoryId: string;
  amount: number;
}

/**
 * Transient expense draft — never persisted to Firestore until explicitly confirmed.
 *
 * Lifecycle: set by QuickAddBar or parsed input → read by FastExpenseEntry on mount →
 * cleared after save or discard.
 */
export interface ExpenseDraft {
  amount?: number;
  merchant?: string;
  categoryId?: string;
  categorySuggestions: string[];
  splits: DraftSplit[];
  note?: string;
  date: string;
  paymentMethod: 'card' | 'cash' | 'other';
}

interface DraftState {
  draft: ExpenseDraft | null;
}

const initialState: DraftState = { draft: null };

const draftSlice = createSlice({
  name: 'draft',
  initialState,
  reducers: {
    setDraft(state, action: PayloadAction<ExpenseDraft>) {
      state.draft = action.payload;
    },
    updateDraft(state, action: PayloadAction<Partial<ExpenseDraft>>) {
      if (state.draft) {
        state.draft = { ...state.draft, ...action.payload };
      }
    },
    clearDraft(state) {
      state.draft = null;
    },
  },
});

export const { setDraft, updateDraft, clearDraft } = draftSlice.actions;
export default draftSlice.reducer;
