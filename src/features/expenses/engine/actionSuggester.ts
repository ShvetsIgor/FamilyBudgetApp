/**
 * LAYER: action suggester — derives the next recommended runtime action.
 *
 * Analyzes session state, resolution state, policy decisions, and ambiguity
 * scores to suggest the most impactful action the user or runtime should take.
 *
 * Suggestion priority (highest → lowest):
 *   1. conflicting_signals → resolve_merchant (high urgency)
 *   2. unknown_merchant    → resolve_merchant OR create_alias (high urgency)
 *   3. blocked resolutions → retry_parse or resolve_merchant (high urgency)
 *   4. suggestedSplit with ask → confirm_split (medium urgency)
 *   5. all auto_resolve   → accept_suggestion (low urgency)
 *   6. low-score hints    → ignore_ambiguity (low urgency)
 *   7. no pending items   → accept_suggestion (low urgency)
 *
 * All suggestions include a label + description for UI rendering.
 * All suggestions are explainable (reason is derivable from the input).
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Deterministic: same inputs → same suggestion.
 *   - No AI, no probabilistic reasoning.
 */

import type { SemanticSession } from './semanticSession';
import type { ResolutionState } from './semanticAction';
import type { PolicyEvaluationResult } from './runtimePolicy';
import type { SessionAmbiguityReport } from './ambiguityScorer';
import type { RuntimeActionSuggestion, ActionSuggestionType } from './runtimeProjection';

// ── ID generation ─────────────────────────────────────────────────────────────

let _suggSeq = 0;

export function nextSuggestionId(): string {
  return `sugg_${Date.now()}_${_suggSeq++}`;
}

export function resetSuggestionIds(): void {
  _suggSeq = 0;
}

// ── Suggestion builders ───────────────────────────────────────────────────────

function makeSuggestion(
  type: ActionSuggestionType,
  label: string,
  description: string,
  urgency: RuntimeActionSuggestion['urgency'],
  targetId?: string,
): RuntimeActionSuggestion {
  return { id: nextSuggestionId(), type, label, description, urgency, targetId };
}

// ── Primary entry point ───────────────────────────────────────────────────────

/**
 * Suggest the single most important action for the current session state.
 * Returns undefined when there is nothing left to do.
 */
export function suggestNextAction(
  session: SemanticSession,
  state: ResolutionState,
  evalResult: PolicyEvaluationResult,
  scores: SessionAmbiguityReport,
): RuntimeActionSuggestion | undefined {
  const all = buildActionSuggestions(session, state, evalResult, scores);
  return all[0];
}

/**
 * Build all applicable action suggestions, sorted by urgency and type priority.
 */
export function buildActionSuggestions(
  session: SemanticSession,
  state: ResolutionState,
  evalResult: PolicyEvaluationResult,
  scores: SessionAmbiguityReport,
): RuntimeActionSuggestion[] {
  const suggestions: RuntimeActionSuggestion[] = [];

  // 1. Conflicting signals → resolve merchant
  const conflictHints = state.unresolvedHints.filter((id) => {
    const ctx = session.parserContexts[session.parserContexts.length - 1];
    return ctx?.clarificationHints.some(
      (h) => h.fragmentId === id && h.kind === 'conflicting_signals',
    );
  });
  if (conflictHints.length > 0) {
    suggestions.push(makeSuggestion(
      'resolve_merchant',
      'Resolve merchant conflict',
      `${conflictHints.length} competing merchant signal(s) detected. Choose the correct one.`,
      'high',
      conflictHints[0],
    ));
  }

  // 2. Unknown merchant → resolve or create alias
  const unknownHints = state.unresolvedHints.filter((id) => {
    const ctx = session.parserContexts[session.parserContexts.length - 1];
    return ctx?.clarificationHints.some(
      (h) => h.fragmentId === id && h.kind === 'unknown_merchant',
    );
  });
  if (unknownHints.length > 0) {
    suggestions.push(makeSuggestion(
      'resolve_merchant',
      'Identify unknown merchant',
      'Merchant not found in dictionary. Identify it or add as an alias.',
      'high',
      unknownHints[0],
    ));
    if (session.corrections.some((c) => c.type === 'merchant_correction')) {
      suggestions.push(makeSuggestion(
        'create_alias',
        'Create merchant alias',
        'You corrected this merchant before — add an alias to remember it.',
        'medium',
        unknownHints[0],
      ));
    }
  }

  // 3. Blocked resolutions → retry parse
  if (state.blockedResolutions.length > 0) {
    suggestions.push(makeSuggestion(
      'retry_parse',
      'Retry with corrections',
      `${state.blockedResolutions.length} blocked item(s). Change category or retry the parse.`,
      'high',
    ));
  }

  // 4. Suggested split groups with ask decision
  const splitGroups = state.pendingGroups.filter((id) => {
    const group = session.pendingGroups.find((g) => g.id === id);
    const hasSplitDecision = evalResult.decisions.some(
      (d) => d.targetId === id && d.action === 'ask',
    );
    return group?.suggestedSplit && hasSplitDecision;
  });
  if (splitGroups.length > 0) {
    suggestions.push(makeSuggestion(
      'confirm_split',
      'Review split purchase',
      `${splitGroups.length} purchase group(s) suggested for split. Review and confirm categories.`,
      'medium',
      splitGroups[0],
    ));
  }

  // 5. All decisions are auto_resolve → accept suggestion
  const hasOnlyAutoResolve =
    evalResult.decisions.length > 0 &&
    evalResult.decisions.every((d) => d.action === 'auto_resolve');
  if (hasOnlyAutoResolve) {
    suggestions.push(makeSuggestion(
      'accept_suggestion',
      'Accept suggestion',
      'All ambiguities can be auto-resolved. Accept the suggestion to proceed.',
      'low',
    ));
  }

  // 6. Low-score ambiguities → ignore
  const lowScoreHints = state.unresolvedHints.filter((id) => {
    const s = scores.scores.find((sc) => sc.evidence.some((e) => e.includes(id)));
    return s && s.score < 30;
  });
  if (lowScoreHints.length > 0 && conflictHints.length === 0 && unknownHints.length === 0) {
    suggestions.push(makeSuggestion(
      'ignore_ambiguity',
      'Ignore low-confidence hints',
      `${lowScoreHints.length} low-impact ambiguity hint(s) can be safely ignored.`,
      'low',
    ));
  }

  // 7. Nothing pending → accept suggestion
  if (
    state.unresolvedHints.length === 0 &&
    state.pendingGroups.length === 0 &&
    state.blockedResolutions.length === 0 &&
    suggestions.length === 0
  ) {
    suggestions.push(makeSuggestion(
      'accept_suggestion',
      'Save expense',
      'All information is resolved. Ready to save the expense.',
      'low',
    ));
  }

  return suggestions;
}

// ── Filtering ─────────────────────────────────────────────────────────────────

export function filterSuggestionsByUrgency(
  suggestions: RuntimeActionSuggestion[],
  urgency: RuntimeActionSuggestion['urgency'],
): RuntimeActionSuggestion[] {
  return suggestions.filter((s) => s.urgency === urgency);
}

export function filterSuggestionsByType(
  suggestions: RuntimeActionSuggestion[],
  type: ActionSuggestionType,
): RuntimeActionSuggestion[] {
  return suggestions.filter((s) => s.type === type);
}
