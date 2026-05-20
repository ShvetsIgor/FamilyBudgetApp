import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Category, CategoryFolder, CategoryType } from '@/shared/types';

interface CategoriesState {
  expense: Category[];
  income: Category[];
  folders: {
    expense: CategoryFolder[];
    income: CategoryFolder[];
  };
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
}

const initialState: CategoriesState = {
  expense: [],
  income: [],
  folders: { expense: [], income: [] },
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
      state[action.payload.type] = state[action.payload.type].filter((c) => c.id !== action.payload.id);
    },
    archiveCategory(state, action: PayloadAction<{ id: string; type: CategoryType }>) {
      const list = state[action.payload.type];
      const idx = list.findIndex((c) => c.id === action.payload.id);
      if (idx !== -1) list[idx] = { ...list[idx], archived: true };
    },
    // Folder actions
    setFolders(
      state,
      action: PayloadAction<{ type: CategoryType; folders: CategoryFolder[] }>
    ) {
      state.folders[action.payload.type] = action.payload.folders;
    },
    addFolder(state, action: PayloadAction<CategoryFolder>) {
      state.folders[action.payload.type].push(action.payload);
    },
    updateFolder(state, action: PayloadAction<CategoryFolder>) {
      const list = state.folders[action.payload.type];
      const idx = list.findIndex((f) => f.id === action.payload.id);
      if (idx !== -1) list[idx] = action.payload;
    },
    removeFolder(state, action: PayloadAction<{ id: string; type: CategoryType }>) {
      state.folders[action.payload.type] = state.folders[action.payload.type].filter(
        (f) => f.id !== action.payload.id,
      );
    },
    setStatus(state, action: PayloadAction<CategoriesState['status']>) {
      state.status = action.payload;
    },
  },
});

export const {
  setCategories,
  addCategory,
  updateCategory,
  removeCategory,
  archiveCategory,
  setFolders,
  addFolder,
  updateFolder,
  removeFolder,
  setStatus,
} = categoriesSlice.actions;
export default categoriesSlice.reducer;
