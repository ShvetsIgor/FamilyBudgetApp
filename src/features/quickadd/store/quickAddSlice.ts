import { createSlice, PayloadAction } from '@reduxjs/toolkit';

type QuickAddTab = 'expense' | 'income' | 'savings';

interface QuickAddPrefill {
  goalId?: string;
  sourceId?: string;
  parentId?: string;
  amount?: number;
}

interface QuickAddState {
  open: boolean;
  tab: QuickAddTab;
  prefill?: QuickAddPrefill;
}

const initialState: QuickAddState = {
  open: false,
  tab: 'expense',
};

const quickAddSlice = createSlice({
  name: 'quickAdd',
  initialState,
  reducers: {
    openQuickAdd(state, action: PayloadAction<{ tab: QuickAddTab; prefill?: QuickAddPrefill }>) {
      state.open = true;
      state.tab = action.payload.tab;
      state.prefill = action.payload.prefill;
    },
    closeQuickAdd(state) {
      state.open = false;
      state.prefill = undefined;
    },
    setQuickAddTab(state, action: PayloadAction<QuickAddTab>) {
      state.tab = action.payload;
    },
  },
});

export const { openQuickAdd, closeQuickAdd, setQuickAddTab } = quickAddSlice.actions;
export default quickAddSlice.reducer;
