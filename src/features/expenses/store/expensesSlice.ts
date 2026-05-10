import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Expense } from '@/shared/types';

interface ExpensesState {
  list: Expense[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  hasMore: boolean;
  error: string | null;
}

const initialState: ExpensesState = {
  list: [],
  status: 'idle',
  hasMore: true,
  error: null,
};

const expensesSlice = createSlice({
  name: 'expenses',
  initialState,
  reducers: {
    setExpenses(state, action: PayloadAction<Expense[]>) {
      state.list = action.payload;
      state.status = 'ready';
    },
    prependExpense(state, action: PayloadAction<Expense>) {
      state.list.unshift(action.payload);
    },
    updateExpense(state, action: PayloadAction<Expense>) {
      const idx = state.list.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
    },
    removeExpense(state, action: PayloadAction<string>) {
      state.list = state.list.filter((e) => e.id !== action.payload);
    },
    setStatus(state, action: PayloadAction<ExpensesState['status']>) {
      state.status = action.payload;
    },
    setHasMore(state, action: PayloadAction<boolean>) {
      state.hasMore = action.payload;
    },
  },
});

export const { setExpenses, prependExpense, updateExpense, removeExpense, setStatus, setHasMore } =
  expensesSlice.actions;
export default expensesSlice.reducer;
