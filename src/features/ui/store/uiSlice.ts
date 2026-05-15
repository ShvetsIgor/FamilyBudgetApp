import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Theme, Language, Currency, WeekStart } from '@/shared/types';

export type { WeekStart };

interface UIState {
  theme: Theme;
  language: Language;
  currency: Currency;
  weekStart: WeekStart;
  isOffline: boolean;
  isSyncing: boolean;
  expensesSearch: string;
}

const initialState: UIState = {
  theme: 'light',
  language: 'en',
  currency: 'ILS',
  weekStart: 'monday',
  isOffline: false,
  isSyncing: false,
  expensesSearch: '',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
    },
    setLanguage(state, action: PayloadAction<Language>) {
      state.language = action.payload;
    },
    setCurrency(state, action: PayloadAction<Currency>) {
      state.currency = action.payload;
    },
    setWeekStart(state, action: PayloadAction<WeekStart>) {
      state.weekStart = action.payload;
    },
    setOffline(state, action: PayloadAction<boolean>) {
      state.isOffline = action.payload;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
    setExpensesSearch(state, action: PayloadAction<string>) {
      state.expensesSearch = action.payload;
    },
  },
});

export const { setTheme, setLanguage, setCurrency, setWeekStart, setOffline, setSyncing, setExpensesSearch } =
  uiSlice.actions;
export default uiSlice.reducer;
