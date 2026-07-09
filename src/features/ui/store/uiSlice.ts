import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Theme, Language, Currency, WeekStart } from '@/shared/types';

export type { WeekStart };
export interface BudgetSnapshot {
  mode: BudgetMode;
  dailyLimit: number;
  monthlyLimit: number;
}

export type BudgetMode = 'daily' | 'monthly' | 'auto';

function ls(key: string): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
}

interface UIState {
  theme: Theme;
  isDarkMode: boolean;
  language: Language;
  currency: Currency;
  weekStart: WeekStart;
  isOffline: boolean;
  isSyncing: boolean;
  expensesSearch: string;
  budgetMode: BudgetMode;
  budgetDailyLimit: number;
  budgetMonthlyLimit: number;
  /** Per-month snapshots (key 'yyyy-MM'): past months keep the settings
   *  that were active then; months without a snapshot inherit the nearest
   *  earlier one, falling back to the current global fields. */
  budgetByMonth: Record<string, BudgetSnapshot>;
  desktopRightPanelOpen: boolean;
}

const storedTheme = ls('ui.theme');
const storedDarkMode = ls('ui.darkMode');
// Migrate legacy 'paper' → 'press' so previously saved preferences map to the
// new warm-paper editorial theme rather than silently falling back to mist.
const normalizedTheme: 'mist' | 'press' =
  storedTheme === 'press' || storedTheme === 'paper' ? 'press' : 'mist';

const initialState: UIState = {
  theme: normalizedTheme,
  isDarkMode: storedDarkMode === 'true' || storedTheme === 'dark',
  language: 'en',
  currency: 'ILS',
  weekStart: 'monday',
  isOffline: false,
  isSyncing: false,
  expensesSearch: '',
  budgetMode: (ls('budgetMode') as BudgetMode) ?? 'auto',
  budgetDailyLimit: Number(ls('budgetDailyLimit')) || 0,
  budgetMonthlyLimit: Number(ls('budgetMonthlyLimit')) || 0,
  budgetByMonth: (() => {
    try { return JSON.parse(ls('budgetByMonth') ?? '{}'); } catch { return {}; }
  })(),
  desktopRightPanelOpen: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme(state, action: PayloadAction<Theme>) {
      state.theme = action.payload;
      if (typeof window !== 'undefined') localStorage.setItem('ui.theme', action.payload);
    },
    setDarkMode(state, action: PayloadAction<boolean>) {
      state.isDarkMode = action.payload;
      if (typeof window !== 'undefined') localStorage.setItem('ui.darkMode', String(action.payload));
    },
    hydrateThemePreferences(state) {
      const storedTheme = ls('ui.theme');
      const storedDarkMode = ls('ui.darkMode');
      if (storedTheme === 'mist' || storedTheme === 'press') state.theme = storedTheme;
      if (storedTheme === 'paper') {
        state.theme = 'press';
        if (typeof window !== 'undefined') localStorage.setItem('ui.theme', 'press');
      }
      if (storedTheme === 'dark') {
        state.theme = 'mist';
        state.isDarkMode = true;
        if (typeof window !== 'undefined') {
          localStorage.setItem('ui.theme', 'mist');
          localStorage.setItem('ui.darkMode', 'true');
        }
      }
      if (storedDarkMode === 'true' || storedDarkMode === 'false') state.isDarkMode = storedDarkMode === 'true';
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
    setBudgetSnapshot(state, action: PayloadAction<{ month: string; snapshot: BudgetSnapshot }>) {
      state.budgetByMonth[action.payload.month] = action.payload.snapshot;
      if (typeof window !== 'undefined') {
        localStorage.setItem('budgetByMonth', JSON.stringify(state.budgetByMonth));
      }
    },
    setDesktopRightPanelOpen(state, action: PayloadAction<boolean>) {
      state.desktopRightPanelOpen = action.payload;
    },
  },
});

export const { setTheme, setDarkMode, hydrateThemePreferences, setLanguage, setCurrency, setWeekStart, setOffline, setSyncing, setExpensesSearch, setBudgetMode, setBudgetDailyLimit, setBudgetMonthlyLimit, setBudgetSnapshot, setDesktopRightPanelOpen } =
  uiSlice.actions;
export default uiSlice.reducer;
