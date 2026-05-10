import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Theme, Language, Currency } from '@/shared/types';

interface UIState {
  theme: Theme;
  language: Language;
  currency: Currency;
  isOffline: boolean;
  isSyncing: boolean;
}

const initialState: UIState = {
  theme: 'light',
  language: 'en',
  currency: 'ILS',
  isOffline: false,
  isSyncing: false,
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
    setOffline(state, action: PayloadAction<boolean>) {
      state.isOffline = action.payload;
    },
    setSyncing(state, action: PayloadAction<boolean>) {
      state.isSyncing = action.payload;
    },
  },
});

export const { setTheme, setLanguage, setCurrency, setOffline, setSyncing } =
  uiSlice.actions;
export default uiSlice.reducer;
