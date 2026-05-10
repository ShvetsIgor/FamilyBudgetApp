import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SavingsGoal } from '@/shared/types';

interface SavingsState {
  list: SavingsGoal[];
  status: 'idle' | 'loading' | 'ready';
}

const savingsSlice = createSlice({
  name: 'savings',
  initialState: { list: [], status: 'idle' } as SavingsState,
  reducers: {
    setGoals(state, action: PayloadAction<SavingsGoal[]>) {
      state.list = action.payload;
      state.status = 'ready';
    },
    addGoalItem(state, action: PayloadAction<SavingsGoal>) {
      state.list.unshift(action.payload);
    },
    updateGoalItem(state, action: PayloadAction<SavingsGoal>) {
      const idx = state.list.findIndex((g) => g.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
    },
    removeGoalItem(state, action: PayloadAction<string>) {
      state.list = state.list.filter((g) => g.id !== action.payload);
    },
  },
});

export const { setGoals, addGoalItem, updateGoalItem, removeGoalItem } = savingsSlice.actions;
export default savingsSlice.reducer;
