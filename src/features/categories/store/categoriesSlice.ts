import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Category, CategoryType } from '@/shared/types';

interface CategoriesState {
  expense: Category[];
  income: Category[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

const initialState: CategoriesState = {
  expense: [],
  income: [],
  status: 'idle',
  error: null,
};

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    setCategories(
      state,
      action: PayloadAction<{ type: CategoryType; categories: Category[] }>
    ) {
      state[action.payload.type] = action.payload.categories;
      state.status = 'ready';
    },
    addCategory(state, action: PayloadAction<Category>) {
      state[action.payload.type].push(action.payload);
    },
    updateCategory(state, action: PayloadAction<Category>) {
      const list = state[action.payload.type];
      const idx = list.findIndex((c) => c.id === action.payload.id);
      if (idx !== -1) list[idx] = action.payload;
    },
    removeCategory(state, action: PayloadAction<{ id: string; type: CategoryType }>) {
      const list = state[action.payload.type];
      state[action.payload.type] = list.filter((c) => c.id !== action.payload.id);
    },
    setStatus(state, action: PayloadAction<CategoriesState['status']>) {
      state.status = action.payload;
    },
  },
});

export const { setCategories, addCategory, updateCategory, removeCategory, setStatus } =
  categoriesSlice.actions;
export default categoriesSlice.reducer;
