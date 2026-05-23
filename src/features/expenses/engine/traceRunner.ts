/**
 * LAYER: trace runner — parseInputWithTrace() entry point.
 *
 * Runs each public pipeline stage independently with timing, then assembles
 * a ParserTrace. Calls parseInput() once for the authoritative final context
 * (which includes private stages: amount extraction, merchant detection).
 * The trace is additive — the hot path in parseInput() is not modified.
 *
 * Stage order matches inputPipeline.ts:
 *   1. normalize         — NFC + lowercase + collapse
 *   2. tokenize          — tokenizeAndClassify
 *   3. extractPhrases    — phraseExtractor.extractPhrases
 *   4. extractFragments  — fragmentExtractor.extractFragmentsFromPhrases
 *   5. buildScopes       — scopeResolver.buildSemanticScopes
 *   6. buildRelationships— purchaseGrouper.buildRelationships
 *   7. buildGroups       — purchaseGrouper.buildPurchaseGroups
 *   8. detectMerchant*   — derived from finalContext (private stage)
 *   9. buildContext*     — derived from finalContext (private stage)
 *   (* = reconstructed from ParserContext, not re-run)
 *
 * Architecture invariants:
 *   - All stages called with same inputs → identical outputs (deterministic).
 *   - No mutations to ParserContext.
 *   - traceRunner has zero UI dependencies.
 *   - The registry conflict list is computed once at module load (singleton).
 */

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import { normalizeText } from './inputNormalizer';
import { tokenizeAndClassify } from './tokenClassifier';
import { extractPhrases } from './phraseExtractor';
import { extractFragmentsFromPhrases } from './fragmentExtractor';
import { buildRelationships, buildPurchaseGroups } from './purchaseGrouper';
import { buildSemanticScopes } from './scopeResolver';
import { parseInput } from './inputPipeline';
import { getSemanticRegistry } from './semanticRegistryBuilder';
import type { ParserTrace, ParserTraceStage, SemanticConflictTrace } from './parserTrace';

// ── Stage builder helpers ─────────────────────────────────────────────────────

function stage(
  stageName: string,
  inputSnapshot: unknown,
  outputSnapshot: unknown,
  warnings: string[],
  timingMs: number,
): ParserTraceStage {
  return { stageName, inputSnapshot, outputSnapshot, warnings, timingMs };
}

// ── Empty trace (returned for blank input) ────────────────────────────────────

function emptyTrace(raw: string): ParserTrace {
  return {
    raw,
    stages: [
      stage('normalize', raw, '', [], 0),
    ],
    finalContext: parseInput(raw),
    clarificationHints: [],
    rankingSignals: [],
    semanticConflicts: buildConflictTraces(),
    totalTimingMs: 0,
  };
}

// ── Registry conflict traces (computed once) ──────────────────────────────────

function buildConflictTraces(): SemanticConflictTrace[] {
  return getSemanticRegistry().conflicts.map((c) => ({
    kind: c.kind,
    tokens: c.tokens,
    resolution: c.message,
    winnerId: c.winnerId,
  }));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run the full input pipeline with per-stage tracing enabled.
 *
 * Each public pipeline stage is called independently so timing and snapshots
 * can be captured. The authoritative ParserContext is produced by parseInput()
 * at the end (same result as calling parseInput() directly).
 *
 * Performance note: two pipeline runs occur (trace stages + parseInput).
 * Use only for debugging / constructor preview — not on the hot path.
 *
 * @param raw     Raw user input string.
 * @param memory  Optional suggestion memory (passed to merchant detection).
 * @returns       Full ParserTrace with stage snapshots and conflict metadata.
 */
export function parseInputWithTrace(
  raw: string,
  memory?: SuggestionMemoryState,
): ParserTrace {
  if (!raw.trim()) return emptyTrace(raw);

  const stages: ParserTraceStage[] = [];

  // Stage 1: normalize
  let t = Date.now();
  const normalizedInput = normalizeText(raw);
  stages.push(stage(
    'normalize',
    raw,
    normalizedInput,
    [],
    Date.now() - t,
  ));

  // Stage 2+3: tokenize + classify
  t = Date.now();
  const classified = tokenizeAndClassify(raw);
  stages.push(stage(
    'tokenize',
    { raw },
    classified.map((tok) => ({ kind: tok.kind, raw: tok.raw, normalized: tok.normalized })),
    [],
    Date.now() - t,
  ));

  // Stage: extractPhrases
  t = Date.now();
  const phrases = extractPhrases(classified, memory);
  stages.push(stage(
    'extractPhrases',
    { tokenCount: classified.length },
    phrases.map((p) => ({ id: p.id, type: p.type, rawText: p.rawText, confidence: p.confidence })),
    [],
    Date.now() - t,
  ));

  // Stage: extractFragments
  t = Date.now();
  const { fragments, clarificationHints } = extractFragmentsFromPhrases(phrases);
  const clarificationWarnings = clarificationHints.map((h) => `[${h.kind}] ${h.message}`);
  stages.push(stage(
    'extractFragments',
    { phraseCount: phrases.length },
    fragments.map((f) => ({ id: f.id, type: f.type, rawValue: f.rawValue, confidence: f.confidence })),
    clarificationWarnings,
    Date.now() - t,
  ));

  // Stage: buildScopes
  t = Date.now();
  const { scopes, scopeHints } = buildSemanticScopes(phrases);
  const scopeWarnings = scopeHints.map((h) => `[${h.kind}] ${h.message ?? h.phraseId}`);
  stages.push(stage(
    'buildScopes',
    { phraseCount: phrases.length },
    scopes.map((s) => ({
      id: s.id,
      type: s.type,
      rootPhraseId: s.rootPhraseId,
      modifiers: s.modifierPhraseIds.length,
      related: s.relatedPhraseIds.length,
    })),
    scopeWarnings,
    Date.now() - t,
  ));

  // Stage: buildRelationships
  t = Date.now();
  const relationships = buildRelationships(fragments);
  stages.push(stage(
    'buildRelationships',
    { fragmentCount: fragments.length },
    relationships.map((r) => ({
      type: r.type,
      from: r.fromFragmentId,
      to: r.toFragmentId,
      confidence: r.confidence,
    })),
    [],
    Date.now() - t,
  ));

  // Stage: buildGroups
  t = Date.now();
  const purchaseGroups = buildPurchaseGroups(fragments, clarificationHints);
  stages.push(stage(
    'buildGroups',
    { fragmentCount: fragments.length, hintCount: clarificationHints.length },
    purchaseGroups.map((g) => ({
      id: g.id,
      items: g.itemFragmentIds.length,
      suggestedSplit: g.suggestedSplit,
    })),
    [],
    Date.now() - t,
  ));

  // Full context from authoritative parseInput (includes private stages)
  const finalContext = parseInput(raw, memory);

  // Derived stage: detectMerchant — snapshot from final context
  stages.push(stage(
    'detectMerchant',
    { tokenCount: classified.filter((t) => t.kind === 'text').length },
    {
      merchant: finalContext.merchant,
      merchantKey: finalContext.merchantKey,
      itemCandidates: finalContext.itemCandidates,
    },
    finalContext.merchant === undefined
      ? ['no merchant detected — all tokens treated as merchant or items']
      : [],
    0, // private stage: no independent timing
  ));

  // Derived stage: buildContext — snapshot of final signals
  stages.push(stage(
    'buildContext',
    { amount: finalContext.amount, merchant: finalContext.merchant },
    {
      confidenceSignals: finalContext.confidenceSignals.map((s) => s.kind),
      splitHints: finalContext.splitHints.map((h) => h.kind),
      tags: finalContext.tags,
    },
    [],
    0,
  ));

  const semanticConflicts = buildConflictTraces();
  const totalTimingMs = stages.reduce((sum, s) => sum + (s.timingMs ?? 0), 0);

  return {
    raw,
    stages,
    finalContext,
    clarificationHints,
    rankingSignals: [],
    semanticConflicts,
    totalTimingMs,
  };
}

/**
 * Return only the stage names that fired for the given input.
 * Useful for lightweight "which stages ran" queries in tests.
 */
export function traceStageNames(raw: string, memory?: SuggestionMemoryState): string[] {
  return parseInputWithTrace(raw, memory).stages.map((s) => s.stageName);
}
