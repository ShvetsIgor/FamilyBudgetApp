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

/**
 * Context tag association — links a normalized tag token to a category.
 *
 * Tags arise from split flows: when the user splits "Dabbah 1000" into
 * groceries + household, BOTH categories get a TagAssociation for tag "dabbah".
 * This lets future "Dabbah" inputs rank ALL historically-split categories,
 * not just the primary one (which is handled by merchantHistory).
 *
 * Tags are deterministic, lightweight, and fully inspectable.
 * They are NOT semantic categories — just contextual ranking signals.
 *
 * source:
 *   'split'    — recorded when a category appeared in a split expense
 *   'merchant' — reserved for future manual/direct merchant tagging
 */
export interface TagAssociation {
  /** Normalized tag token (lowercase, trimmed). e.g. 'dabbah', 'shufersal' */
  tag: string;
  categoryId: string;
  usageCount: number;
  lastUsedAt: string; // ISO date string
  source: 'split' | 'merchant';
}

export interface SuggestionMemoryState {
  /** Normalized merchant name → category usage history. */
  merchants: Record<string, CategoryUsage[]>;
  /** Global recent category usage — sorted by lastUsed descending. */
  recents: CategoryUsage[];
  /** Recent split combinations — for one-tap split reuse suggestions. */
  splitCombos: SplitComboEntry[];
  /**
   * Context tag associations — tag → category co-occurrence history from splits.
   * Enables individual split categories to rank well in future matching inputs,
   * independent of split combo membership.
   */
  tagAssociations: TagAssociation[];
  /** Merchant context stats — merchantKey → folderId → count */
  merchantContextStats?: Record<string, Record<string, number>>;
  /** Account this memory belongs to; localStorage writes are keyed by it. */
  uid?: string | null;
}

const MAX_RECENTS = 20;
const MAX_PER_MERCHANT = 5;
const MAX_SPLIT_COMBOS = 20;
const MAX_TAG_ASSOCIATIONS = 200;
const LEGACY_STORAGE_KEY = 'suggestionMemory_v2';

/**
 * Memory is cached in localStorage PER ACCOUNT so merchants/recents/split
 * combos never leak between two accounts sharing one browser.
 */
export function suggestionMemoryStorageKey(uid: string): string {
  return `${LEGACY_STORAGE_KEY}_${uid}`;
}

const EMPTY: SuggestionMemoryState = {
  merchants: {},
  recents: [],
  splitCombos: [],
  tagAssociations: [],
  merchantContextStats: {},
  uid: null,
};

function loadFromStorage(uid: string): SuggestionMemoryState {
  if (typeof window === 'undefined') return { ...EMPTY, uid };
  try {
    // One-time claim of the pre-account global key by the first account
    // that logs in here, then drop it so it can't leak to the next account.
    if (localStorage.getItem(suggestionMemoryStorageKey(uid)) == null) {
      const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy != null) localStorage.setItem(suggestionMemoryStorageKey(uid), legacy);
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    const raw = localStorage.getItem(suggestionMemoryStorageKey(uid));
    if (!raw) return { ...EMPTY, uid };
    const parsed = JSON.parse(raw) as Partial<SuggestionMemoryState>;
    return {
      merchants: parsed.merchants ?? {},
      recents: parsed.recents ?? [],
      splitCombos: parsed.splitCombos ?? [],
      tagAssociations: parsed.tagAssociations ?? [], // backward-compatible default
      merchantContextStats: parsed.merchantContextStats ?? {},
      uid,
    };
  } catch {
    return { ...EMPTY, uid };
  }
}

function saveToStorage(state: SuggestionMemoryState) {
  if (typeof window === 'undefined' || !state.uid) return;
  try {
    localStorage.setItem(suggestionMemoryStorageKey(state.uid), JSON.stringify(state));
  } catch {}
}

function makeComboKey(merchantKey: string, categoryIds: string[]): string {
  return `${merchantKey}|${[...categoryIds].sort().join(',')}`;
}

/**
 * Normalize a raw string into a tag token.
 * Returns empty string for blank/empty input.
 */
export function normalizeTag(raw: string): string {
  return raw.toLowerCase().trim();
}

/**
 * Extract tag tokens from a merchant/store string.
 * Currently returns a single normalized token; ready for multi-token extension.
 */
export function extractTags(merchantOrText: string): string[] {
  const tag = normalizeTag(merchantOrText);
  return tag ? [tag] : [];
}

const suggestionMemorySlice = createSlice({
  name: 'suggestionMemory',
  // Starts empty — the account-scoped cache loads via hydrateSuggestionMemory
  // once the uid is known (AuthProvider, after login).
  initialState: (): SuggestionMemoryState => ({ ...EMPTY }),
  reducers: {
    /** Load the logged-in account's memory from its localStorage cache. */
    hydrateSuggestionMemory(_state, action: PayloadAction<{ uid: string }>) {
      return loadFromStorage(action.payload.uid);
    },

    /** Record a single-category expense save. Updates merchant + recents memory. */
    recordExpense(
      state,
      action: PayloadAction<{ merchant?: string; categoryId: string; folderId?: string; date: string }>,
    ) {
      const { merchant, categoryId, folderId, date } = action.payload;

      // Merchant memory
      if (merchant) {
        const key = normalizeTag(merchant);
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

        // Context stats — record which folder this merchant was used in
        if (folderId) {
          state.merchantContextStats ??= {};
          if (!state.merchantContextStats[key]) state.merchantContextStats[key] = {};
          state.merchantContextStats[key][folderId] = (state.merchantContextStats[key][folderId] ?? 0) + 1;
        }
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

      saveToStorage(state);
    },

    /** Record a split expense save. Updates split combo memory for one-tap reuse. */
    recordSplitExpense(
      state,
      action: PayloadAction<{ merchant?: string; categoryIds: string[]; folderIds?: (string | undefined)[]; date: string }>,
    ) {
      const { merchant, categoryIds, folderIds, date } = action.payload;
      if (categoryIds.length < 2) return; // not a real split

      const merchantKey = normalizeTag(merchant ?? '');
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

      // Context stats — record folders for each split category
      if (merchant && folderIds) {
        const key = normalizeTag(merchant);
        state.merchantContextStats ??= {};
        if (!state.merchantContextStats[key]) state.merchantContextStats[key] = {};
        for (const fid of folderIds) {
          if (fid) state.merchantContextStats[key][fid] = (state.merchantContextStats[key][fid] ?? 0) + 1;
        }
      }

      saveToStorage(state);
    },

    /**
     * Record tag associations after a split save.
     *
     * Called once per category in a split — each split category is individually
     * associated with the extracted tag tokens. This fills the gap left by
     * recordExpense (which only records the primary category with the merchant).
     *
     * Example: "Dabbah 1000" split into groceries + household
     *   → recordTagAssociation({ tags: ['dabbah'], categoryId: 'groceries', date, source: 'split' })
     *   → recordTagAssociation({ tags: ['dabbah'], categoryId: 'household', date, source: 'split' })
     *
     * Both groceries and household now have independent tag associations for 'dabbah'.
     */
    recordTagAssociation(
      state,
      action: PayloadAction<{
        tags: string[];         // extracted tag tokens (usually [merchantKey])
        categoryId: string;
        date: string;
        source: TagAssociation['source'];
      }>,
    ) {
      const { tags, categoryId, date, source } = action.payload;
      const normalizedTags = tags.map(normalizeTag).filter(Boolean);
      if (normalizedTags.length === 0 || !categoryId) return;

      for (const tag of normalizedTags) {
        const existing = state.tagAssociations.find(
          (a) => a.tag === tag && a.categoryId === categoryId,
        );
        if (existing) {
          existing.usageCount++;
          existing.lastUsedAt = date;
          existing.source = source; // update to latest source
        } else {
          state.tagAssociations.push({ tag, categoryId, usageCount: 1, lastUsedAt: date, source });
        }
      }

      // Keep sorted by recency, cap total
      state.tagAssociations = state.tagAssociations
        .sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime())
        .slice(0, MAX_TAG_ASSOCIATIONS);

      saveToStorage(state);
    },

    /** Record merchant -> folder context when the user classifies a store before split details. */
    recordMerchantContext(
      state,
      action: PayloadAction<{ merchant?: string; folderId: string; date: string }>,
    ) {
      const { merchant, folderId } = action.payload;
      const key = normalizeTag(merchant ?? '');
      if (!key || !folderId) return;
      state.merchantContextStats ??= {};
      if (!state.merchantContextStats[key]) state.merchantContextStats[key] = {};
      state.merchantContextStats[key][folderId] = (state.merchantContextStats[key][folderId] ?? 0) + 1;
      saveToStorage(state);
    },

    clearMemory(state) {
      state.merchants = {};
      state.recents = [];
      state.splitCombos = [];
      state.tagAssociations = [];
      state.merchantContextStats = {};
      saveToStorage(state);
    },
  },
});

export const {
  hydrateSuggestionMemory,
  recordExpense,
  recordSplitExpense,
  recordTagAssociation,
  recordMerchantContext,
  clearMemory,
} = suggestionMemorySlice.actions;
export default suggestionMemorySlice.reducer;
