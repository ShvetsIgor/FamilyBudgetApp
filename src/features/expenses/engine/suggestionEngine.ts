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
 *   habit           — confirmed frequent category at this merchant (10 pts flat)
 *
 * Pipeline stages:
 *   Stage 1: build RankingContext (in computeSuggestions)
 *   Stage 2: collectSignals     — gather raw signal data per item
 *   Stage 3: calculateScore     — sum weighted signal contributions
 *   Stage 4: buildReasons       — produce ordered explanation list
 *   Stage 5: rankCandidates     — sort, tie-break, slice topN
 */

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import { SCORING_POLICY } from './scoringPolicy';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A single explainable reason why a category ranked where it did. */
export type SuggestionReason =
  | { kind: 'merchant_history'; count: number }
  | { kind: 'habit'; count: number }          // frequent pattern at this merchant
  | { kind: 'recent_usage'; daysSince: number }
  | { kind: 'name_match' }
  | { kind: 'split_history'; comboCount: number }
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

/**
 * All raw signals collected for a single candidate item.
 * Exported for inspectability — callers can examine signals directly.
 */
export interface SignalSet {
  merchantHistory: { count: number } | null;
  habit: { count: number } | null;
  recentUsage: { daysSince: number; decayedContribution: number } | null;
  nameMatch: boolean;
  splitHistory: { comboCount: number } | null;
}

/** Internal context shared across all pipeline stages for a single computeSuggestions call. */
interface RankingContext {
  merchantKey: string | undefined;
  memory: SuggestionMemoryState;
  now: number;
}

// ── Stage 2: Collect signals ──────────────────────────────────────────────────

function collectSignals(item: RankableItem, ctx: RankingContext): SignalSet {
  const { signals } = SCORING_POLICY;
  const { merchantKey, memory, now } = ctx;

  // Signal: Merchant history
  let merchantHistory: SignalSet['merchantHistory'] = null;
  let habit: SignalSet['habit'] = null;
  if (merchantKey) {
    const usages = memory.merchants[merchantKey] ?? [];
    const usage = usages.find((u) => u.categoryId === item.id);
    if (usage) {
      merchantHistory = { count: usage.count };
      if (usage.count >= signals.habit.frequencyThreshold) {
        habit = { count: usage.count };
      }
    }
  }

  // Signal: Recent usage with linear decay
  let recentUsage: SignalSet['recentUsage'] = null;
  const recent = memory.recents.find((u) => u.categoryId === item.id);
  if (recent) {
    const days = (now - new Date(recent.lastUsed).getTime()) / 86_400_000;
    const decay = Math.max(0, 1 - days / signals.recentUsage.decayDays);
    const decayedContribution =
      signals.recentUsage.weight * decay * Math.min(1, recent.count / signals.recentUsage.saturationAt);
    if (decayedContribution > 0) {
      recentUsage = { daysSince: Math.floor(days), decayedContribution };
    }
  }

  // Signal: Name substring match
  let nameMatch = false;
  if (merchantKey && item.name) {
    const name = item.name.toLowerCase();
    const key = merchantKey.toLowerCase();
    nameMatch = name.includes(key) || key.includes(name);
  }

  // Signal: Split history — category appears in known split combos for this merchant
  let splitHistory: SignalSet['splitHistory'] = null;
  if (merchantKey) {
    const combos = memory.splitCombos ?? [];
    const comboMatches = combos.filter(
      (c) => c.merchantKey === merchantKey && c.categoryIds.includes(item.id),
    );
    if (comboMatches.length > 0) {
      const totalCount = comboMatches.reduce((s, c) => s + c.count, 0);
      splitHistory = { comboCount: totalCount };
    }
  }

  return { merchantHistory, habit, recentUsage, nameMatch, splitHistory };
}

// ── Stage 3: Calculate score ──────────────────────────────────────────────────

function calculateScore(signals: SignalSet): number {
  const { signals: policy } = SCORING_POLICY;
  let score = 0;

  if (signals.merchantHistory) {
    score += policy.merchantHistory.weight *
      Math.min(1, signals.merchantHistory.count / policy.merchantHistory.saturationAt);
  }

  if (signals.habit) {
    score += policy.habit.weight;
  }

  if (signals.recentUsage) {
    score += signals.recentUsage.decayedContribution;
  }

  if (signals.nameMatch) {
    score += policy.nameMatch.weight;
  }

  if (signals.splitHistory) {
    score += policy.splitHistory.weight *
      Math.min(1, signals.splitHistory.comboCount / policy.splitHistory.saturationAt);
  }

  return score;
}

// ── Stage 4: Build reasons ────────────────────────────────────────────────────

function buildReasons(signals: SignalSet): SuggestionReason[] {
  const reasons: SuggestionReason[] = [];

  // habit takes display precedence over merchant_history
  if (signals.habit) {
    reasons.push({ kind: 'habit', count: signals.habit.count });
  } else if (signals.merchantHistory) {
    reasons.push({ kind: 'merchant_history', count: signals.merchantHistory.count });
  }

  if (signals.recentUsage) {
    reasons.push({ kind: 'recent_usage', daysSince: signals.recentUsage.daysSince });
  }

  if (signals.nameMatch) {
    reasons.push({ kind: 'name_match' });
  }

  if (signals.splitHistory) {
    reasons.push({ kind: 'split_history', comboCount: signals.splitHistory.comboCount });
  }

  // Mark items with no signal so callers can distinguish cold vs. ranked
  if (reasons.length === 0) {
    reasons.push({ kind: 'fallback' });
  }

  return reasons;
}

// ── Stage 5: Rank candidates ──────────────────────────────────────────────────

function rankCandidates(scored: ScoredSuggestion[], topN?: number): ScoredSuggestion[] {
  scored.sort((a, b) => b.score - a.score || a.categoryId.localeCompare(b.categoryId));
  return topN != null ? scored.slice(0, topN) : scored;
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
  const ctx: RankingContext = {
    merchantKey: merchant?.toLowerCase().trim() || undefined,
    memory,
    now: Date.now(),
  };

  const scored = items.map((item): ScoredSuggestion => {
    const signals = collectSignals(item, ctx);      // Stage 2
    const score = calculateScore(signals);           // Stage 3
    const reasons = buildReasons(signals);           // Stage 4
    return { categoryId: item.id, score, reasons };
  });

  return rankCandidates(scored, topN);               // Stage 5
}

/**
 * Human-readable explanation of why a suggestion ranked where it did.
 * Used for debug UI and clarification panels.
 *
 * Examples:
 *   "Часто здесь (4×)"
 *   "История покупок (5×)"
 *   "Недавно (2 дн.)"
 *   "Совпадение названия"
 *   "По умолчанию"
 */
export function explainSuggestion(s: ScoredSuggestion): string {
  const primaryReason = s.reasons.find((r) => r.kind !== 'fallback');
  if (!primaryReason) return 'По умолчанию';

  switch (primaryReason.kind) {
    case 'habit':
      return `Часто здесь (${primaryReason.count}×)`;
    case 'merchant_history':
      return `История покупок (${primaryReason.count}×)`;
    case 'recent_usage':
      return primaryReason.daysSince === 0
        ? 'Сегодня'
        : `Недавно (${primaryReason.daysSince} дн.)`;
    case 'name_match':
      return 'Совпадение названия';
    case 'split_history':
      return `В сплитах (${primaryReason.comboCount}×)`;
    default:
      return 'По умолчанию';
  }
}

/**
 * Whether the top suggestion has a confident signal (score ≥ threshold).
 * Uses SCORING_POLICY.thresholds.confidentScore by default.
 */
export function hasConfidentSuggestion(
  suggestions: ScoredSuggestion[],
  threshold = SCORING_POLICY.thresholds.confidentScore,
): boolean {
  return (suggestions[0]?.score ?? 0) >= threshold;
}

/**
 * Whether suggestions are ambiguous — multiple strong candidates.
 * Uses SCORING_POLICY.thresholds for comparison.
 */
export function isSuggestionAmbiguous(suggestions: ScoredSuggestion[]): boolean {
  const top = suggestions[0]?.score ?? 0;
  const second = suggestions[1]?.score ?? 0;
  return (
    top > 0 &&
    top < SCORING_POLICY.thresholds.confidentScore &&
    second > top * SCORING_POLICY.thresholds.ambiguousRatio
  );
}

/**
 * Compact reason label for inline chip display (1–3 words max).
 * Returns empty string for fallback suggestions — callers hide empty labels.
 *
 * Examples: "привычка", "5×", "2д", "название", ""
 */
export function shortExplainSuggestion(s: ScoredSuggestion): string {
  const primary = s.reasons.find((r) => r.kind !== 'fallback');
  if (!primary) return '';
  switch (primary.kind) {
    case 'habit': return 'привычка';
    case 'merchant_history': return `${primary.count}×`;
    case 'recent_usage': return primary.daysSince === 0 ? 'сегодня' : `${primary.daysSince}д`;
    case 'name_match': return 'название';
    case 'split_history': return `сплит ${primary.comboCount}×`;
    default: return '';
  }
}

/** Whether a suggestion was boosted by the habit signal. */
export function isHabitSuggestion(s: ScoredSuggestion): boolean {
  return s.reasons.some((r) => r.kind === 'habit');
}
