/**
 * LAYER: ranking explainer — signal-level ranking transparency.
 *
 * Converts computeSuggestions() output into human-readable RankingSignalTrace[]
 * so the constructor preview panel and test assertions can inspect WHY a
 * category ranked at a given position.
 *
 * Each SuggestionReason → RankingSignalEntry with:
 *   kind         — the signal type (merchant_history, tag_history, …)
 *   weight       — max contribution from SCORING_POLICY (authoritative)
 *   contribution — approximate signal contribution for this input
 *   detail       — human-readable explanation string
 *
 * Contribution approximation notes:
 *   - Decay is approximated where ageDays is not exposed in SuggestionReason.
 *   - merchant_history/tag_history: linear saturation model, no decay applied.
 *   - recent_usage: linear decay from daysSince (30-day window).
 *   - For exact scores, use ScoredSuggestion.score from computeSuggestions().
 *
 * Architecture invariants:
 *   - Pure function: same ScoredSuggestion[] → same RankingSignalTrace[].
 *   - No AI, no embeddings, no probabilistic logic.
 *   - All weights come from SCORING_POLICY.
 */

import type { ScoredSuggestion, SuggestionReason } from './suggestionEngine';
import { SCORING_POLICY } from './scoringPolicy';
import type { RankingSignalTrace, RankingSignalEntry } from './parserTrace';

// ── Reason → signal entry ─────────────────────────────────────────────────────

function reasonToSignalEntry(reason: SuggestionReason): RankingSignalEntry {
  const p = SCORING_POLICY.signals;

  switch (reason.kind) {
    case 'merchant_history': {
      const saturation = Math.min(reason.count / p.merchantHistory.saturationAt, 1);
      const contribution = saturation * p.merchantHistory.weight;
      return {
        kind: 'merchant_history',
        weight: p.merchantHistory.weight,
        contribution,
        detail: `${reason.count} использований у этого магазина (насыщение при ${p.merchantHistory.saturationAt})`,
      };
    }

    case 'habit': {
      return {
        kind: 'habit',
        weight: p.habit.weight,
        contribution: p.habit.weight,
        detail: `подтверждённая привычка (${reason.count} раз подряд, порог ${p.habit.frequencyThreshold})`,
      };
    }

    case 'tag_history': {
      const saturation = Math.min(reason.count / p.tagHistory.saturationAt, 1);
      const contribution = saturation * p.tagHistory.weight;
      return {
        kind: 'tag_history',
        weight: p.tagHistory.weight,
        contribution,
        detail: `тег "${reason.tag}" — ${reason.count} сплит-ассоциаций`,
      };
    }

    case 'recent_usage': {
      const decayFactor = Math.max(0, 1 - reason.daysSince / p.recentUsage.decayDays);
      const contribution = decayFactor * p.recentUsage.weight;
      return {
        kind: 'recent_usage',
        weight: p.recentUsage.weight,
        contribution,
        detail: `${reason.daysSince} дней назад (распад за ${p.recentUsage.decayDays} дней)`,
      };
    }

    case 'name_match': {
      return {
        kind: 'name_match',
        weight: p.nameMatch.weight,
        contribution: p.nameMatch.weight,
        detail: 'токен магазина совпадает с названием категории',
      };
    }

    case 'split_history': {
      const saturation = Math.min(reason.comboCount / p.splitHistory.saturationAt, 1);
      const contribution = saturation * p.splitHistory.weight;
      return {
        kind: 'split_history',
        weight: p.splitHistory.weight,
        contribution,
        detail: `${reason.comboCount} сплит-комбо с этим магазином`,
      };
    }

    case 'fallback': {
      return {
        kind: 'fallback',
        weight: 0,
        contribution: 0,
        detail: 'нет сигналов — категория показана как резервная',
      };
    }
  }
}

function buildSummary(signals: RankingSignalEntry[], rank: number): string {
  const top = signals
    .filter((s) => s.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 2);

  if (top.length === 0) return `позиция ${rank + 1}: нет активных сигналов`;
  const parts = top.map((s) => `${s.kind}(+${Math.round(s.contribution)})`).join(', ');
  return `позиция ${rank + 1}: ${parts}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Convert computeSuggestions() output to RankingSignalTrace[].
 *
 * @param suggestions  Output of computeSuggestions() — already sorted by score.
 * @returns            One RankingSignalTrace per suggestion, in rank order.
 */
export function explainRankingSignals(
  suggestions: ScoredSuggestion[],
): RankingSignalTrace[] {
  return suggestions.map((suggestion, rank) => {
    const signals = suggestion.reasons.map(reasonToSignalEntry);
    return {
      categoryId: suggestion.categoryId,
      totalScore: suggestion.score,
      rank,
      signals,
      summary: buildSummary(signals, rank),
    };
  });
}

/**
 * Explain a single suggestion (convenience wrapper).
 */
export function explainSingleSuggestion(
  suggestion: ScoredSuggestion,
  rank: number,
): RankingSignalTrace {
  return explainRankingSignals([{ ...suggestion }])[0] && {
    ...explainRankingSignals([suggestion])[0],
    rank,
  };
}

/**
 * Return a human-readable one-line summary for each ranked suggestion.
 * Useful for the constructor preview header.
 */
export function summarizeRanking(suggestions: ScoredSuggestion[]): string[] {
  return explainRankingSignals(suggestions).map((t) => t.summary);
}
