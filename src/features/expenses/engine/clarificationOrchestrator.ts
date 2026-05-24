/**
 * LAYER: clarification orchestrator — minimal, prioritized clarification strategy.
 *
 * Manages clarification state transitions:
 *   - Builds ClarificationState from a ParserContext
 *   - Prioritizes hints to ask one question at a time (minimal clarification)
 *   - Resolves individual hints as user answers them
 *   - Computes ambiguity level
 *   - Batches related ambiguities to avoid clarification spam
 *
 * Hint priority order (highest → lowest):
 *   1. conflicting_signals  — multiple merchants detected; must resolve first
 *   2. unknown_merchant     — no dictionary/memory match; core disambiguation
 *   3. ambiguous_item       — merchant needs context to determine category
 *   4. multiple_categories  — multiple categories possible; optional split
 *
 * Architecture invariants:
 *   - Pure functions: same inputs → same outputs (deterministic).
 *   - No mutations — always returns new state objects.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import type { ClarificationHint } from './semanticFragment';
import type { ClarificationState } from './semanticSession';
import type { ParserContext } from './inputPipeline';

// ── Priority map ──────────────────────────────────────────────────────────────

const HINT_PRIORITY: Record<string, number> = {
  conflicting_signals:  0,
  unknown_merchant:     1,
  ambiguous_item:       2,
  multiple_categories:  3,
};

function hintPriority(hint: ClarificationHint): number {
  return HINT_PRIORITY[hint.kind] ?? 99;
}

// ── Ambiguity level ───────────────────────────────────────────────────────────

/**
 * Compute a normalized ambiguity score [0, 1].
 * 0 = no ambiguity. 1 = maximum ambiguity (all original hints still pending).
 */
export function computeAmbiguityLevel(
  pendingCount: number,
  totalAtStart: number,
): number {
  if (totalAtStart === 0) return 0;
  return Math.min(1, pendingCount / totalAtStart);
}

// ── Question generator ────────────────────────────────────────────────────────

/**
 * Generate the active question string for the highest-priority pending hint.
 * Returns undefined if no hints are pending.
 */
export function getActiveQuestion(pendingHints: ClarificationHint[]): string | undefined {
  if (pendingHints.length === 0) return undefined;
  const sorted = [...pendingHints].sort((a, b) => hintPriority(a) - hintPriority(b));
  return sorted[0].message;
}

// ── Hint batching ─────────────────────────────────────────────────────────────

export interface ClarificationHintGroup {
  priority: number;
  kind: string;
  hints: ClarificationHint[];
}

/**
 * Group hints by kind and sort groups by priority.
 * Useful for showing batched clarification UI (all same-kind hints together).
 */
export function batchClarificationHints(
  hints: ClarificationHint[],
): ClarificationHintGroup[] {
  const groups = new Map<string, ClarificationHint[]>();
  for (const hint of hints) {
    const existing = groups.get(hint.kind) ?? [];
    existing.push(hint);
    groups.set(hint.kind, existing);
  }

  return [...groups.entries()]
    .map(([kind, kindHints]) => ({
      priority: HINT_PRIORITY[kind] ?? 99,
      kind,
      hints: kindHints,
    }))
    .sort((a, b) => a.priority - b.priority);
}

// ── State builders ────────────────────────────────────────────────────────────

/**
 * Build a fresh ClarificationState from a ParserContext.
 * Hints are prioritized; ambiguityLevel is 1.0 if any hints exist.
 */
export function buildClarificationState(ctx: ParserContext): ClarificationState {
  const hints = [...ctx.clarificationHints].sort(
    (a, b) => hintPriority(a) - hintPriority(b),
  );
  const total = hints.length;

  return {
    pendingHints: hints,
    resolvedHintIds: [],
    activeQuestion: getActiveQuestion(hints),
    ambiguityLevel: computeAmbiguityLevel(total, total),
    totalHintsAtStart: total,
  };
}

/**
 * Resolve one clarification hint by its fragmentId.
 * Returns a new ClarificationState with the hint removed from pending.
 * If no more pending hints, activeQuestion becomes undefined.
 */
export function resolveHint(
  state: ClarificationState,
  hintFragmentId: string,
): ClarificationState {
  const remaining = state.pendingHints.filter(
    (h) => h.fragmentId !== hintFragmentId,
  );
  const resolvedIds = [...state.resolvedHintIds, hintFragmentId];

  return {
    pendingHints: remaining,
    resolvedHintIds: resolvedIds,
    activeQuestion: getActiveQuestion(remaining),
    ambiguityLevel: computeAmbiguityLevel(remaining.length, state.totalHintsAtStart),
    totalHintsAtStart: state.totalHintsAtStart,
  };
}

/**
 * Prioritize hints array — returns sorted copy (highest priority first).
 * Does not mutate input.
 */
export function prioritizeClarificationHints(
  hints: ClarificationHint[],
): ClarificationHint[] {
  return [...hints].sort((a, b) => hintPriority(a) - hintPriority(b));
}

/**
 * Returns true when all clarification hints have been resolved.
 */
export function isFullyResolved(state: ClarificationState): boolean {
  return state.pendingHints.length === 0;
}

/**
 * Returns true if this context needs clarification at all.
 */
export function needsClarification(ctx: ParserContext): boolean {
  return ctx.clarificationHints.length > 0;
}
