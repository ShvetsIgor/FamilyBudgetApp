/**
 * LAYER: semantic graph inspector — inspectable phrase/fragment/scope graph.
 *
 * Converts a ParserContext into a deterministic graph of nodes and edges
 * suitable for:
 *   - Constructor preview UI (visual graph rendering)
 *   - Automated inspection in tests
 *   - Future OCR / multi-purchase receipt support
 *
 * Graph structure:
 *   Nodes: one per phrase, fragment, scope, and purchase group.
 *   Edges: scope containment, fragment relationships, modifier ownership,
 *          group membership.
 *
 * Node kinds: 'phrase' | 'fragment' | 'scope' | 'group'
 * Edge kinds: 'phrase_to_fragment' | 'scoped_to' | 'modifies' | 'related_to' |
 *             'fragment_relationship' | 'in_group'
 *
 * Architecture invariants:
 *   - Pure function: same ParserContext → same SemanticGraph (deterministic).
 *   - No side effects, no mutations.
 *   - No AI, no embeddings, no probabilistic logic.
 */

import type { ParserContext } from './inputPipeline';

// ── Graph model ───────────────────────────────────────────────────────────────

export type GraphNodeKind = 'phrase' | 'fragment' | 'scope' | 'group';

export interface SemanticGraphNode {
  /** Stable id: phrase id / fragment id / scope id / group id. */
  id: string;
  kind: GraphNodeKind;
  /** Human-readable label (rawText or type+id). */
  label: string;
  /** Semantic type within kind (e.g., 'item_phrase', 'merchant', 'item_scope'). */
  type: string;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export type GraphEdgeKind =
  | 'phrase_to_fragment'    // phrase → fragment (same semantic unit, different layer)
  | 'scoped_to'             // fragment root → scope (scope owns the root phrase)
  | 'modifies'              // modifier phrase → scope (modifier belongs to scope)
  | 'related_to'            // tag phrase → scope (related but not modifying)
  | 'fragment_relationship' // fragment → fragment (from relationships[])
  | 'in_group';             // fragment → purchase group

export interface SemanticGraphEdge {
  fromId: string;
  toId: string;
  kind: GraphEdgeKind;
  confidence: number;
  label?: string;
}

export interface SemanticGraph {
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
  /** Quick stats for the constructor preview header. */
  stats: {
    phraseCount: number;
    fragmentCount: number;
    scopeCount: number;
    groupCount: number;
    edgeCount: number;
    hasSplitRecommendation: boolean;
    hasAmbiguity: boolean;
  };
}

// ── Node builders ─────────────────────────────────────────────────────────────

function buildPhraseNodes(ctx: ParserContext): SemanticGraphNode[] {
  return ctx.phrases.map((p) => ({
    id: p.id,
    kind: 'phrase' as GraphNodeKind,
    label: p.rawText || p.type,
    type: p.type,
    confidence: p.confidence,
    metadata: p.metadata,
  }));
}

function buildFragmentNodes(ctx: ParserContext): SemanticGraphNode[] {
  return ctx.fragments.map((f) => ({
    id: f.id,
    kind: 'fragment' as GraphNodeKind,
    label: f.rawValue || f.type,
    type: f.type,
    confidence: f.confidence,
    metadata: f.metadata,
  }));
}

function buildScopeNodes(ctx: ParserContext): SemanticGraphNode[] {
  return ctx.scopes.map((s) => ({
    id: s.id,
    kind: 'scope' as GraphNodeKind,
    label: `[${s.type}]`,
    type: s.type,
    confidence: s.confidence,
  }));
}

function buildGroupNodes(ctx: ParserContext): SemanticGraphNode[] {
  return ctx.purchaseGroups.map((g) => ({
    id: g.id,
    kind: 'group' as GraphNodeKind,
    label: `group:${g.id}`,
    type: g.suggestedSplit ? 'split_group' : 'single_group',
    confidence: 1.0,
    metadata: {
      suggestedSplit: g.suggestedSplit,
      signals: g.confidenceSignals,
    },
  }));
}

// ── Edge builders ─────────────────────────────────────────────────────────────

/**
 * Connect non-noise phrases to fragments.
 * Index-aligned: idx of non-noise phrase maps to fragment idx.
 */
function buildPhraseToFragmentEdges(ctx: ParserContext): SemanticGraphEdge[] {
  const nonNoise = ctx.phrases.filter((p) => p.type !== 'noise_phrase');
  return nonNoise.flatMap((phrase, idx) => {
    const fragment = ctx.fragments[idx];
    if (!fragment) return [];
    return [{
      fromId: phrase.id,
      toId: fragment.id,
      kind: 'phrase_to_fragment' as GraphEdgeKind,
      confidence: 1.0,
    }];
  });
}

function buildScopeEdges(ctx: ParserContext): SemanticGraphEdge[] {
  const edges: SemanticGraphEdge[] = [];

  for (const scope of ctx.scopes) {
    // Root phrase → scope
    edges.push({
      fromId: scope.rootPhraseId,
      toId: scope.id,
      kind: 'scoped_to',
      confidence: scope.confidence,
    });
    // Modifier phrases → scope
    for (const mid of scope.modifierPhraseIds) {
      edges.push({
        fromId: mid,
        toId: scope.id,
        kind: 'modifies',
        confidence: 0.70,
        label: 'modifies',
      });
    }
    // Related phrases → scope
    for (const rid of scope.relatedPhraseIds) {
      edges.push({
        fromId: rid,
        toId: scope.id,
        kind: 'related_to',
        confidence: 0.30,
        label: 'related',
      });
    }
  }

  return edges;
}

function buildFragmentRelationshipEdges(ctx: ParserContext): SemanticGraphEdge[] {
  return ctx.relationships.map((r) => ({
    fromId: r.fromFragmentId,
    toId: r.toFragmentId,
    kind: 'fragment_relationship' as GraphEdgeKind,
    confidence: r.confidence,
    label: r.type,
  }));
}

function buildGroupMembershipEdges(ctx: ParserContext): SemanticGraphEdge[] {
  const edges: SemanticGraphEdge[] = [];

  for (const group of ctx.purchaseGroups) {
    const memberIds = [
      ...(group.merchantFragmentId ? [group.merchantFragmentId] : []),
      ...(group.amountFragmentId ? [group.amountFragmentId] : []),
      ...group.itemFragmentIds,
      ...group.modifierFragmentIds,
    ];
    for (const fid of memberIds) {
      edges.push({
        fromId: fid,
        toId: group.id,
        kind: 'in_group',
        confidence: 1.0,
      });
    }
  }

  return edges;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build an inspectable semantic graph from a ParserContext.
 *
 * The graph captures all pipeline layers (phrases → fragments → scopes →
 * relationships → groups) as nodes and edges. Suitable for visual rendering
 * in the constructor preview panel.
 *
 * @param ctx  Output of parseInput() from inputPipeline.ts.
 * @returns    Deterministic graph with stats summary.
 */
export function buildSemanticGraph(ctx: ParserContext): SemanticGraph {
  const nodes: SemanticGraphNode[] = [
    ...buildPhraseNodes(ctx),
    ...buildFragmentNodes(ctx),
    ...buildScopeNodes(ctx),
    ...buildGroupNodes(ctx),
  ];

  const edges: SemanticGraphEdge[] = [
    ...buildPhraseToFragmentEdges(ctx),
    ...buildScopeEdges(ctx),
    ...buildFragmentRelationshipEdges(ctx),
    ...buildGroupMembershipEdges(ctx),
  ];

  const stats = {
    phraseCount: ctx.phrases.length,
    fragmentCount: ctx.fragments.length,
    scopeCount: ctx.scopes.length,
    groupCount: ctx.purchaseGroups.length,
    edgeCount: edges.length,
    hasSplitRecommendation: ctx.purchaseGroups.some((g) => g.suggestedSplit),
    hasAmbiguity: ctx.clarificationHints.length > 0 || ctx.scopeHints.length > 0,
  };

  return { nodes, edges, stats };
}

/**
 * Quick helper: return only nodes of a given kind.
 */
export function graphNodesOfKind(
  graph: SemanticGraph,
  kind: GraphNodeKind,
): SemanticGraphNode[] {
  return graph.nodes.filter((n) => n.kind === kind);
}

/**
 * Quick helper: return only edges of a given kind.
 */
export function graphEdgesOfKind(
  graph: SemanticGraph,
  kind: GraphEdgeKind,
): SemanticGraphEdge[] {
  return graph.edges.filter((e) => e.kind === kind);
}
