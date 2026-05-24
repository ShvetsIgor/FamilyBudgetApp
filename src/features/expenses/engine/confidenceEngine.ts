/**
 * LAYER: confidence engine — 3D confidence scoring for parsed expense input.
 *
 * Produces a ConfidenceProfile { amount, merchant, category, overall } from:
 *   - ParserContext.confidenceSignals  (parser-level evidence)
 *   - ScoredSuggestion[]              (ranking-level evidence)
 *
 * Scoring rationale:
 *   amount:   near-binary (0.95 if extracted, 0 if absent)
 *   merchant: graded by memory presence + tag reinforcement
 *   category: derived from ranking gap (top vs second score)
 *   overall:  amount×0.3 + merchant×0.3 + category×0.4
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - No AI, no ML. Deterministic from signal presence.
 *   - Scores are stable: same signals always produce same confidence.
 */

import type { ParserContext } from './inputPipeline';
import type { ScoredSuggestion, SuggestionReason } from './suggestionEngine';
import type { ConfidenceProfile, ContextSignal } from '../types/expenseContext';
import { SCORING_POLICY } from './scoringPolicy';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compute a 3D confidence profile from parser output + ranking results.
 */
export function computeConfidenceProfile(
  ctx: ParserContext,
  suggestions: ScoredSuggestion[],
): ConfidenceProfile {
  const amount = computeAmountConfidence(ctx);
  const merchant = computeMerchantConfidence(ctx);
  const category = computeCategoryConfidence(suggestions);
  const overall = round2(amount * 0.3 + merchant * 0.3 + category * 0.4);
  return { amount, merchant, category, overall };
}

/**
 * Extract all active ContextSignals from parser output + top suggestion reasoning.
 * Used for the explanation layer and debug inspector.
 */
export function buildContextSignals(
  ctx: ParserContext,
  suggestions: ScoredSuggestion[],
): ContextSignal[] {
  const signals: ContextSignal[] = [];

  // Parser-level signals
  for (const cs of ctx.confidenceSignals) {
    signals.push({
      kind: cs.kind,
      source: 'parser',
      weight: PARSER_SIGNAL_WEIGHTS[cs.kind] ?? 0.3,
      detail: cs.detail ?? '',
    });
  }

  // Ranking signals from top suggestion
  if (suggestions.length > 0) {
    for (const reason of suggestions[0].reasons) {
      signals.push({
        kind: reason.kind,
        source: reasonSource(reason.kind),
        weight: REASON_WEIGHTS[reason.kind] ?? 0.1,
        detail: formatReasonDetail(reason),
      });
    }
  }

  return signals;
}

// ── Internal scoring ──────────────────────────────────────────────────────────

function computeAmountConfidence(ctx: ParserContext): number {
  return ctx.amount !== undefined ? 0.95 : 0;
}

function computeMerchantConfidence(ctx: ParserContext): number {
  if (!ctx.merchant) return 0;

  const merchantKnown = ctx.confidenceSignals.some((s) => s.kind === 'merchant_known');
  const tagReinforced = ctx.confidenceSignals.some((s) => s.kind === 'tag_reinforced');

  if (merchantKnown && tagReinforced) return 0.90;
  if (merchantKnown) return 0.75;
  return 0.30; // token found but not in memory
}

function computeCategoryConfidence(suggestions: ScoredSuggestion[]): number {
  if (suggestions.length === 0) return 0;

  const top = suggestions[0].score;
  const second = suggestions[1]?.score ?? 0;

  // No meaningful signal
  if (top < SCORING_POLICY.thresholds.confidentScore) return 0.20;

  // Ambiguous — two candidates too close
  if (second > 0 && second / top > SCORING_POLICY.thresholds.ambiguousRatio) return 0.50;

  // Strong, unambiguous signal
  return round2(Math.min(1, top / 100));
}

// ── Lookup tables ─────────────────────────────────────────────────────────────

const PARSER_SIGNAL_WEIGHTS: Record<string, number> = {
  amount_present: 0.95,
  merchant_known: 0.75,
  tag_reinforced: 0.90,
  item_candidates_found: 0.40,
};

const REASON_WEIGHTS: Record<string, number> = {
  merchant_history: 0.50,
  habit: 0.60,
  tag_history: 0.25,
  recent_usage: 0.20,
  name_match: 0.10,
  split_history: 0.15,
  fallback: 0.05,
};

function reasonSource(kind: string): ContextSignal['source'] {
  switch (kind) {
    case 'merchant_history':
    case 'habit':
    case 'tag_history':
    case 'recent_usage':
    case 'split_history':
      return 'history';
    case 'name_match':
      return 'metadata';
    default:
      return 'parser';
  }
}

function formatReasonDetail(reason: SuggestionReason): string {
  switch (reason.kind) {
    case 'merchant_history': return `${reason.count} uses at this merchant`;
    case 'habit':            return `confirmed habit (${reason.count} uses)`;
    case 'tag_history':      return `split co-occurrence "${reason.tag}" (${reason.count}×)`;
    case 'recent_usage':     return `used ${reason.daysSince}d ago`;
    case 'split_history':    return `in ${reason.comboCount} split preset(s)`;
    case 'name_match':       return 'name matches merchant token';
    case 'fallback':         return 'no strong signal';
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
