/**
 * LAYER: ambiguity scorer — structured, explainable ambiguity measurement.
 *
 * Converts raw parser signals (hints, scope hints, split hints, groups)
 * into structured AmbiguityScore objects with an explicit kind, score,
 * evidence list, and auto-resolvability flag.
 *
 * Score range: 0–100.
 *   90  conflicting_signals   — multiple merchants competing
 *   80  unknown_merchant      — merchant unrecognized
 *   70  orphan_amount         — amount present but no anchor (merchant/item)
 *   60  merchant_ambiguity    — merchant detected but weak signal
 *   50  category_ambiguity    — item kind ambiguous (ambiguous_item hint)
 *   40  conflicting_modifiers — modifier attaches to ambiguous target
 *   30  category_ambiguity    — multiple categories possible (multiple_categories hint)
 *   25  unresolved_split      — purchase group suggests split but not confirmed
 *
 * Architecture invariants:
 *   - Pure functions. Same inputs → same output.
 *   - No AI, no probabilistic reasoning.
 *   - Every score has evidence[] for inspection.
 */

import type { ParserContext } from './inputPipeline';
import type { ClarificationHint } from './semanticFragment';
import type { PurchaseGroup } from './purchaseGroup';
import type { ScopeHint } from './semanticScope';
import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';

// ── Score model ───────────────────────────────────────────────────────────────

export type AmbiguityKind =
  | 'merchant_ambiguity'
  | 'category_ambiguity'
  | 'orphan_amount'
  | 'conflicting_modifiers'
  | 'unresolved_split'
  | 'unknown_merchant'
  | 'conflicting_signals';

/** Base scores per kind (0–100). Higher = more ambiguous / higher priority to resolve. */
const BASE_SCORES: Record<AmbiguityKind, number> = {
  conflicting_signals:  90,
  unknown_merchant:     80,
  orphan_amount:        70,
  merchant_ambiguity:   60,
  category_ambiguity:   50,
  conflicting_modifiers:40,
  unresolved_split:     25,
};

export interface AmbiguityScore {
  /** What kind of ambiguity this is. */
  kind: AmbiguityKind;
  /** Numeric severity, 0–100. Higher = more ambiguous. */
  score: number;
  /** 0–1 confidence that this ambiguity is real (vs. noise). */
  confidence: number;
  /** Human-readable evidence for why this score was assigned. */
  evidence: string[];
  /** True when runtime can resolve without user input. */
  isAutoResolvable: boolean;
  /** Resolution priority order (0 = highest). Derived from score. */
  priority: number;
}

export interface SessionAmbiguityReport {
  sessionId: string;
  /** Weighted average of all scores, 0–100. */
  overallScore: number;
  scores: AmbiguityScore[];
  /** The kind contributing most to the overall score. */
  dominantKind: AmbiguityKind | undefined;
  autoResolvableCount: number;
  requiresUserCount: number;
}

// ── Hint scorers ──────────────────────────────────────────────────────────────

export function scoreHintAmbiguity(hint: ClarificationHint): AmbiguityScore {
  switch (hint.kind) {
    case 'conflicting_signals':
      return {
        kind: 'conflicting_signals',
        score: BASE_SCORES.conflicting_signals,
        confidence: 1.0,
        evidence: [
          `kind=${hint.kind}`,
          `fragmentId=${hint.fragmentId}`,
          `candidates=[${hint.candidates.join(', ')}]`,
        ],
        isAutoResolvable: false,
        priority: 0,
      };

    case 'unknown_merchant':
      return {
        kind: 'unknown_merchant',
        score: BASE_SCORES.unknown_merchant,
        confidence: 0.9,
        evidence: [`kind=${hint.kind}`, `fragmentId=${hint.fragmentId}`],
        isAutoResolvable: false,
        priority: 1,
      };

    case 'ambiguous_item':
      return {
        kind: 'category_ambiguity',
        score: BASE_SCORES.category_ambiguity,
        confidence: 0.75,
        evidence: [`kind=${hint.kind}`, `fragmentId=${hint.fragmentId}`],
        isAutoResolvable: false,
        priority: 2,
      };

    case 'multiple_categories': {
      const autoRes = hint.candidates.length <= 1;
      return {
        kind: 'category_ambiguity',
        score: autoRes ? 10 : BASE_SCORES.unresolved_split + 5,
        confidence: autoRes ? 0.3 : 0.6,
        evidence: [
          `kind=${hint.kind}`,
          `fragmentId=${hint.fragmentId}`,
          `candidates=${hint.candidates.length}`,
        ],
        isAutoResolvable: autoRes,
        priority: 3,
      };
    }
  }
}

export function scoreScopeHintAmbiguity(scopeHint: ScopeHint): AmbiguityScore {
  return {
    kind: 'conflicting_modifiers',
    score:
      scopeHint.kind === 'ambiguous_modifier_target'
        ? BASE_SCORES.conflicting_modifiers
        : 20,
    confidence: 0.65,
    evidence: [
      `scopeHintKind=${scopeHint.kind}`,
      `phraseId=${scopeHint.phraseId}`,
      `candidates=[${scopeHint.candidates.join(', ')}]`,
    ],
    isAutoResolvable: scopeHint.candidates.length <= 1,
    priority: 4,
  };
}

export function scoreGroupAmbiguity(group: PurchaseGroup): AmbiguityScore {
  return {
    kind: 'unresolved_split',
    score: group.suggestedSplit ? BASE_SCORES.unresolved_split : 5,
    confidence: group.suggestedSplit ? 0.8 : 0.2,
    evidence: [
      `groupId=${group.id}`,
      `suggestedSplit=${group.suggestedSplit}`,
      `items=${group.itemFragmentIds.length}`,
      `signals=[${group.confidenceSignals.join(', ')}]`,
    ],
    isAutoResolvable: !group.suggestedSplit,
    priority: 5,
  };
}

export function scoreOrphanAmount(ctx: ParserContext): AmbiguityScore | undefined {
  if (ctx.amount === undefined) return undefined;
  const hasAnchor = ctx.merchant !== undefined || ctx.fragments.length > 0;
  if (hasAnchor) return undefined;

  return {
    kind: 'orphan_amount',
    score: BASE_SCORES.orphan_amount,
    confidence: 0.85,
    evidence: [
      `amount=${ctx.amount}`,
      'no_merchant=true',
      `fragments=${ctx.fragments.length}`,
    ],
    isAutoResolvable: false,
    priority: 1,
  };
}

// ── Session-level ambiguity report ────────────────────────────────────────────

/**
 * Build a complete ambiguity report for a session.
 * Combines hint scores, scope hint scores, group scores, and orphan amount.
 */
export function scoreSessionAmbiguity(
  session: SemanticSession,
  state: ResolutionState,
): SessionAmbiguityReport {
  const ctx = session.parserContexts[session.parserContexts.length - 1];
  const scores: AmbiguityScore[] = [];

  if (ctx) {
    // Score only hints that are still unresolved
    for (const hint of ctx.clarificationHints) {
      if (state.unresolvedHints.includes(hint.fragmentId)) {
        scores.push(scoreHintAmbiguity(hint));
      }
    }

    // Scope hints (modifier conflicts)
    for (const scopeHint of ctx.scopeHints) {
      scores.push(scoreScopeHintAmbiguity(scopeHint));
    }

    // Orphan amount
    const orphan = scoreOrphanAmount(ctx);
    if (orphan) scores.push(orphan);
  }

  // Pending groups
  for (const group of session.pendingGroups) {
    if (state.pendingGroups.includes(group.id)) {
      scores.push(scoreGroupAmbiguity(group));
    }
  }

  const overallScore = computeOverallAmbiguityScore(scores);
  const dominantKind = findDominantKind(scores);

  return {
    sessionId: session.id,
    overallScore,
    scores,
    dominantKind,
    autoResolvableCount: scores.filter((s) => s.isAutoResolvable).length,
    requiresUserCount: scores.filter((s) => !s.isAutoResolvable).length,
  };
}

/**
 * Compute a single aggregate score from a list of AmbiguityScores.
 * Uses a weighted maximum approach: the highest score dominates,
 * with minor contributions from lower scores.
 */
export function computeOverallAmbiguityScore(scores: AmbiguityScore[]): number {
  if (scores.length === 0) return 0;
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const max = sorted[0].score;
  // Each additional score adds 10% of its value (diminishing returns)
  const additional = sorted.slice(1).reduce((acc, s) => acc + s.score * 0.1, 0);
  return Math.min(100, Math.round(max + additional));
}

/** Find the kind with the highest score. */
export function findDominantKind(scores: AmbiguityScore[]): AmbiguityKind | undefined {
  if (scores.length === 0) return undefined;
  return scores.reduce((best, s) => (s.score > best.score ? s : best)).kind;
}

/** Score lookup by kind (for policy threshold comparisons). */
export function baseScoreForKind(kind: AmbiguityKind): number {
  return BASE_SCORES[kind] ?? 0;
}
