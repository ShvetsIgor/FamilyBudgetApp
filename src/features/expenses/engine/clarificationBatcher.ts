/**
 * LAYER: clarification batcher — grouped clarification strategy.
 *
 * Extends clarificationOrchestrator with:
 *   - Batch grouping to avoid clarification spam
 *   - Auto-resolution policy for low-noise hints
 *   - Prioritized presentation plan
 *   - High-impact ambiguity selection
 *
 * Auto-resolve policy (deterministic):
 *   - multiple_categories with ≤ 1 candidate: user has no real choice → auto-resolve.
 *   - All other kinds always require user input.
 *
 * Architecture invariants:
 *   - Pure functions. Same hints → same plan.
 *   - Does NOT mutate ClarificationState — returns new objects.
 *   - No AI, no probabilistic decisions.
 */

import type { ClarificationHint } from './semanticFragment';
import type { ResolutionState } from './semanticAction';
import {
  batchClarificationHints,
  type ClarificationHintGroup,
} from './clarificationOrchestrator';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Hint kinds that always require explicit user input, in priority order. */
const MANUAL_KINDS = ['conflicting_signals', 'unknown_merchant', 'ambiguous_item'] as const;

// ── Auto-resolve policy ───────────────────────────────────────────────────────

/**
 * Returns true when the hint can be resolved automatically without user input.
 *
 * Rule: multiple_categories with ≤ 1 candidate is trivially unambiguous.
 * Conflicting_signals, unknown_merchant, and ambiguous_item always need the user.
 */
export function canAutoResolveHint(hint: ClarificationHint): boolean {
  if (hint.kind === 'multiple_categories' && hint.candidates.length <= 1) return true;
  return false;
}

/**
 * Partition hints into auto-resolvable and those needing user input.
 * Returns: { resolved: fragmentId[], remaining: ClarificationHint[] }
 */
export function autoResolveHints(hints: ClarificationHint[]): {
  resolved: string[];
  remaining: ClarificationHint[];
} {
  const resolved: string[] = [];
  const remaining: ClarificationHint[] = [];

  for (const hint of hints) {
    if (canAutoResolveHint(hint)) {
      resolved.push(hint.fragmentId);
    } else {
      remaining.push(hint);
    }
  }

  return { resolved, remaining };
}

// ── Clarification plan ────────────────────────────────────────────────────────

export interface ClarificationPlan {
  /** Batched groups to present to the user, in priority order. */
  toAsk: ClarificationHintGroup[];
  /** Fragment IDs auto-resolved by runtime policy. */
  autoResolved: string[];
  /** The single highest-priority group to show first. */
  nextBatch: ClarificationHintGroup | undefined;
  /** Total hints requiring user action. */
  totalUserActionRequired: number;
}

/**
 * Build a full clarification plan from a raw hint list.
 * Separates auto-resolvable hints, batches the rest by kind, and
 * picks the highest-priority batch as the next question to show.
 */
export function buildClarificationPlan(hints: ClarificationHint[]): ClarificationPlan {
  const { resolved, remaining } = autoResolveHints(hints);
  const batches = batchClarificationHints(remaining);

  return {
    toAsk: batches,
    autoResolved: resolved,
    nextBatch: batches[0],
    totalUserActionRequired: remaining.length,
  };
}

/**
 * Select the next batch to present (highest priority from toAsk).
 * Returns undefined if all hints are resolved.
 */
export function selectNextBatch(
  batches: ClarificationHintGroup[],
): ClarificationHintGroup | undefined {
  return batches[0];
}

// ── Impact scoring ────────────────────────────────────────────────────────────

/**
 * Score a hint by its impact on resolution.
 * Higher = more important to resolve first.
 *
 * conflicting_signals(0) > unknown_merchant(1) > ambiguous_item(2) > multiple_categories(3)
 * Within same kind: more candidates = higher impact.
 */
export function hintImpactScore(hint: ClarificationHint): number {
  const kindScore =
    hint.kind === 'conflicting_signals' ? 100 :
    hint.kind === 'unknown_merchant'    ? 75 :
    hint.kind === 'ambiguous_item'      ? 50 :
    hint.kind === 'multiple_categories' ? 25 : 0;
  return kindScore + hint.candidates.length;
}

/**
 * Sort hints by impact score descending (highest-impact first).
 */
export function sortByImpact(hints: ClarificationHint[]): ClarificationHint[] {
  return [...hints].sort((a, b) => hintImpactScore(b) - hintImpactScore(a));
}

// ── Resolution state helpers ──────────────────────────────────────────────────

/**
 * Apply auto-resolve policy to a ResolutionState.
 * Moves auto-resolvable hints from unresolvedHints → autoResolvedHints.
 * Used when resolution state is first built or after re-parse.
 */
export function applyAutoResolvePolicy(
  state: ResolutionState,
  allHints: ClarificationHint[],
): ResolutionState {
  const pendingHints = allHints.filter((h) => state.unresolvedHints.includes(h.fragmentId));
  const { resolved } = autoResolveHints(pendingHints);

  if (resolved.length === 0) return state;

  const newUnresolved = state.unresolvedHints.filter((id) => !resolved.includes(id));
  const newAutoResolved = [...state.autoResolvedHints, ...resolved].filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );

  const pending = newUnresolved.length + state.pendingGroups.length;
  const total = pending + state.resolvedGroups.length + newAutoResolved.length + state.blockedResolutions.length;
  const ambiguityScore = total === 0 ? 0 : Math.min(1, pending / total);

  return {
    ...state,
    unresolvedHints: newUnresolved,
    autoResolvedHints: newAutoResolved,
    ambiguityScore,
  };
}

/**
 * Returns true when this hint kind requires user input (never auto-resolved).
 */
export function isManualResolutionRequired(hint: ClarificationHint): boolean {
  return (MANUAL_KINDS as ReadonlyArray<string>).includes(hint.kind);
}
