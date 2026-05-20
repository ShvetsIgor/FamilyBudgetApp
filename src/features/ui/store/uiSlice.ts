import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Theme, Language, Currency, WeekStart } from '@/shared/types';

export type { WeekStart };
export type BudgetMode = 'daily' | 'monthly' | 'auto';

function ls(key: string): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
}

interface UIState {
  theme: Theme;
  language: Language;
  currency: Currency;
  weekStart: WeekStart;
  isOffline: boolean;
  isSyncing: boolean;
  expensesSearch: string;
  budgetMode: BudgetMode;
  budgetDailyLimit: number;
  budgetMonthlyLimit: number;
  desktopRightPanelOpen: boolean;
}

const initialState: UIState = {
  theme: 'light',
  language: 'en',
  currency: 'ILS',
  weekStart: 'monday',
  isOffline: false,
  isSyncing: false,
  expensesSearch: '',
  budgetMode: (ls('budgetMode') as BudgetMode) ?? 'auto',
  budgetDailyLimit: Number(ls('budgetDailyLimit')) || 0,
  budgetMonthlyLimit: Number(ls('budgetMonthlyLimit')) || 0,
  desktopRightPanelOpen: true,
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
    setBudgetMode(state, action: PayloadAction<BudgetMode>) {
      state.budgetMode = action.payload;
      if (typeof window !== 'undefined') localStorage.setItem('budgetMode', action.payload);
    },
    setBudgetDailyLimit(state, action: PayloadAction<number>) {
      state.budgetDailyLimit = action.payload;
      if (typeof window !== 'undefined') localStorage.setItem('budgetDailyLimit', String(action.payload));
    },
    setBudgetMonthlyLimit(state, action: PayloadAction<number>) {
      state.budgetMonthlyLimit = action.payload;
      if (typeof window !== 'undefined') localStorage.setItem('budgetMonthlyLimit', String(action.payload));
    },
    setDesktopRightPanelOpen(state, action: PayloadAction<boolean>) {
      state.desktopRightPanelOpen = action.payload;
    },
  },
});

export const { setTheme, setLanguage, setCurrency, setWeekStart, setOffline, setSyncing, setExpensesSearch, setBudgetMode, setBudgetDailyLimit, setBudgetMonthlyLimit, setDesktopRightPanelOpen } =
  uiSlice.actions;
export default uiSlice.reducer;
