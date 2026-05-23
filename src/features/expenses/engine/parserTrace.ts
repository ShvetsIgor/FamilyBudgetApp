/**
 * LAYER: parser trace — runtime inspection model.
 *
 * A ParserTrace captures the full execution of the input pipeline for one
 * input string: every stage, every decision, every conflict, every signal.
 *
 * Designed for:
 *   - Constructor preview panel (see what the parser sees)
 *   - Semantic debugging (why did X match / not match?)
 *   - Regression inspection (automated trace comparison)
 *   - Ranking explainability (why did category Y rank first?)
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - All fields are deterministically derived from pipeline outputs.
 *   - Tracing is opt-in via parseInputWithTrace(); hot path is unaffected.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import type { ParserContext } from './inputPipeline';
import type { ClarificationHint } from './semanticFragment';

// ── Per-stage trace ───────────────────────────────────────────────────────────

/**
 * Snapshot of one pipeline stage: what went in, what came out, any warnings.
 *
 * inputSnapshot / outputSnapshot are lightweight summaries — not full clones.
 * Exact shape depends on the stage (defined by traceRunner.ts).
 *
 * timingMs is wall-clock elapsed for this stage. May be 0 on fast machines
 * (Date.now() resolution). Use for relative comparisons, not absolute profiling.
 */
export interface ParserTraceStage {
  stageName: string;
  inputSnapshot: unknown;
  outputSnapshot: unknown;
  warnings: string[];
  timingMs?: number;
}

// ── Semantic conflict trace ───────────────────────────────────────────────────

/**
 * A conflict detected in the semantic registry at trace time.
 * Maps RegistryConflict → a lighter, trace-oriented shape.
 */
export interface SemanticConflictTrace {
  kind: string;
  tokens: string[];
  resolution: string;
  winnerId?: string;
}

// ── Ranking signal trace ──────────────────────────────────────────────────────

/**
 * Explains why a category received a particular score.
 *
 * signals[] contains one entry per signal that fired.
 * Each entry carries the signal kind, its weight, the raw contribution,
 * and an optional detail string (e.g., the merchant key that triggered it).
 */
export interface RankingSignalEntry {
  kind: string;
  weight: number;
  contribution: number;
  detail?: string;
}

export interface RankingSignalTrace {
  categoryId: string;
  totalScore: number;
  rank: number;
  signals: RankingSignalEntry[];
  /** Human-readable summary of why this category ranked here. */
  summary: string;
}

// ── Full parser trace ─────────────────────────────────────────────────────────

/**
 * Full trace for one parseInput() run.
 *
 * stages[]            — ordered pipeline stage snapshots
 * finalContext        — the ParserContext produced (authoritative)
 * clarificationHints  — clarification hints from fragment extraction
 * rankingSignals      — per-category ranking signal breakdown (empty when
 *                       no memory / categories provided to the trace runner)
 * semanticConflicts   — conflicts from the semantic registry (build-time)
 * totalTimingMs       — sum of per-stage timings (approximate)
 */
export interface ParserTrace {
  raw: string;
  stages: ParserTraceStage[];
  finalContext: ParserContext;
  clarificationHints: ClarificationHint[];
  rankingSignals: RankingSignalTrace[];
  semanticConflicts: SemanticConflictTrace[];
  totalTimingMs: number;
}
