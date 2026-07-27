/**
 * LAYER: merchant memory — deterministic context + category prediction.
 * Pure functions. No Redux imports. No mutations.
 * No AI, no embeddings. Every result traces back to a specific usage count.
 */
import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import type { Category } from '@/shared/types';

export interface ContextSuggestion {
  folderId: string;
  count: number;       // times this context was recorded for this merchant
  confidence: number;  // 0–1, saturates at CONFIDENT_AT uses
}

const CONFIDENT_AT = 5;
const MIN_HISTORY = 2;  // minimum total saves before showing any suggestions
const SPLIT_DOMINANT_AT = 0.6;  // share of saves that must be splits to lead with split

export function normalizeMerchantKey(raw: string): string {
  return raw.toLowerCase().trim();
}

export function merchantTotalUses(merchantKey: string, memory: SuggestionMemoryState): number {
  const key = normalizeMerchantKey(merchantKey);
  return (memory.merchants[key] ?? []).reduce((s, u) => s + u.count, 0);
}

export function hasEnoughHistory(merchantKey: string, memory: SuggestionMemoryState): boolean {
  return merchantTotalUses(merchantKey, memory) >= MIN_HISTORY;
}

/** How many recorded saves at this merchant were splits. */
export function merchantSplitUses(merchantKey: string, memory: SuggestionMemoryState): number {
  const key = normalizeMerchantKey(merchantKey);
  return memory.splitCombos
    .filter((combo) => combo.merchantKey === key)
    .reduce((sum, combo) => sum + combo.count, 0);
}

/**
 * Share of this merchant's saves that were splits, 0–1.
 * Every save adds exactly one merchant usage, and a split additionally bumps
 * its combo, so the two counters are directly comparable.
 */
export function merchantSplitShare(merchantKey: string, memory: SuggestionMemoryState): number {
  const total = merchantTotalUses(merchantKey, memory);
  if (total === 0) return 0;
  return Math.min(1, merchantSplitUses(merchantKey, memory) / total);
}

/**
 * True when this merchant is habitually split — a supermarket receipt covers
 * groceries, household and kids at once.
 *
 * For such a merchant, single-category chips are actively harmful: tapping one
 * files the WHOLE amount under it. The card should lead with split instead.
 */
export function prefersSplit(merchantKey: string, memory: SuggestionMemoryState): boolean {
  if (!hasEnoughHistory(merchantKey, memory)) return false;
  return merchantSplitShare(merchantKey, memory) >= SPLIT_DOMINANT_AT;
}

export function getSuggestedContext(merchantKey: string, memory: SuggestionMemoryState): ContextSuggestion | null {
  const key = normalizeMerchantKey(merchantKey);
  const stats = (memory.merchantContextStats ?? {})[key];
  if (!stats) return null;

  let topFolderId = '';
  let topCount = 0;
  let total = 0;
  for (const [folderId, count] of Object.entries(stats)) {
    total += count;
    if (count > topCount) { topCount = count; topFolderId = folderId; }
  }

  if (total < MIN_HISTORY || !topFolderId) return null;

  return { folderId: topFolderId, count: topCount, confidence: Math.min(1, topCount / CONFIDENT_AT) };
}

export function getTopMerchantCategories(
  merchantKey: string,
  memory: SuggestionMemoryState,
  categories: Category[],
  topN = 5,
): Category[] {
  const key = normalizeMerchantKey(merchantKey);
  const usages = memory.merchants[key] ?? [];
  if (usages.length === 0) return [];
  const catMap = new Map(categories.map((c) => [c.id, c]));
  return usages
    .filter((u) => catMap.has(u.categoryId))
    .sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, topN)
    .map((u) => catMap.get(u.categoryId)!)
    .filter(Boolean);
}
