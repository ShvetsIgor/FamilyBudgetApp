import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CategoryUsage {
  categoryId: string;
  count: number;
  lastUsed: string;
}

export interface SuggestionMemoryState {
  /** Normalized merchant name → category usage history. */
  merchants: Record<string, CategoryUsage[]>;
  /** Global recent category usage — sorted by lastUsed descending. */
  recents: CategoryUsage[];
}

const MAX_RECENTS = 20;
const MAX_PER_MERCHANT = 5;
const STORAGE_KEY = 'suggestionMemory_v1';

function loadFromStorage(): SuggestionMemoryState {
  if (typeof window === 'undefined') return { merchants: {}, recents: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SuggestionMemoryState) : { merchants: {}, recents: [] };
  } catch {
    return { merchants: {}, recents: [] };
  }
}

function saveToStorage(state: SuggestionMemoryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const suggestionMemorySlice = createSlice({
  name: 'suggestionMemory',
  initialState: loadFromStorage,
  reducers: {
    recordExpense(
      state,
      action: PayloadAction<{ merchant?: string; categoryId: string; date: string }>,
    ) {
      const { merchant, categoryId, date } = action.payload;

      // Merchant memory
      if (merchant) {
        const key = merchant.toLowerCase().trim();
        if (!state.merchants[key]) state.merchants[key] = [];
        const usages = state.merchants[key];
        const existing = usages.find((u) => u.categoryId === categoryId);
        if (existing) {
          existing.count++;
          existing.lastUsed = date;
        } else {
          usages.push({ categoryId, count: 1, lastUsed: date });
        }
        state.merchants[key] = usages
          .sort((a, b) => b.count - a.count)
          .slice(0, MAX_PER_MERCHANT);
      }

      // Recent category usage
      const existing = state.recents.find((u) => u.categoryId === categoryId);
      if (existing) {
        existing.count++;
        existing.lastUsed = date;
      } else {
        state.recents.unshift({ categoryId, count: 1, lastUsed: date });
      }
      state.recents = state.recents
        .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
        .slice(0, MAX_RECENTS);

      saveToStorage({ merchants: state.merchants, recents: state.recents });
    },

    clearMemory(state) {
      state.merchants = {};
      state.recents = [];
      saveToStorage(state);
    },
  },
});

export const { recordExpense, clearMemory } = suggestionMemorySlice.actions;
export default suggestionMemorySlice.reducer;
