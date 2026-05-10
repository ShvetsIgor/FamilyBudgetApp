import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface BudgetState {
  limits: Record<string, number>; // categoryId → monthly limit
  status: 'idle' | 'ready';
}

const initialState: BudgetState = {
  limits: {},
  status: 'idle',
};

const budgetSlice = createSlice({
  name: 'budget',
  initialState,
  reducers: {
    setBudgets(state, action: PayloadAction<Record<string, number>>) {
      state.limits = action.payload;
      state.status = 'ready';
    },
    setBudgetLimit(state, action: PayloadAction<{ categoryId: string; limit: number }>) {
      const { categoryId, limit } = action.payload;
      if (limit <= 0) {
        delete state.limits[categoryId];
      } else {
        state.limits[categoryId] = limit;
      }
    },
  },
});

export const { setBudgets, setBudgetLimit } = budgetSlice.actions;
export default budgetSlice.reducer;
