import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CategoryUsage {
  categoryId: string;
  count: number;
  lastUsed: string;
}

/**
 * A reusable split preset — a set of categoryIds that were used together.
 * merchantKey='' means the combo was recorded without a specific merchant.
 */
export interface SplitComboEntry {
  /** Lookup key: normalized merchantKey + '|' + sorted categoryIds joined with ','. */
  key: string;
  merchantKey: string;
  categoryIds: string[];
  count: number;
  lastUsed: string;
}

export interface SuggestionMemoryState {
  /** Normalized merchant name → category usage history. */
  merchants: Record<string, CategoryUsage[]>;
  /** Global recent category usage — sorted by lastUsed descending. */
  recents: CategoryUsage[];
  /** Recent split combinations — for one-tap split reuse suggestions. */
  splitCombos: SplitComboEntry[];
}

const MAX_RECENTS = 20;
const MAX_PER_MERCHANT = 5;
const MAX_SPLIT_COMBOS = 20;
const STORAGE_KEY = 'suggestionMemory_v2';

const EMPTY: SuggestionMemoryState = { merchants: {}, recents: [], splitCombos: [] };

function loadFromStorage(): SuggestionMemoryState {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SuggestionMemoryState>;
    return {
      merchants: parsed.merchants ?? {},
      recents: parsed.recents ?? [],
      splitCombos: parsed.splitCombos ?? [],
    };
  } catch {
    return EMPTY;
  }
}

function saveToStorage(state: SuggestionMemoryState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function makeComboKey(merchantKey: string, categoryIds: string[]): string {
  return `${merchantKey}|${[...categoryIds].sort().join(',')}`;
}

const suggestionMemorySlice = createSlice({
  name: 'suggestionMemory',
  initialState: loadFromStorage,
  reducers: {
    /** Record a single-category expense save. Updates merchant + recents memory. */
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

      saveToStorage({ merchants: state.merchants, recents: state.recents, splitCombos: state.splitCombos });
    },

    /** Record a split expense save. Updates split combo memory for one-tap reuse. */
    recordSplitExpense(
      state,
      action: PayloadAction<{ merchant?: string; categoryIds: string[]; date: string }>,
    ) {
      const { merchant, categoryIds, date } = action.payload;
      if (categoryIds.length < 2) return; // not a real split

      const merchantKey = merchant?.toLowerCase().trim() ?? '';
      const sortedIds = [...categoryIds].sort();
      const key = makeComboKey(merchantKey, sortedIds);

      const existing = state.splitCombos.find((c) => c.key === key);
      if (existing) {
        existing.count++;
        existing.lastUsed = date;
      } else {
        state.splitCombos.push({
          key,
          merchantKey,
          categoryIds: sortedIds,
          count: 1,
          lastUsed: date,
        });
      }

      state.splitCombos = state.splitCombos
        .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
        .slice(0, MAX_SPLIT_COMBOS);

      saveToStorage({ merchants: state.merchants, recents: state.recents, splitCombos: state.splitCombos });
    },

    clearMemory(state) {
      state.merchants = {};
      state.recents = [];
      state.splitCombos = [];
      saveToStorage(state);
    },
  },
});

export const { recordExpense, recordSplitExpense, clearMemory } = suggestionMemorySlice.actions;
export default suggestionMemorySlice.reducer;
