/**
 * LAYER: constructor bridge — runtime-to-constructor integration.
 *
 * Bridges live SemanticSession data into constructor-layer operations:
 *   - createAliasFromSession   → SemanticOperation (for a changeset)
 *   - resolveConflictFromSession → SemanticOperation
 *   - approveParserCorrection  → SemanticAction
 *   - buildSessionTimeline     → SemanticEventTimeline (alias for buildTimelineFromSession)
 *
 * The bridge is one-directional: session → constructor.
 * It never mutates sessions or the production registry.
 *
 * Future AI/OCR compatibility:
 *   All functions accept an optional `externalContext` parameter (reserved for
 *   future AI suggestions or OCR correction flows). Currently unused — kept for
 *   forward compatibility.
 *
 * Architecture invariants:
 *   - Pure functions. No side effects.
 *   - No imports from UI, hooks, or slices.
 *   - Does not call getSemanticRegistry() — accepts registry state via parameter.
 */

import type { SemanticSession } from './semanticSession';
import type { SemanticAction } from './semanticAction';
import type { SemanticOperation } from './semanticChangeset';
import type { SemanticEventTimeline } from './semanticEventTimeline';
import type { RegistryConflict } from './semanticRegistry';
import { buildTimelineFromSession } from './semanticEventTimeline';
import { nextActionId } from './resolutionEngine';

// ── Operation builders ────────────────────────────────────────────────────────

let _opSeq = 0;

function nextOpId(): string {
  return `op_bridge_${Date.now()}_${_opSeq++}`;
}

/** Reset bridge ID sequence — for testing only. */
export function resetBridgeIds(): void {
  _opSeq = 0;
}

/**
 * Create a SemanticOperation (add_alias) from a session's unknown merchant token.
 * The resulting operation can be added to a SemanticChangeSet and applied via
 * semanticSimulator.applyChangeset().
 */
export function createAliasFromSession(
  session: SemanticSession,
  merchantToken: string,
  canonicalMerchantKey: string,
): SemanticOperation {
  return {
    id: nextOpId(),
    type: 'add_alias',
    payload: {
      token: merchantToken,
      canonicalKey: canonicalMerchantKey,
      sourceSessionId: session.id,
    },
    description: `Add alias "${merchantToken}" → "${canonicalMerchantKey}" (derived from session ${session.id})`,
  };
}

/**
 * Create a SemanticOperation to resolve a registry conflict observed during a session.
 * Uses archive_entry to remove the lower-precedence conflicting entry.
 */
export function resolveConflictFromSession(
  session: SemanticSession,
  conflict: RegistryConflict,
): SemanticOperation {
  // Archive the lower-precedence entry in the conflict
  const entryToArchive = conflict.entryIds[conflict.entryIds.length - 1] ?? '';

  return {
    id: nextOpId(),
    type: 'archive_entry',
    payload: {
      entryId: entryToArchive,
      reason: `Conflict kind="${conflict.kind}" resolved from session ${session.id}`,
      conflictKind: conflict.kind,
      allConflictingIds: conflict.entryIds,
    },
    description: `Archive conflicting entry "${entryToArchive}" (${conflict.kind}) from session ${session.id}`,
  };
}

/**
 * Create a SemanticAction that approves a specific session correction.
 * Source is always 'constructor' — this comes from the inspector/editor, not the user.
 */
export function approveParserCorrection(
  session: SemanticSession,
  correctionId: string,
): SemanticAction {
  const correction = session.corrections.find((c) => c.id === correctionId);

  return {
    id: nextActionId(),
    createdAt: Date.now(),
    type: 'change_category',
    payload: {
      correctionId,
      correctionType: correction?.type ?? 'unknown',
      approved: true,
      description: correction?.description ?? '',
    },
    source: 'constructor',
    sessionId: session.id,
  };
}

/**
 * Build the semantic event timeline for a session.
 * Alias of buildTimelineFromSession with optional actions — provided here
 * so constructor tooling has a single import point.
 */
export function buildSessionTimeline(
  session: SemanticSession,
  actions: SemanticAction[] = [],
): SemanticEventTimeline {
  return buildTimelineFromSession(session, actions);
}

// ── Inspection helpers ────────────────────────────────────────────────────────

/**
 * Extract all unknown merchant tokens from the session's current context.
 * Useful for the constructor's "add alias" workflow.
 */
export function extractUnknownMerchants(session: SemanticSession): string[] {
  const ctx = session.parserContexts[session.parserContexts.length - 1];
  if (!ctx) return [];

  return ctx.clarificationHints
    .filter((h) => h.kind === 'unknown_merchant')
    .map((h) => h.fragmentId);
}

/**
 * Returns true if the session has any corrections that altered the merchant token.
 * Used to detect when a constructor alias would be helpful.
 */
export function hasMerchantCorrections(session: SemanticSession): boolean {
  return session.corrections.some((c) => c.type === 'merchant_correction');
}

/**
 * Summarize session state for the constructor inspector panel.
 * Returns a plain object safe for display/logging.
 */
export function summarizeSessionForConstructor(session: SemanticSession): {
  id: string;
  status: string;
  corrections: number;
  parserPasses: number;
  unresolvedHints: number;
  suggestedSplits: number;
  hasMerchantCorrections: boolean;
} {
  const ctx = session.parserContexts[session.parserContexts.length - 1];

  return {
    id: session.id,
    status: session.status,
    corrections: session.corrections.length,
    parserPasses: session.parserContexts.length,
    unresolvedHints: ctx?.clarificationHints.length ?? 0,
    suggestedSplits: session.pendingGroups.filter((g) => g.suggestedSplit).length,
    hasMerchantCorrections: hasMerchantCorrections(session),
  };
}
