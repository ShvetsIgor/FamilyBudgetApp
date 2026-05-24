/**
 * LAYER: resolution progress — UX-ready progress tracking.
 *
 * Converts ResolutionState + SessionAmbiguityReport into a ResolutionProjection
 * that the UI can render as a progress bar, status badge, or checklist.
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Same inputs → same output (deterministic).
 */

import type { ResolutionState } from './semanticAction';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { ResolutionProjection, ConfidenceLevel } from './runtimeProjection';

// ── Progress computation ──────────────────────────────────────────────────────

/**
 * Compute progress percent: what fraction of tracked items are done.
 * "Done" = resolvedGroups + autoResolvedHints (blocked counts as pending).
 */
export function computeProgressPercent(state: ResolutionState): number {
  const done = state.resolvedGroups.length + state.autoResolvedHints.length;
  const total =
    done +
    state.pendingGroups.length +
    state.unresolvedHints.length +
    state.blockedResolutions.length;
  if (total === 0) return 100;
  return Math.round((done / total) * 100);
}

/**
 * Derive a confidence level from the overall ambiguity score.
 *   high:   score < 20 (very little ambiguity remaining)
 *   medium: score 20–50
 *   low:    score 50–80
 *   none:   score > 80 (heavily ambiguous)
 */
export function deriveConfidenceLevel(scores: SessionAmbiguityReport): ConfidenceLevel {
  const s = scores.overallScore;
  if (s < 20) return 'high';
  if (s < 50) return 'medium';
  if (s < 80) return 'low';
  return 'none';
}

/**
 * Human-readable one-line summary of the resolution state.
 */
export function buildProgressSummary(projection: ResolutionProjection): string {
  if (projection.isComplete) return 'All ambiguities resolved — ready to save.';
  if (projection.blockedItems > 0) {
    return `${projection.blockedItems} blocked item(s). Change category to unblock.`;
  }
  const pending = projection.pendingItems;
  if (pending === 0) return 'Reviewing data before saving.';
  return `${pending} item(s) remaining (${projection.progressPercent}% done).`;
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildResolutionProjection(
  state: ResolutionState,
  scores: SessionAmbiguityReport,
): ResolutionProjection {
  const resolved = state.resolvedGroups.length + state.autoResolvedHints.length;
  const pending = state.unresolvedHints.length + state.pendingGroups.length;
  const blocked = state.blockedResolutions.length;
  const total = resolved + pending + blocked;
  const progressPercent = computeProgressPercent(state);
  const confidenceLevel = deriveConfidenceLevel(scores);
  const isComplete = pending === 0 && blocked === 0;

  const partial: Omit<ResolutionProjection, 'summary'> = {
    totalItems: total,
    resolvedItems: resolved,
    blockedItems: blocked,
    pendingItems: pending,
    progressPercent,
    confidenceLevel,
    isComplete,
  };

  return {
    ...partial,
    summary: buildProgressSummary({ ...partial, summary: '' }),
  };
}
