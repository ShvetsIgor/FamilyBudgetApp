/**
 * LAYER: resolution diagnostics — explainability layer for the resolution runtime.
 *
 * Answers "why?" questions about the resolution state:
 *   - Why is this clarification still unresolved?
 *   - Why was this group split suggested?
 *   - Why is this resolution blocked?
 *   - Why did a parser retry occur?
 *   - Why was this semantic action triggered?
 *
 * Each answer is a DiagnosticReason with a code, human-readable message,
 * and evidence list for inspection.
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - All reasons are deterministic given the same inputs.
 *   - No AI, no probabilistic reasoning.
 */

import type { ClarificationHint } from './semanticFragment';
import type { PurchaseGroup } from './purchaseGroup';
import type { SemanticAction } from './semanticAction';
import type { ResolutionState } from './semanticAction';
import type { SemanticSession } from './semanticSession';
import type { SemanticAction as _A } from './semanticAction';
import {
  isResolutionComplete,
  hasBlockedResolutions,
  pendingCount,
} from './resolutionEngine';

// ── Diagnostic model ──────────────────────────────────────────────────────────

export type DiagnosticReasonCode =
  | 'HINT_AWAITING_USER_INPUT'
  | 'HINT_KIND_REQUIRES_DECISION'
  | 'HINT_ALREADY_RESOLVED'
  | 'HINT_AUTO_RESOLVED'
  | 'GROUP_SPLIT_BY_CATEGORY_UNION'
  | 'GROUP_SPLIT_BY_CLARIFICATION_HINT'
  | 'GROUP_NO_SPLIT_SIGNAL'
  | 'RESOLUTION_BLOCKED_BY_REJECTION'
  | 'RESOLUTION_BLOCKED_BY_NO_ACTION'
  | 'PARSER_RETRY_INPUT_CORRECTED'
  | 'PARSER_RETRY_MERCHANT_CHANGED'
  | 'PARSER_RETRY_USER_REQUESTED'
  | 'ACTION_TRIGGERED_BY_USER'
  | 'ACTION_TRIGGERED_BY_RUNTIME'
  | 'ACTION_TRIGGERED_BY_CONSTRUCTOR';

export interface DiagnosticReason {
  code: DiagnosticReasonCode;
  message: string;
  evidence: string[];
}

export interface ResolutionReport {
  sessionId: string;
  resolutionState: ResolutionState;
  /** Diagnostic per unresolved hint ID. */
  unresolvedReasons: Record<string, DiagnosticReason>;
  /** Diagnostic per blocked ID. */
  blockedReasons: Record<string, DiagnosticReason>;
  /** Diagnostic per group ID with suggested split. */
  splitReasons: Record<string, DiagnosticReason>;
  overallDiagnostic: string;
  isCompletelyResolved: boolean;
}

// ── Hint diagnostics ──────────────────────────────────────────────────────────

/**
 * Explain why a specific clarification hint is still unresolved.
 */
export function explainUnresolvedHint(
  hintId: string,
  state: ResolutionState,
  allHints: ClarificationHint[],
): DiagnosticReason {
  if (state.autoResolvedHints.includes(hintId)) {
    return {
      code: 'HINT_AUTO_RESOLVED',
      message: `Hint ${hintId} was auto-resolved by runtime policy.`,
      evidence: [`hintId=${hintId}`, 'auto_resolved=true'],
    };
  }

  if (!state.unresolvedHints.includes(hintId)) {
    return {
      code: 'HINT_ALREADY_RESOLVED',
      message: `Hint ${hintId} has already been resolved.`,
      evidence: [`hintId=${hintId}`, 'in_unresolvedHints=false'],
    };
  }

  const hint = allHints.find((h) => h.fragmentId === hintId);
  if (!hint) {
    return {
      code: 'HINT_AWAITING_USER_INPUT',
      message: `Hint ${hintId} is pending user input (hint data not available).`,
      evidence: [`hintId=${hintId}`],
    };
  }

  const kindMessages: Record<string, string> = {
    conflicting_signals: 'Multiple merchants detected — user must choose the correct one.',
    unknown_merchant: 'Merchant not found in dictionary or memory — user must identify it.',
    ambiguous_item: 'Item category cannot be determined without merchant context.',
    multiple_categories: 'Multiple categories are possible — user must select or split.',
  };

  return {
    code: 'HINT_KIND_REQUIRES_DECISION',
    message: kindMessages[hint.kind] ?? `Hint kind "${hint.kind}" requires user decision.`,
    evidence: [
      `hintId=${hintId}`,
      `kind=${hint.kind}`,
      `candidates=[${hint.candidates.join(', ')}]`,
    ],
  };
}

// ── Split diagnostics ─────────────────────────────────────────────────────────

/**
 * Explain why a purchase group has suggestedSplit = true.
 */
export function explainSplitSuggestion(group: PurchaseGroup): DiagnosticReason {
  if (!group.suggestedSplit) {
    return {
      code: 'GROUP_NO_SPLIT_SIGNAL',
      message: `Group ${group.id} has no split suggestion.`,
      evidence: [`groupId=${group.id}`, 'suggestedSplit=false'],
    };
  }

  const hasCategorySignal = group.confidenceSignals.some((s) =>
    s.toLowerCase().includes('category'),
  );
  const hasHintSignal = group.confidenceSignals.some((s) =>
    s.toLowerCase().includes('hint') || s.toLowerCase().includes('clarification'),
  );

  if (hasHintSignal) {
    return {
      code: 'GROUP_SPLIT_BY_CLARIFICATION_HINT',
      message: `Group ${group.id} split suggested because clarification hints indicate multiple items.`,
      evidence: [
        `groupId=${group.id}`,
        `confidenceSignals=[${group.confidenceSignals.join(', ')}]`,
        `itemFragmentCount=${group.itemFragmentIds.length}`,
      ],
    };
  }

  return {
    code: 'GROUP_SPLIT_BY_CATEGORY_UNION',
    message: `Group ${group.id} split suggested because item fragments map to multiple categories.`,
    evidence: [
      `groupId=${group.id}`,
      `confidenceSignals=[${group.confidenceSignals.join(', ')}]`,
      `itemFragmentCount=${group.itemFragmentIds.length}`,
    ],
  };
}

// ── Blocked diagnostics ───────────────────────────────────────────────────────

/**
 * Explain why a group/hint is in blockedResolutions.
 */
export function explainBlockedResolution(
  id: string,
  state: ResolutionState,
  actions: SemanticAction[],
): DiagnosticReason {
  if (!state.blockedResolutions.includes(id)) {
    return {
      code: 'RESOLUTION_BLOCKED_BY_NO_ACTION',
      message: `Item ${id} is not currently blocked.`,
      evidence: [`id=${id}`, 'in_blockedResolutions=false'],
    };
  }

  // Find the reject_suggestion action that caused the block
  const rejectAction = [...actions].reverse().find(
    (a) => a.type === 'reject_suggestion' && a.payload.groupId === id,
  );

  if (rejectAction) {
    return {
      code: 'RESOLUTION_BLOCKED_BY_REJECTION',
      message: `Group ${id} was explicitly rejected by ${rejectAction.source}.`,
      evidence: [
        `id=${id}`,
        `actionId=${rejectAction.id}`,
        `source=${rejectAction.source}`,
        `reason=${String(rejectAction.payload.reason ?? 'none')}`,
      ],
    };
  }

  return {
    code: 'RESOLUTION_BLOCKED_BY_REJECTION',
    message: `Group ${id} is blocked (no specific rejection action found in history).`,
    evidence: [`id=${id}`],
  };
}

// ── Parser retry diagnostics ──────────────────────────────────────────────────

/**
 * Explain why a retry_parse action was triggered.
 */
export function explainParserRetry(action: SemanticAction): DiagnosticReason {
  if (action.type !== 'retry_parse') {
    return {
      code: 'PARSER_RETRY_USER_REQUESTED',
      message: `Action ${action.id} is not a retry_parse action.`,
      evidence: [`actionType=${action.type}`],
    };
  }

  const reason = String(action.payload.reason ?? '');
  const modifiedInput = action.payload.modifiedInput as string | undefined;

  if (modifiedInput) {
    return {
      code: 'PARSER_RETRY_INPUT_CORRECTED',
      message: `Parser retry triggered because input was corrected: "${reason}".`,
      evidence: [
        `actionId=${action.id}`,
        `reason=${reason}`,
        `modifiedInput="${modifiedInput}"`,
        `source=${action.source}`,
      ],
    };
  }

  if (reason.toLowerCase().includes('merchant')) {
    return {
      code: 'PARSER_RETRY_MERCHANT_CHANGED',
      message: `Parser retry triggered due to merchant change: "${reason}".`,
      evidence: [`actionId=${action.id}`, `reason=${reason}`, `source=${action.source}`],
    };
  }

  return {
    code: 'PARSER_RETRY_USER_REQUESTED',
    message: `Parser retry requested: "${reason}".`,
    evidence: [`actionId=${action.id}`, `reason=${reason}`, `source=${action.source}`],
  };
}

// ── Action trigger diagnostics ────────────────────────────────────────────────

/**
 * Explain why a semantic action was triggered (by source).
 */
export function explainActionTrigger(action: SemanticAction): DiagnosticReason {
  const codeMap: Partial<Record<string, DiagnosticReasonCode>> = {
    user:        'ACTION_TRIGGERED_BY_USER',
    runtime:     'ACTION_TRIGGERED_BY_RUNTIME',
    // eslint-disable-next-line @typescript-eslint/dot-notation
    ['constructor']: 'ACTION_TRIGGERED_BY_CONSTRUCTOR',
  } as Record<string, DiagnosticReasonCode>;
  const code = codeMap[action.source] ?? 'ACTION_TRIGGERED_BY_USER';

  const messages: Record<string, string> = {
    user:        `Action "${action.type}" triggered by explicit user interaction.`,
    runtime:     `Action "${action.type}" triggered automatically by runtime policy.`,
    constructor: `Action "${action.type}" triggered by constructor tooling.`,
  };

  return {
    code,
    message: messages[action.source] ?? `Action "${action.type}" triggered by ${action.source}.`,
    evidence: [
      `actionId=${action.id}`,
      `type=${action.type}`,
      `source=${action.source}`,
      `sessionId=${action.sessionId}`,
    ],
  };
}

// ── Full resolution report ────────────────────────────────────────────────────

/**
 * Build a complete ResolutionReport for a session.
 * Includes diagnostics for every unresolved hint, blocked item, and suggested split.
 */
export function buildResolutionReport(
  session: SemanticSession,
  state: ResolutionState,
  actions: SemanticAction[],
): ResolutionReport {
  const ctx = session.parserContexts[session.parserContexts.length - 1];
  const allHints = ctx?.clarificationHints ?? [];
  const allGroups = [...session.pendingGroups, ...session.resolvedGroups];

  // Unresolved hint diagnostics
  const unresolvedReasons: Record<string, DiagnosticReason> = {};
  for (const hintId of state.unresolvedHints) {
    unresolvedReasons[hintId] = explainUnresolvedHint(hintId, state, allHints);
  }

  // Blocked diagnostics
  const blockedReasons: Record<string, DiagnosticReason> = {};
  for (const id of state.blockedResolutions) {
    blockedReasons[id] = explainBlockedResolution(id, state, actions);
  }

  // Split suggestion diagnostics
  const splitReasons: Record<string, DiagnosticReason> = {};
  for (const group of allGroups) {
    if (group.suggestedSplit) {
      splitReasons[group.id] = explainSplitSuggestion(group);
    }
  }

  const complete = isResolutionComplete(state);
  const pending = pendingCount(state);
  const blocked = state.blockedResolutions.length;

  let overallDiagnostic: string;
  if (complete && !hasBlockedResolutions(state)) {
    overallDiagnostic = 'All ambiguities resolved. Session ready to persist.';
  } else if (blocked > 0) {
    overallDiagnostic = `${blocked} blocked resolution(s). User must change category or retry.`;
  } else {
    overallDiagnostic = `${pending} pending item(s) awaiting resolution (${state.unresolvedHints.length} hints, ${state.pendingGroups.length} groups).`;
  }

  return {
    sessionId: session.id,
    resolutionState: state,
    unresolvedReasons,
    blockedReasons,
    splitReasons,
    overallDiagnostic,
    isCompletelyResolved: complete && !hasBlockedResolutions(state),
  };
}
