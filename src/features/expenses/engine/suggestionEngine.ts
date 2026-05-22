/**
 * LAYER: suggestion engine — centralized deterministic ranking.
 *
 * Single source of truth for ALL category suggestion computation.
 * No ranking logic should live in components, hooks, or ad-hoc utils.
 *
 * Architecture invariants enforced here:
 *   - Ranking is fully deterministic: same inputs → same output, always.
 *   - Every suggestion carries explicit reasons — nothing is "magic."
 *   - Input items are generic {id, name} — no folder/category distinction.
 *   - The engine has zero UI dependencies.
 *   - All scoring weights come from SCORING_POLICY — no inline magic numbers.
 *
 * Scoring signals (defined in scoringPolicy.ts):
 *   merchantHistory — saturates at 5 uses (50 pts)
 *   recentUsage     — 30-day decay, saturates at 10 uses (20 pts)
 *   nameMatch       — merchant substring match (10 pts)
 *   splitHistory    — category appears in split combos for this merchant (15 pts)
 */

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import { SCORING_POLICY } from './scoringPolicy';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single explainable reason why a category ranked where it did. */
export type SuggestionReason =
  | { kind: 'merchant_history'; count: number }
  | { kind: 'recent_usage'; daysSince: number }
  | { kind: 'name_match' }
  | { kind: 'fallback' };

/** Ranked suggestion with full scoring transparency. */
export interface ScoredSuggestion {
  categoryId: string;
  score: number;
  reasons: SuggestionReason[];
}

export interface RankableItem {
  id: string;
  name: string;
}

export interface EngineInput {
  merchant?: string;
  items: RankableItem[];
  memory: SuggestionMemoryState;
  topN?: number;
}

// ── Core scoring ──────────────────────────────────────────────────────────────

function scoreItem(
  item: RankableItem,
  merchantKey: string | undefined,
  memory: SuggestionMemoryState,
  now: number,
): { score: number; reasons: SuggestionReason[] } {
  let score = 0;
  const reasons: SuggestionReason[] = [];

  // Signal 1: Merchant history
  if (merchantKey) {
    const usages = memory.merchants[merchantKey] ?? [];
    const usage = usages.find((u) => u.categoryId === item.id);
    if (usage) {
      const contribution = 50 * Math.min(1, usage.count / 5);
      score += contribution;
      reasons.push({ kind: 'merchant_history', count: usage.count });
    }
  }

  // Signal 2: Recent usage with 30-day linear decay
  const recent = memory.recents.find((u) => u.categoryId === item.id);
  if (recent) {
    const days = (now - new Date(recent.lastUsed).getTime()) / 86_400_000;
    const decay = Math.max(0, 1 - days / 30);
    const contribution = 20 * decay * Math.min(1, recent.count / 10);
    if (contribution > 0) {
      score += contribution;
      reasons.push({ kind: 'recent_usage', daysSince: Math.floor(days) });
    }
  }

  // Signal 3: Name substring match
  if (merchantKey && item.name) {
    const name = item.name.toLowerCase();
    const key = merchantKey.toLowerCase();
    if (name.includes(key) || key.includes(name)) {
      score += 10;
      reasons.push({ kind: 'name_match' });
    }
  }

  // Mark items with no signal so callers can distinguish cold vs. ranked
  if (reasons.length === 0) {
    reasons.push({ kind: 'fallback' });
  }

  return { score, reasons };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute ranked suggestions for the given merchant context.
 *
 * Returns ALL items sorted by score, not just topN — callers decide how many to show.
 * Tie-broken by id lexicographic order for determinism.
 */
export function computeSuggestions(input: EngineInput): ScoredSuggestion[] {
  const { merchant, items, memory, topN } = input;
  const merchantKey = merchant?.toLowerCase().trim() || undefined;
  const now = Date.now();

  const scored: ScoredSuggestion[] = items.map((item) => {
    const { score, reasons } = scoreItem(item, merchantKey, memory, now);
    return { categoryId: item.id, score, reasons };
  });

  scored.sort((a, b) => b.score - a.score || a.categoryId.localeCompare(b.categoryId));

  return topN != null ? scored.slice(0, topN) : scored;
}

/**
 * Human-readable explanation of why a suggestion ranked where it did.
 * Used for debug UI and clarification panels.
 *
 * Examples:
 *   "История покупок (5×)"
 *   "Недавно (2 дн.)"
 *   "Совпадение названия"
 *   "По умолчанию"
 */
export function explainSuggestion(s: ScoredSuggestion): string {
  const primaryReason = s.reasons.find((r) => r.kind !== 'fallback');
  if (!primaryReason) return 'По умолчанию';

  switch (primaryReason.kind) {
    case 'merchant_history':
      return `История покупок (${primaryReason.count}×)`;
    case 'recent_usage':
      return primaryReason.daysSince === 0
        ? 'Сегодня'
        : `Недавно (${primaryReason.daysSince} дн.)`;
    case 'name_match':
      return 'Совпадение названия';
    default:
      return 'По умолчанию';
  }
}

/**
 * Whether the top suggestion has a confident signal (score ≥ threshold).
 * Used to skip clarification and go straight to confirm stage.
 */
export function hasConfidentSuggestion(suggestions: ScoredSuggestion[], threshold = 30): boolean {
  return (suggestions[0]?.score ?? 0) >= threshold;
}

/**
 * Whether suggestions are ambiguous — multiple strong candidates.
 * Used to trigger clarification stage.
 */
export function isSuggestionAmbiguous(suggestions: ScoredSuggestion[]): boolean {
  const top = suggestions[0]?.score ?? 0;
  const second = suggestions[1]?.score ?? 0;
  return top > 0 && top < 30 && second > top * 0.5;
}

/**
 * Compact reason label for inline chip display (1–3 words max).
 * Returns empty string for fallback suggestions — callers hide empty labels.
 *
 * Examples: "5×", "2д", "название", ""
 */
export function shortExplainSuggestion(s: ScoredSuggestion): string {
  const primary = s.reasons.find((r) => r.kind !== 'fallback');
  if (!primary) return '';
  switch (primary.kind) {
    case 'merchant_history': return `${primary.count}×`;
    case 'recent_usage': return primary.daysSince === 0 ? 'сегодня' : `${primary.daysSince}д`;
    case 'name_match': return 'название';
    default: return '';
  }
}
