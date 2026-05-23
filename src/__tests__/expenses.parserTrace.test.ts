/**
 * Tests for Runtime Inspection & Semantic Debugging Toolkit:
 *   - traceRunner.ts       — parseInputWithTrace(), traceStageNames()
 *   - semanticGraphInspector.ts — buildSemanticGraph()
 *   - rankingExplainer.ts  — explainRankingSignals(), summarizeRanking()
 *   - parserTrace.ts       — ParserTrace type contract
 *
 * Coverage:
 *   - Trace structure and stage count
 *   - Stage names in correct order
 *   - Snapshot shapes (objects, not empty)
 *   - Timing is non-negative
 *   - Empty input → minimal trace
 *   - Semantic conflicts are exposed
 *   - Semantic graph nodes + edges
 *   - Graph stats consistency
 *   - Ranking explainer signal entries
 *   - Determinism across repeated calls
 */

import { describe, it, expect } from 'vitest';
import {
  parseInputWithTrace,
  traceStageNames,
} from '@/features/expenses/engine/traceRunner';
import {
  buildSemanticGraph,
  graphNodesOfKind,
  graphEdgesOfKind,
} from '@/features/expenses/engine/semanticGraphInspector';
import {
  explainRankingSignals,
  summarizeRanking,
} from '@/features/expenses/engine/rankingExplainer';
import { parseInput } from '@/features/expenses/engine/inputPipeline';
import type { ScoredSuggestion } from '@/features/expenses/engine/suggestionEngine';

// ── parseInputWithTrace — structure ───────────────────────────────────────────

describe('parseInputWithTrace — structure', () => {
  it('returns a ParserTrace object', () => {
    const trace = parseInputWithTrace('milk 100');
    expect(trace).toBeDefined();
    expect(typeof trace.raw).toBe('string');
    expect(Array.isArray(trace.stages)).toBe(true);
    expect(trace.finalContext).toBeDefined();
    expect(Array.isArray(trace.clarificationHints)).toBe(true);
    expect(Array.isArray(trace.rankingSignals)).toBe(true);
    expect(Array.isArray(trace.semanticConflicts)).toBe(true);
    expect(typeof trace.totalTimingMs).toBe('number');
  });

  it('raw field matches input', () => {
    const input = 'coffee 250';
    const trace = parseInputWithTrace(input);
    expect(trace.raw).toBe(input);
  });

  it('finalContext matches parseInput() output', () => {
    const input = 'milk 100';
    const trace = parseInputWithTrace(input);
    const ctx = parseInput(input);
    expect(trace.finalContext.amount).toBe(ctx.amount);
    expect(trace.finalContext.merchant).toBe(ctx.merchant);
    expect(trace.finalContext.normalizedInput).toBe(ctx.normalizedInput);
    expect(trace.finalContext.phrases.length).toBe(ctx.phrases.length);
  });

  it('empty input → minimal trace with at least normalize stage', () => {
    const trace = parseInputWithTrace('');
    expect(trace.stages.length).toBeGreaterThanOrEqual(1);
    expect(trace.stages[0].stageName).toBe('normalize');
  });

  it('empty input → empty clarificationHints', () => {
    const trace = parseInputWithTrace('');
    expect(trace.clarificationHints).toHaveLength(0);
  });
});

// ── Stage names and order ─────────────────────────────────────────────────────

describe('parseInputWithTrace — stage names', () => {
  it('contains normalize stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('normalize');
  });

  it('contains tokenize stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('tokenize');
  });

  it('contains extractPhrases stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('extractPhrases');
  });

  it('contains extractFragments stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('extractFragments');
  });

  it('contains buildScopes stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('buildScopes');
  });

  it('contains buildRelationships stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('buildRelationships');
  });

  it('contains buildGroups stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('buildGroups');
  });

  it('contains detectMerchant stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('detectMerchant');
  });

  it('contains buildContext stage', () => {
    const names = traceStageNames('milk 100');
    expect(names).toContain('buildContext');
  });

  it('normalize is the first stage', () => {
    const names = traceStageNames('milk 100');
    expect(names[0]).toBe('normalize');
  });

  it('tokenize comes before extractPhrases', () => {
    const names = traceStageNames('milk 100');
    expect(names.indexOf('tokenize')).toBeLessThan(names.indexOf('extractPhrases'));
  });

  it('extractPhrases comes before extractFragments', () => {
    const names = traceStageNames('milk 100');
    expect(names.indexOf('extractPhrases')).toBeLessThan(names.indexOf('extractFragments'));
  });
});

// ── Stage snapshots ───────────────────────────────────────────────────────────

describe('parseInputWithTrace — stage snapshots', () => {
  it('normalize stage outputSnapshot is a string', () => {
    const trace = parseInputWithTrace('Milk 100');
    const normalizeStage = trace.stages.find((s) => s.stageName === 'normalize')!;
    expect(typeof normalizeStage.outputSnapshot).toBe('string');
    expect(normalizeStage.outputSnapshot).toBe('milk 100');
  });

  it('tokenize stage outputSnapshot is an array', () => {
    const trace = parseInputWithTrace('milk 100');
    const tokenizeStage = trace.stages.find((s) => s.stageName === 'tokenize')!;
    expect(Array.isArray(tokenizeStage.outputSnapshot)).toBe(true);
  });

  it('extractPhrases stage outputSnapshot is an array', () => {
    const trace = parseInputWithTrace('milk 100');
    const stage = trace.stages.find((s) => s.stageName === 'extractPhrases')!;
    expect(Array.isArray(stage.outputSnapshot)).toBe(true);
  });

  it('detectMerchant stage outputSnapshot has merchant/merchantKey/itemCandidates', () => {
    const trace = parseInputWithTrace('milk 100');
    const stage = trace.stages.find((s) => s.stageName === 'detectMerchant')!;
    const snap = stage.outputSnapshot as Record<string, unknown>;
    expect('merchant' in snap).toBe(true);
    expect('merchantKey' in snap).toBe(true);
    expect('itemCandidates' in snap).toBe(true);
  });

  it('buildContext stage outputSnapshot has confidenceSignals', () => {
    const trace = parseInputWithTrace('milk 100');
    const stage = trace.stages.find((s) => s.stageName === 'buildContext')!;
    const snap = stage.outputSnapshot as Record<string, unknown>;
    expect(Array.isArray(snap.confidenceSignals)).toBe(true);
  });

  it('all stages have non-negative timingMs', () => {
    const trace = parseInputWithTrace('milk 100');
    for (const s of trace.stages) {
      if (s.timingMs !== undefined) {
        expect(s.timingMs).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('all stages have warnings array', () => {
    const trace = parseInputWithTrace('milk 100');
    for (const s of trace.stages) {
      expect(Array.isArray(s.warnings)).toBe(true);
    }
  });
});

// ── Warnings on ambiguous inputs ──────────────────────────────────────────────

describe('parseInputWithTrace — warnings', () => {
  it('extractFragments stage has warnings when clarification triggered', () => {
    // An unknown word with amount usually triggers unknown_merchant clarification
    const trace = parseInputWithTrace('xyzunknown 350');
    const stage = trace.stages.find((s) => s.stageName === 'extractFragments')!;
    if (trace.clarificationHints.length > 0) {
      expect(stage.warnings.length).toBeGreaterThan(0);
    }
  });

  it('clarificationHints in trace match finalContext.clarificationHints', () => {
    const trace = parseInputWithTrace('ice cream milk 200');
    expect(trace.clarificationHints).toEqual(trace.finalContext.clarificationHints);
  });
});

// ── Semantic conflicts ────────────────────────────────────────────────────────

describe('parseInputWithTrace — semanticConflicts', () => {
  it('semanticConflicts is an array', () => {
    const trace = parseInputWithTrace('milk 100');
    expect(Array.isArray(trace.semanticConflicts)).toBe(true);
  });

  it('each conflict has kind, tokens, resolution fields', () => {
    const trace = parseInputWithTrace('milk 100');
    for (const c of trace.semanticConflicts) {
      expect(typeof c.kind).toBe('string');
      expect(Array.isArray(c.tokens)).toBe(true);
      expect(typeof c.resolution).toBe('string');
    }
  });

  it('credit card phrase_overlap conflict is present', () => {
    const trace = parseInputWithTrace('credit card 100');
    const overlap = trace.semanticConflicts.find(
      (c) => c.kind === 'phrase_overlap' && c.tokens.join(' ') === 'credit card',
    );
    expect(overlap).toBeDefined();
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('parseInputWithTrace — determinism', () => {
  it('same input → same stage names', () => {
    const n1 = traceStageNames('milk 100');
    const n2 = traceStageNames('milk 100');
    expect(n1).toEqual(n2);
  });

  it('same input → same finalContext', () => {
    const t1 = parseInputWithTrace('ice cream 150');
    const t2 = parseInputWithTrace('ice cream 150');
    expect(t1.finalContext.amount).toBe(t2.finalContext.amount);
    expect(t1.finalContext.phrases.length).toBe(t2.finalContext.phrases.length);
    expect(t1.clarificationHints.length).toBe(t2.clarificationHints.length);
  });

  it('same input → same conflict list', () => {
    const t1 = parseInputWithTrace('milk 100');
    const t2 = parseInputWithTrace('milk 100');
    expect(t1.semanticConflicts.length).toBe(t2.semanticConflicts.length);
  });
});

// ── buildSemanticGraph — nodes ────────────────────────────────────────────────

describe('buildSemanticGraph — nodes', () => {
  it('returns SemanticGraph with nodes and edges', () => {
    const ctx = parseInput('milk 100');
    const graph = buildSemanticGraph(ctx);
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
    expect(graph.stats).toBeDefined();
  });

  it('empty input → empty nodes and edges', () => {
    const ctx = parseInput('');
    const graph = buildSemanticGraph(ctx);
    expect(graph.nodes).toHaveLength(0);
    expect(graph.edges).toHaveLength(0);
  });

  it('phrase nodes count matches ctx.phrases', () => {
    const ctx = parseInput('milk without sugar 100');
    const graph = buildSemanticGraph(ctx);
    const phraseNodes = graphNodesOfKind(graph, 'phrase');
    expect(phraseNodes.length).toBe(ctx.phrases.length);
  });

  it('fragment nodes count matches ctx.fragments', () => {
    const ctx = parseInput('milk without sugar 100');
    const graph = buildSemanticGraph(ctx);
    const fragmentNodes = graphNodesOfKind(graph, 'fragment');
    expect(fragmentNodes.length).toBe(ctx.fragments.length);
  });

  it('scope nodes count matches ctx.scopes', () => {
    const ctx = parseInput('milk without sugar 100');
    const graph = buildSemanticGraph(ctx);
    const scopeNodes = graphNodesOfKind(graph, 'scope');
    expect(scopeNodes.length).toBe(ctx.scopes.length);
  });

  it('group nodes count matches ctx.purchaseGroups', () => {
    const ctx = parseInput('milk 100');
    const graph = buildSemanticGraph(ctx);
    const groupNodes = graphNodesOfKind(graph, 'group');
    expect(groupNodes.length).toBe(ctx.purchaseGroups.length);
  });

  it('all nodes have id, kind, type, confidence', () => {
    const ctx = parseInput('ice cream 50');
    const graph = buildSemanticGraph(ctx);
    for (const node of graph.nodes) {
      expect(typeof node.id).toBe('string');
      expect(typeof node.kind).toBe('string');
      expect(typeof node.type).toBe('string');
      expect(typeof node.confidence).toBe('number');
    }
  });
});

// ── buildSemanticGraph — edges ────────────────────────────────────────────────

describe('buildSemanticGraph — edges', () => {
  it('phrase_to_fragment edges exist when fragments exist', () => {
    const ctx = parseInput('milk 100');
    const graph = buildSemanticGraph(ctx);
    if (ctx.fragments.length > 0) {
      const p2f = graphEdgesOfKind(graph, 'phrase_to_fragment');
      expect(p2f.length).toBeGreaterThan(0);
    }
  });

  it('scoped_to edges exist when scopes exist', () => {
    const ctx = parseInput('milk 100');
    const graph = buildSemanticGraph(ctx);
    if (ctx.scopes.length > 0) {
      const scoped = graphEdgesOfKind(graph, 'scoped_to');
      expect(scoped.length).toBeGreaterThan(0);
    }
  });

  it('modifies edges appear when scope has modifier phrases', () => {
    const ctx = parseInput('milk without sugar 100');
    const graph = buildSemanticGraph(ctx);
    const modifyingScopes = ctx.scopes.filter((s) => s.modifierPhraseIds.length > 0);
    if (modifyingScopes.length > 0) {
      const modEdges = graphEdgesOfKind(graph, 'modifies');
      expect(modEdges.length).toBeGreaterThan(0);
    }
  });

  it('fragment_relationship edges match ctx.relationships count', () => {
    const ctx = parseInput('milk bread 100');
    const graph = buildSemanticGraph(ctx);
    const relEdges = graphEdgesOfKind(graph, 'fragment_relationship');
    expect(relEdges.length).toBe(ctx.relationships.length);
  });

  it('all edges have fromId, toId, kind, confidence', () => {
    const ctx = parseInput('ice cream 50');
    const graph = buildSemanticGraph(ctx);
    for (const edge of graph.edges) {
      expect(typeof edge.fromId).toBe('string');
      expect(typeof edge.toId).toBe('string');
      expect(typeof edge.kind).toBe('string');
      expect(typeof edge.confidence).toBe('number');
    }
  });
});

// ── buildSemanticGraph — stats ────────────────────────────────────────────────

describe('buildSemanticGraph — stats', () => {
  it('stats.phraseCount matches ctx.phrases.length', () => {
    const ctx = parseInput('milk 100');
    const graph = buildSemanticGraph(ctx);
    expect(graph.stats.phraseCount).toBe(ctx.phrases.length);
  });

  it('stats.fragmentCount matches ctx.fragments.length', () => {
    const ctx = parseInput('milk 100');
    const graph = buildSemanticGraph(ctx);
    expect(graph.stats.fragmentCount).toBe(ctx.fragments.length);
  });

  it('stats.edgeCount matches graph.edges.length', () => {
    const ctx = parseInput('milk without sugar 100');
    const graph = buildSemanticGraph(ctx);
    expect(graph.stats.edgeCount).toBe(graph.edges.length);
  });

  it('stats.hasSplitRecommendation reflects purchaseGroups', () => {
    const ctx = parseInput('milk 100');
    const graph = buildSemanticGraph(ctx);
    const expected = ctx.purchaseGroups.some((g) => g.suggestedSplit);
    expect(graph.stats.hasSplitRecommendation).toBe(expected);
  });

  it('stats.hasAmbiguity reflects clarificationHints or scopeHints', () => {
    const ctx = parseInput('xyzunknown 100');
    const graph = buildSemanticGraph(ctx);
    const expected = ctx.clarificationHints.length > 0 || ctx.scopeHints.length > 0;
    expect(graph.stats.hasAmbiguity).toBe(expected);
  });
});

// ── buildSemanticGraph — determinism ──────────────────────────────────────────

describe('buildSemanticGraph — determinism', () => {
  it('same ctx → same graph', () => {
    const ctx = parseInput('milk without sugar 100');
    const g1 = buildSemanticGraph(ctx);
    const g2 = buildSemanticGraph(ctx);
    expect(g1.nodes.length).toBe(g2.nodes.length);
    expect(g1.edges.length).toBe(g2.edges.length);
    expect(g1.stats).toEqual(g2.stats);
  });
});

// ── explainRankingSignals ─────────────────────────────────────────────────────

describe('explainRankingSignals', () => {
  const mockSuggestions: ScoredSuggestion[] = [
    {
      categoryId: 'groceries',
      score: 60,
      reasons: [
        { kind: 'merchant_history', count: 5 },
        { kind: 'habit', count: 4 },
      ],
    },
    {
      categoryId: 'snacks',
      score: 20,
      reasons: [
        { kind: 'recent_usage', daysSince: 5 },
      ],
    },
    {
      categoryId: 'other',
      score: 0,
      reasons: [{ kind: 'fallback' }],
    },
  ];

  it('returns array of same length as input', () => {
    const traces = explainRankingSignals(mockSuggestions);
    expect(traces.length).toBe(mockSuggestions.length);
  });

  it('rank field matches array index', () => {
    const traces = explainRankingSignals(mockSuggestions);
    traces.forEach((t, idx) => expect(t.rank).toBe(idx));
  });

  it('totalScore matches suggestion.score', () => {
    const traces = explainRankingSignals(mockSuggestions);
    traces.forEach((t, idx) => expect(t.totalScore).toBe(mockSuggestions[idx].score));
  });

  it('categoryId preserved', () => {
    const traces = explainRankingSignals(mockSuggestions);
    expect(traces[0].categoryId).toBe('groceries');
    expect(traces[1].categoryId).toBe('snacks');
  });

  it('merchant_history signal entry has correct weight', () => {
    const traces = explainRankingSignals(mockSuggestions);
    const merchantSignal = traces[0].signals.find((s) => s.kind === 'merchant_history');
    expect(merchantSignal).toBeDefined();
    expect(merchantSignal!.weight).toBe(50);
  });

  it('merchant_history at count=5 (saturation) → contribution = 50', () => {
    const traces = explainRankingSignals(mockSuggestions);
    const signal = traces[0].signals.find((s) => s.kind === 'merchant_history')!;
    expect(signal.contribution).toBe(50);
  });

  it('habit signal → flat contribution = weight', () => {
    const traces = explainRankingSignals(mockSuggestions);
    const habit = traces[0].signals.find((s) => s.kind === 'habit')!;
    expect(habit.contribution).toBe(habit.weight);
  });

  it('fallback signal → contribution = 0', () => {
    const traces = explainRankingSignals(mockSuggestions);
    const fallback = traces[2].signals.find((s) => s.kind === 'fallback')!;
    expect(fallback.contribution).toBe(0);
  });

  it('recent_usage with daysSince=0 → full contribution', () => {
    const sug: ScoredSuggestion[] = [{
      categoryId: 'food',
      score: 20,
      reasons: [{ kind: 'recent_usage', daysSince: 0 }],
    }];
    const traces = explainRankingSignals(sug);
    const signal = traces[0].signals[0];
    expect(signal.contribution).toBe(20);
  });

  it('recent_usage with daysSince=30 → contribution ≈ 0', () => {
    const sug: ScoredSuggestion[] = [{
      categoryId: 'food',
      score: 0,
      reasons: [{ kind: 'recent_usage', daysSince: 30 }],
    }];
    const traces = explainRankingSignals(sug);
    expect(traces[0].signals[0].contribution).toBe(0);
  });

  it('each signal has a non-empty detail string', () => {
    const traces = explainRankingSignals(mockSuggestions);
    for (const trace of traces) {
      for (const signal of trace.signals) {
        expect(typeof signal.detail).toBe('string');
        expect(signal.detail!.length).toBeGreaterThan(0);
      }
    }
  });

  it('summary strings are non-empty', () => {
    const traces = explainRankingSignals(mockSuggestions);
    for (const t of traces) {
      expect(typeof t.summary).toBe('string');
      expect(t.summary.length).toBeGreaterThan(0);
    }
  });

  it('empty suggestions → empty traces', () => {
    expect(explainRankingSignals([])).toHaveLength(0);
  });
});

// ── summarizeRanking ──────────────────────────────────────────────────────────

describe('summarizeRanking', () => {
  it('returns string array of same length as suggestions', () => {
    const sug: ScoredSuggestion[] = [
      { categoryId: 'a', score: 50, reasons: [{ kind: 'merchant_history', count: 3 }] },
    ];
    const summaries = summarizeRanking(sug);
    expect(summaries).toHaveLength(1);
    expect(typeof summaries[0]).toBe('string');
  });

  it('fallback suggestion summary mentions position', () => {
    const sug: ScoredSuggestion[] = [
      { categoryId: 'a', score: 0, reasons: [{ kind: 'fallback' }] },
    ];
    const summaries = summarizeRanking(sug);
    expect(summaries[0]).toContain('1');
  });
});
