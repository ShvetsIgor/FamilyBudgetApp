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

// Budget preferences are cached in localStorage PER ACCOUNT — the keys carry
// the uid so two accounts in one browser never see each other's settings.
// Firestore (the users doc) stays the cross-device source of truth.
function budgetLsKey(uid: string, field: string): string {
  return `${field}_${uid}`;
}

const LEGACY_BUDGET_KEYS = ['budgetMode', 'budgetDailyLimit', 'budgetMonthlyLimit', 'budgetByMonth'];

function persistBudget(state: UIState) {
  if (typeof window === 'undefined' || !state.budgetUid) return;
  try {
    localStorage.setItem(budgetLsKey(state.budgetUid, 'budgetMode'), state.budgetMode);
    localStorage.setItem(budgetLsKey(state.budgetUid, 'budgetDailyLimit'), String(state.budgetDailyLimit));
    localStorage.setItem(budgetLsKey(state.budgetUid, 'budgetMonthlyLimit'), String(state.budgetMonthlyLimit));
    localStorage.setItem(budgetLsKey(state.budgetUid, 'budgetByMonth'), JSON.stringify(state.budgetByMonth));
  } catch { /* storage full/blocked — Firestore still has the truth */ }
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
  /** Account the budget fields belong to; localStorage writes are keyed by it. */
  budgetUid: string | null;
  desktopRightPanelOpen: boolean;
}

const initialState: UIState = {
  // theme, isDarkMode and language are deliberately NOT read from localStorage
  // here: this module also runs during prerendering, where there is none, so a
  // stored value would make the client's first render disagree with the
  // server's HTML and break hydration. hydrateDisplayPreferences applies all
  // three on mount instead (and migrates a legacy 'paper' theme to 'press').
  theme: 'mist',
  isDarkMode: false,
  language: 'en',
  currency: 'ILS',
  weekStart: 'monday',
  isOffline: false,
  isSyncing: false,
  expensesSearch: '',
  // Budget fields stay at defaults until hydrateBudgetPreferences runs with
  // the logged-in uid — reading account-scoped keys needs the account first.
  budgetMode: 'auto',
  budgetDailyLimit: 0,
  budgetMonthlyLimit: 0,
  budgetByMonth: {},
  budgetUid: null,
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
    hydrateDisplayPreferences(state) {
      const storedLanguage = ls('ui.language');
      if (storedLanguage === 'ru' || storedLanguage === 'en') state.language = storedLanguage;
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
      if (typeof window !== 'undefined') localStorage.setItem('ui.language', action.payload);
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
      persistBudget(state);
    },
    setBudgetDailyLimit(state, action: PayloadAction<number>) {
      state.budgetDailyLimit = action.payload;
      persistBudget(state);
    },
    setBudgetMonthlyLimit(state, action: PayloadAction<number>) {
      state.budgetMonthlyLimit = action.payload;
      persistBudget(state);
    },
    /**
     * Applies budget settings on login: first the account-scoped localStorage
     * cache (`budgetMode_{uid}` etc., migrating pre-account global keys once),
     * then the Firestore profile fields on top — Firestore is the cross-device
     * source of truth, localStorage is a cache. Local-only snapshots (e.g.
     * saved offline) are kept unless the profile has that month.
     */
    hydrateBudgetPreferences(state, action: PayloadAction<{
      uid: string;
      budgetMode?: BudgetMode;
      budgetDailyLimit?: number;
      budgetMonthlyLimit?: number;
      budgetByMonth?: Record<string, BudgetSnapshot>;
    }>) {
      const { uid, budgetMode, budgetDailyLimit, budgetMonthlyLimit, budgetByMonth } = action.payload;
      state.budgetUid = uid;

      // One-time claim of the old global (account-less) keys by the first
      // account that logs in here, then remove them so they can't leak to
      // the next account on this browser.
      if (typeof window !== 'undefined') {
        try {
          if (ls(budgetLsKey(uid, 'budgetMode')) == null && ls('budgetMode') != null) {
            for (const key of LEGACY_BUDGET_KEYS) {
              const legacy = ls(key);
              if (legacy != null) localStorage.setItem(budgetLsKey(uid, key), legacy);
            }
          }
          for (const key of LEGACY_BUDGET_KEYS) localStorage.removeItem(key);
        } catch { /* storage blocked */ }
      }

      // Account-scoped local cache first…
      const cachedMode = ls(budgetLsKey(uid, 'budgetMode')) as BudgetMode | null;
      if (cachedMode) state.budgetMode = cachedMode;
      state.budgetDailyLimit = Number(ls(budgetLsKey(uid, 'budgetDailyLimit'))) || 0;
      state.budgetMonthlyLimit = Number(ls(budgetLsKey(uid, 'budgetMonthlyLimit'))) || 0;
      try {
        state.budgetByMonth = JSON.parse(ls(budgetLsKey(uid, 'budgetByMonth')) ?? '{}');
      } catch { state.budgetByMonth = {}; }

      // …then the profile wins wherever it has a value.
      if (budgetMode) state.budgetMode = budgetMode;
      if (typeof budgetDailyLimit === 'number') state.budgetDailyLimit = budgetDailyLimit;
      if (typeof budgetMonthlyLimit === 'number') state.budgetMonthlyLimit = budgetMonthlyLimit;
      if (budgetByMonth) state.budgetByMonth = { ...state.budgetByMonth, ...budgetByMonth };
      persistBudget(state);
    },
    setBudgetSnapshot(state, action: PayloadAction<{ month: string; snapshot: BudgetSnapshot }>) {
      state.budgetByMonth[action.payload.month] = action.payload.snapshot;
      persistBudget(state);
    },
    setDesktopRightPanelOpen(state, action: PayloadAction<boolean>) {
      state.desktopRightPanelOpen = action.payload;
    },
  },
});

export const { setTheme, setDarkMode, hydrateDisplayPreferences, setLanguage, setCurrency, setWeekStart, setOffline, setSyncing, setExpensesSearch, setBudgetMode, setBudgetDailyLimit, setBudgetMonthlyLimit, setBudgetSnapshot, hydrateBudgetPreferences, setDesktopRightPanelOpen } =
  uiSlice.actions;
export default uiSlice.reducer;
