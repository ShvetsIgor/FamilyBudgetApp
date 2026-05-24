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
