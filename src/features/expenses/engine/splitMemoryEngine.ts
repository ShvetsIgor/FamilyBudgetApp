/**
 * LAYER: split memory engine — split combo ranking and preset suggestion.
 *
 * Works on top of the SplitComboEntry[] already stored in suggestionMemorySlice.
 * Does NOT modify Redux state — pure read + ranking only.
 *
 * Split presets are:
 *   - merchant-scoped combinations of categoryIds used together
 *   - ranked by frequency (count) then recency (lastUsed)
 *   - converted to SplitPreset view models for the UI
 *
 * Architecture invariants:
 *   - Pure functions. No Redux imports. No mutations.
 *   - Takes SuggestionMemoryState and Category[] as plain data.
 *   - Deterministic: same inputs → same ranked output.
 *   - Store is NOT an entity. merchantKey is a plain normalized string.
 */

import type { SuggestionMemoryState, SplitComboEntry } from '../store/suggestionMemorySlice';
import type { Category } from '@/shared/types';

// ── View model ────────────────────────────────────────────────────────────────

export interface SplitPreset {
  /** Unique key from SplitComboEntry (merchantKey|sortedCategoryIds). */
  id: string;
  categoryIds: string[];
  categoryNames: string[];  // resolved display names (archived-safe)
  count: number;            // how many times this combo was used
  lastUsed: string;         // ISO date
  confidence: number;       // 0–1 (saturates at MAX_CONFIDENCE_COUNT uses)
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Combo count at which confidence saturates to 1.0. */
const MAX_CONFIDENCE_COUNT = 5;

/** Days after which recency tie-break weight drops to 0. */
const RECENCY_DECAY_DAYS = 90;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Find all split combos recorded for a specific merchant key.
 */
export function findMatchingSplitCombos(
  merchantKey: string,
  memory: SuggestionMemoryState,
): SplitComboEntry[] {
  const norm = merchantKey.toLowerCase().trim();
  return (memory.splitCombos ?? []).filter((c) => c.merchantKey === norm);
}

/**
 * Rank split combos by frequency (primary) then recency (secondary).
 * Returns a new sorted array — no mutation.
 */
export function rankSplitCombos(
  combos: SplitComboEntry[],
  now = Date.now(),
): SplitComboEntry[] {
  return [...combos].sort((a, b) => {
    // Primary: higher count first
    if (b.count !== a.count) return b.count - a.count;

    // Secondary: more recent first (linear decay over RECENCY_DECAY_DAYS)
    const ageA = (now - new Date(a.lastUsed).getTime()) / 86_400_000;
    const ageB = (now - new Date(b.lastUsed).getTime()) / 86_400_000;
    const freshA = Math.max(0, 1 - ageA / RECENCY_DECAY_DAYS);
    const freshB = Math.max(0, 1 - ageB / RECENCY_DECAY_DAYS);
    return freshB - freshA;
  });
}

/**
 * Compute the confidence score for a single split combo (0–1).
 * Saturates at MAX_CONFIDENCE_COUNT uses.
 */
export function splitComboConfidence(combo: SplitComboEntry): number {
  return Math.min(1, combo.count / MAX_CONFIDENCE_COUNT);
}

/**
 * Build ranked SplitPreset view models for a merchant key.
 *
 * @param merchantKey  — normalized merchant key to look up
 * @param memory       — current suggestion memory state
 * @param categories   — all categories (for name resolution)
 * @param topN         — max presets to return
 * @param now          — current timestamp for recency scoring
 */
export function buildSplitPresets(
  merchantKey: string,
  memory: SuggestionMemoryState,
  categories: Category[],
  topN = 3,
  now = Date.now(),
): SplitPreset[] {
  const combos = rankSplitCombos(findMatchingSplitCombos(merchantKey, memory), now);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return combos
    .slice(0, topN)
    .map((combo): SplitPreset => {
      const names = combo.categoryIds
        .map((id) => catMap.get(id)?.name ?? id)
        .filter(Boolean);

      return {
        id: combo.key,
        categoryIds: combo.categoryIds,
        categoryNames: names,
        count: combo.count,
        lastUsed: combo.lastUsed,
        confidence: splitComboConfidence(combo),
      };
    });
}

/**
 * True when there are any recorded split combos for this merchant.
 */
export function hasSplitPresets(
  merchantKey: string,
  memory: SuggestionMemoryState,
): boolean {
  return findMatchingSplitCombos(merchantKey, memory).length > 0;
}

/**
 * Find the most-used split combo for a merchant, or undefined if none.
 */
export function topSplitPreset(
  merchantKey: string,
  memory: SuggestionMemoryState,
  categories: Category[],
  now = Date.now(),
): SplitPreset | undefined {
  return buildSplitPresets(merchantKey, memory, categories, 1, now)[0];
}
