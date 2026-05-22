/**
 * LAYER: recent context engine — pure query functions over memory state.
 *
 * No Redux, no side effects, no component dependencies.
 * Computes "what happened recently" from a memory snapshot for UX context.
 *
 * Architecture invariants:
 *   - Recent context is RANKING SIGNAL ONLY — never semantic meaning.
 *   - Context never alters analytics, category IDs, or expense data.
 *   - All functions are pure: same memory → same output.
 *   - Recency is measured in days; context decays naturally as memory ages.
 *
 * Consumed by: useExpenseInputFlow (ranking hints), ClarificationPanel (UX hints).
 * NOT consumed by: analytics, statistics, parser semantics.
 */

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RecentMerchant {
  key: string;           // normalized (lowercase) — use as memory lookup key
  topCategoryId: string; // most frequently used category for this merchant
  totalCount: number;    // sum of all category usages at this merchant
  lastUsed: string;      // ISO — most recent usage across all categories
}

export interface RecentCategoryEntry {
  categoryId: string;
  count: number;
  daysSinceLastUsed: number;
}

// ── Merchant context ──────────────────────────────────────────────────────────

/**
 * Returns recently-used merchants sorted by lastUsed descending.
 * Only merchants with at least one recorded category usage are returned.
 */
export function getRecentMerchants(
  memory: SuggestionMemoryState,
  limit = 5,
): RecentMerchant[] {
  const now = Date.now();

  return Object.entries(memory.merchants)
    .map(([key, usages]) => {
      if (!usages.length) return null;
      const sorted = [...usages].sort(
        (a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime(),
      );
      const mostRecent = sorted[0];
      const topUsage = [...usages].sort((a, b) => b.count - a.count)[0];
      return {
        key,
        topCategoryId: topUsage.categoryId,
        totalCount: usages.reduce((s, u) => s + u.count, 0),
        lastUsed: mostRecent.lastUsed,
      };
    })
    .filter((m): m is RecentMerchant => m !== null && !!m.topCategoryId)
    .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
    .slice(0, limit);
}

/**
 * Returns top categoryIds used at a specific merchant, ordered by usage count.
 * Returns empty array if merchant has no history.
 */
export function getTopCategoriesForMerchant(
  merchant: string,
  memory: SuggestionMemoryState,
  limit = 3,
): string[] {
  const key = merchant.toLowerCase().trim();
  const usages = memory.merchants[key] ?? [];
  return [...usages]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((u) => u.categoryId);
}

// ── Category context ──────────────────────────────────────────────────────────

/**
 * Returns recently-used categories with recency metadata.
 * Sorted by lastUsed descending.
 */
export function getRecentCategories(
  memory: SuggestionMemoryState,
  limit = 10,
): RecentCategoryEntry[] {
  const now = Date.now();
  return [...memory.recents]
    .sort((a, b) => new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime())
    .slice(0, limit)
    .map((u) => ({
      categoryId: u.categoryId,
      count: u.count,
      daysSinceLastUsed: Math.floor(
        (now - new Date(u.lastUsed).getTime()) / 86_400_000,
      ),
    }));
}

/**
 * Returns the N most-used category IDs globally — highest total count first.
 * Useful as cold-start defaults when no merchant context is available.
 */
export function getTopCategories(
  memory: SuggestionMemoryState,
  limit = 3,
): string[] {
  return [...memory.recents]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((u) => u.categoryId);
}

/**
 * Whether the app has enough context to make meaningful suggestions.
 * Returns false on first use or after a long gap.
 */
export function hasUsageContext(memory: SuggestionMemoryState): boolean {
  return memory.recents.length > 0 || Object.keys(memory.merchants).length > 0;
}
