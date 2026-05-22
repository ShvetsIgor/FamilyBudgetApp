import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';

export interface RankableItem {
  id: string;
  name: string;
  tags?: string[];
}

/**
 * Scoring weights:
 *   50 — merchant history match (saturates at 5 uses)
 *   20 — recent usage (decays to 0 over 30 days, saturates at 10 uses)
 *   10 — category name contains merchant token (substring)
 */
function scoreItem(
  item: RankableItem,
  merchantKey: string | undefined,
  memory: SuggestionMemoryState,
): number {
  let score = 0;
  const now = Date.now();

  if (merchantKey) {
    const usages = memory.merchants[merchantKey] ?? [];
    const usage = usages.find((u) => u.categoryId === item.id);
    if (usage) {
      score += 50 * Math.min(1, usage.count / 5);
    }
  }

  const recent = memory.recents.find((u) => u.categoryId === item.id);
  if (recent) {
    const days = (now - new Date(recent.lastUsed).getTime()) / 86_400_000;
    const decay = Math.max(0, 1 - days / 30);
    score += 20 * decay * Math.min(1, recent.count / 10);
  }

  if (merchantKey && item.name) {
    const name = item.name.toLowerCase();
    const key = merchantKey.toLowerCase();
    if (name.includes(key) || key.includes(name)) score += 10;
  }

  return score;
}

/**
 * Returns up to topN item IDs ranked by suggestion relevance.
 * Always returns topN items even with no memory — lower-score items act as fallbacks.
 * Deterministic: same inputs always produce the same ranking.
 */
export function rankSuggestions(
  items: RankableItem[],
  merchant: string | undefined,
  memory: SuggestionMemoryState,
  topN = 3,
): string[] {
  const merchantKey = merchant?.toLowerCase().trim() || undefined;

  const scored = items.map((item) => ({
    id: item.id,
    score: scoreItem(item, merchantKey, memory),
  }));

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return scored.slice(0, topN).map((s) => s.id);
}
