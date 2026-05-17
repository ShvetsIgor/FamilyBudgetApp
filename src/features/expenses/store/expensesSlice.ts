import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SerializableExpense } from '@/shared/types';

interface ExpensesState {
  list: SerializableExpense[];
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
    setExpenses(state, action: PayloadAction<SerializableExpense[]>) {
      state.list = action.payload;
      state.status = 'ready';
    },
    prependExpense(state, action: PayloadAction<SerializableExpense>) {
      state.list.unshift(action.payload);
    },
    updateExpense(state, action: PayloadAction<SerializableExpense>) {
      const idx = state.list.findIndex((e) => e.id === action.payload.id);
      if (idx !== -1) state.list[idx] = action.payload;
    },
    removeExpense(state, action: PayloadAction<string>) {
      state.list = state.list.filter((e) => e.id !== action.payload);
    },
    mergeExpenses(state, action: PayloadAction<SerializableExpense[]>) {
      const existing = new Set(state.list.map((e) => e.id));
      const fresh = action.payload.filter((e) => !existing.has(e.id));
      state.list = [...action.payload, ...state.list.filter((e) => !action.payload.find((f) => f.id === e.id))];
      state.status = 'ready';
    },
    setStatus(state, action: PayloadAction<ExpensesState['status']>) {
      state.status = action.payload;
    },
    setHasMore(state, action: PayloadAction<boolean>) {
      state.hasMore = action.payload;
    },
    remapExpenseCategories(state, action: PayloadAction<Record<string, string>>) {
      const map = action.payload;
      state.list = state.list.map((e) => ({
        ...e,
        categoryId: map[e.categoryId] ?? e.categoryId,
        subcategoryId: e.subcategoryId ? (map[e.subcategoryId] ?? e.subcategoryId) : e.subcategoryId,
      }));
    },
  },
});

export const { setExpenses, prependExpense, updateExpense, removeExpense, mergeExpenses, setStatus, setHasMore, remapExpenseCategories } =
  expensesSlice.actions;
export default expensesSlice.reducer;
