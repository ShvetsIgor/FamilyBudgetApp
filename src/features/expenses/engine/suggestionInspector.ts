/**
 * LAYER: suggestion inspector — explainability and debug utilities.
 *
 * Provides:
 *   explainSuggestion()    — why a category ranked at its position
 *   inspectExpenseContext() — full human-readable inspection report
 *
 * These are development/debug tools and explanation UI helpers.
 * Nothing in this module affects ranking or behavior.
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - No side effects. Output is plain data only.
 *   - Depends only on ExpenseContext and ScoredSuggestion.
 */

import type { ScoredSuggestion, SuggestionReason } from './suggestionEngine';
import type { ExpenseContext, ContextSignal } from '../types/expenseContext';

// ── View models ───────────────────────────────────────────────────────────────

export interface SuggestionExplanation {
  categoryId: string;
  score: number;
  rank: number;
  primaryReason: string;    // human-readable primary reason
  allReasons: string[];     // human-readable list of all reasons
  signals: ContextSignal[]; // signals from context that match this suggestion
  confidence: number;       // context.confidence.category
  isHabit: boolean;         // true when habit signal is active
  debugSummary: string;     // compact one-liner for logs/tooltips
}

export interface ContextInspectionReport {
  input: string;
  amount: string;
  merchant: string;
  merchantConfidence: string;
  itemTokens: string[];
  topCandidates: string[];     // "categoryId(score)" format
  confidenceProfile: string;   // "amount=X% merchant=Y% category=Z%"
  activeSignals: string[];     // "kind[source]" format
  flags: string[];             // diagnostic flags (e.g. UNKNOWN_MERCHANT)
  summary: string;             // single-line summary of the context
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Explain why a suggestion ranked at a specific position.
 *
 * @param suggestion — the ScoredSuggestion to explain
 * @param context    — the ExpenseContext it came from
 * @param rank       — 1-based rank (1 = top)
 */
export function explainSuggestion(
  suggestion: ScoredSuggestion,
  context: ExpenseContext,
  rank: number,
): SuggestionExplanation {
  const allReasons = suggestion.reasons.map(formatReason);
  const primaryReason = allReasons[0] ?? 'нет сигналов';
  const isHabit = suggestion.reasons.some((r) => r.kind === 'habit');

  const relatedSignals = context.signals.filter((s) =>
    suggestion.reasons.some((r) => r.kind === s.kind),
  );

  const debugSummary = `rank=${rank} score=${suggestion.score} signals=[${suggestion.reasons.map((r) => r.kind).join(',')}]`;

  return {
    categoryId: suggestion.categoryId,
    score: suggestion.score,
    rank,
    primaryReason,
    allReasons,
    signals: relatedSignals,
    confidence: context.confidence.category,
    isHabit,
    debugSummary,
  };
}

/**
 * Build a full inspection report for an ExpenseContext.
 * Used for debug panels, logging, and test assertions.
 */
export function inspectExpenseContext(context: ExpenseContext): ContextInspectionReport {
  const { confidence, signals, parserContext } = context;

  // Diagnostic flags
  const flags: string[] = [];
  if (parserContext.splitHints.some((h) => h.kind === 'large_amount'))    flags.push('LARGE_AMOUNT');
  if (parserContext.splitHints.some((h) => h.kind === 'multiple_items'))  flags.push('MULTIPLE_ITEMS');
  if (confidence.category < 0.3)                                          flags.push('LOW_CATEGORY_CONFIDENCE');
  if (confidence.merchant < 0.4)                                          flags.push('UNKNOWN_MERCHANT');
  if (context.candidateCategories.length === 0)                           flags.push('NO_CANDIDATES');
  if (context.amount === null)                                             flags.push('NO_AMOUNT');

  const topCandidates = context.candidateCategories
    .slice(0, 3)
    .map((c) => `${c.categoryId}(${c.score})`);

  const activeSignals = signals.map((s) => `${s.kind}[${s.source}]`);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const confidenceProfile = `amount=${pct(confidence.amount)} merchant=${pct(confidence.merchant)} category=${pct(confidence.category)}`;

  return {
    input: context.rawInput,
    amount: context.amount !== null ? String(context.amount) : 'none',
    merchant: context.merchant ?? 'none',
    merchantConfidence: pct(confidence.merchant),
    itemTokens: context.itemTokens,
    topCandidates,
    confidenceProfile,
    activeSignals,
    flags,
    summary: buildSummary(context, flags),
  };
}

/**
 * Explain all suggestions in ranked order.
 */
export function explainAllSuggestions(
  suggestions: ScoredSuggestion[],
  context: ExpenseContext,
): SuggestionExplanation[] {
  return suggestions.map((s, i) => explainSuggestion(s, context, i + 1));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatReason(reason: SuggestionReason): string {
  switch (reason.kind) {
    case 'merchant_history': return `история мерчанта (${reason.count}×)`;
    case 'habit':            return `подтверждённая привычка (${reason.count}×)`;
    case 'tag_history':      return `совместный split по тегу «${reason.tag}» (${reason.count}×)`;
    case 'recent_usage':     return `использовалось ${reason.daysSince}д назад`;
    case 'split_history':    return `в ${reason.comboCount} сохранённых комбо`;
    case 'name_match':       return 'совпадение по названию';
    case 'fallback':         return 'нет явных сигналов';
  }
}

function buildSummary(context: ExpenseContext, flags: string[]): string {
  const parts: string[] = [];
  if (context.amount !== null) parts.push(`${context.amount}`);
  if (context.merchant)        parts.push(`@${context.merchant}`);
  if (context.itemTokens.length > 0) parts.push(`[${context.itemTokens.join(' ')}]`);
  if (context.candidateCategories.length > 0) {
    const top = context.candidateCategories[0];
    parts.push(`→ ${top.categoryId}(${top.score})`);
  }
  if (flags.length > 0) parts.push(`⚠ ${flags.join(' ')}`);
  return parts.join(' ') || '(empty input)';
}
