/**
 * LAYER: resolution engine — semantic action application + state transitions.
 *
 * Applies SemanticActions to ResolutionState, producing a ResolutionTransition.
 * Does NOT mutate SemanticSession; session mutations remain in sessionManager.ts.
 * ResolutionState is a parallel view of "how resolved are we?" that sits
 * alongside the session.
 *
 * Key design:
 *   buildInitialResolutionState(session)            → fresh state from session
 *   applySemanticAction(state, action, session)      → ResolutionTransition
 *   deriveResolutionState(session, actions)          → replay all actions
 *   isResolutionComplete(state)                      → boolean
 *
 * Architecture invariants:
 *   - All functions pure and deterministic.
 *   - No session mutations — output is always a new ResolutionState.
 *   - ambiguityScore always in [0, 1].
 */

import type { SemanticSession } from './semanticSession';
import type { SemanticAction, ResolutionState } from './semanticAction';
import type { SemanticEvent } from './semanticEventTimeline';
import { buildSemanticEvent } from './semanticEventTimeline';

// ── ID generation ─────────────────────────────────────────────────────────────

let _actionSeq = 0;

export function nextActionId(): string {
  return `action_${Date.now()}_${_actionSeq++}`;
}

/** Reset action sequence — for testing only. */
export function resetActionIds(): void {
  _actionSeq = 0;
}

// ── Ambiguity score ───────────────────────────────────────────────────────────

/**
 * Ambiguity score: fraction of items still pending.
 * Denominator = all tracked items across every list (pending + resolved + auto + blocked).
 * Numerator    = items still pending (unresolved hints + pending groups).
 */
export function computeAmbiguityScore(state: Omit<ResolutionState, 'ambiguityScore'>): number {
  const pending = state.unresolvedHints.length + state.pendingGroups.length;
  const total =
    pending +
    state.resolvedGroups.length +
    state.autoResolvedHints.length +
    state.blockedResolutions.length;
  if (total === 0) return 0;
  return Math.min(1, pending / total);
}

// ── State builders ────────────────────────────────────────────────────────────

export function buildInitialResolutionState(session: SemanticSession): ResolutionState {
  const ctx = session.parserContexts[session.parserContexts.length - 1];
  const unresolvedHints = (ctx?.clarificationHints ?? []).map((h) => h.fragmentId);
  const pendingGroups = session.pendingGroups.map((g) => g.id);

  const partial = {
    resolvedGroups: [],
    pendingGroups,
    unresolvedHints,
    autoResolvedHints: [],
    blockedResolutions: [],
  };

  return { ...partial, ambiguityScore: computeAmbiguityScore(partial) };
}

/**
 * Deterministically replay all actions to produce the current ResolutionState.
 * Same session + same actions → same state (no side-effects).
 */
export function deriveResolutionState(
  session: SemanticSession,
  actions: SemanticAction[],
): ResolutionState {
  let state = buildInitialResolutionState(session);
  for (const action of actions) {
    state = applySemanticAction(state, action, session).newState;
  }
  return state;
}

// ── Transition model ──────────────────────────────────────────────────────────

export interface ResolutionTransition {
  newState: ResolutionState;
  event: SemanticEvent;
  appliedAction: SemanticAction;
  diagnostic: string;
}

// ── Action application ────────────────────────────────────────────────────────

export function applySemanticAction(
  state: ResolutionState,
  action: SemanticAction,
  session: SemanticSession,
): ResolutionTransition {
  switch (action.type) {
    case 'accept_suggestion':    return handleAcceptSuggestion(state, action);
    case 'reject_suggestion':    return handleRejectSuggestion(state, action);
    case 'resolve_clarification':return handleResolveClarification(state, action);
    case 'split_purchase':       return handleSplitPurchase(state, action);
    case 'merge_group':          return handleMergeGroup(state, action);
    case 'change_category':      return handleChangeCategory(state, action);
    case 'create_alias':         return handleCreateAlias(state, action);
    case 'ignore_merchant':      return handleIgnoreMerchant(state, action, session);
    case 'retry_parse':          return handleRetryParse(state, action);
  }
}

// ── Derived predicates ────────────────────────────────────────────────────────

export function isResolutionComplete(state: ResolutionState): boolean {
  return (
    state.pendingGroups.length === 0 &&
    state.unresolvedHints.length === 0 &&
    state.blockedResolutions.length === 0
  );
}

export function hasBlockedResolutions(state: ResolutionState): boolean {
  return state.blockedResolutions.length > 0;
}

export function pendingCount(state: ResolutionState): number {
  return state.unresolvedHints.length + state.pendingGroups.length;
}

// ── Handlers (private) ────────────────────────────────────────────────────────

function handleAcceptSuggestion(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  const groupId = (action.payload.groupId as string | undefined) ?? '';
  const newState = groupId ? resolveGroup(state, groupId) : state;

  return {
    newState,
    event: buildSemanticEvent('action_applied', action.sessionId, {
      actionType: action.type,
      groupId,
      categoryId: action.payload.categoryId,
    }),
    appliedAction: action,
    diagnostic: `Suggestion accepted${groupId ? ` for group ${groupId}` : ''}.`,
  };
}

function handleRejectSuggestion(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  const groupId = (action.payload.groupId as string | undefined) ?? '';
  const newState = groupId ? blockItem(state, groupId) : state;

  return {
    newState,
    event: buildSemanticEvent('action_applied', action.sessionId, {
      actionType: action.type,
      groupId,
      reason: action.payload.reason,
    }),
    appliedAction: action,
    diagnostic: `Suggestion rejected${groupId ? ` for group ${groupId}` : ''}. Group blocked.`,
  };
}

function handleResolveClarification(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  const hintId = action.payload.hintFragmentId as string;
  const wasUnresolved = state.unresolvedHints.includes(hintId);
  const partial = {
    ...state,
    unresolvedHints: state.unresolvedHints.filter((id) => id !== hintId),
  };
  const newState = { ...partial, ambiguityScore: computeAmbiguityScore(partial) };

  return {
    newState,
    event: buildSemanticEvent('clarification_resolved', action.sessionId, {
      hintFragmentId: hintId,
      chosenCategoryId: action.payload.chosenCategoryId,
      hintKind: action.payload.hintKind,
      source: action.source,
    }),
    appliedAction: action,
    diagnostic: wasUnresolved
      ? `Clarification resolved for hint ${hintId}.`
      : `Hint ${hintId} was not in unresolved list.`,
  };
}

function handleSplitPurchase(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  const groupId = action.payload.groupId as string;
  const categories = action.payload.categoryIds as string[];
  const newState = resolveGroup(state, groupId);

  return {
    newState,
    event: buildSemanticEvent('group_changed', action.sessionId, {
      actionType: 'split_purchase',
      groupId,
      categoryIds: categories,
    }),
    appliedAction: action,
    diagnostic: `Group ${groupId} split into ${categories.length} categories.`,
  };
}

function handleMergeGroup(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  const srcId = action.payload.sourceGroupId as string;
  const tgtId = action.payload.targetGroupId as string;
  const newPending = state.pendingGroups.filter((id) => id !== srcId && id !== tgtId);
  const newResolved = dedupe([...state.resolvedGroups, tgtId]);
  const partial = { ...state, pendingGroups: newPending, resolvedGroups: newResolved };
  const newState = { ...partial, ambiguityScore: computeAmbiguityScore(partial) };

  return {
    newState,
    event: buildSemanticEvent('group_changed', action.sessionId, {
      actionType: 'merge_group',
      sourceGroupId: srcId,
      targetGroupId: tgtId,
    }),
    appliedAction: action,
    diagnostic: `Group ${srcId} merged into ${tgtId}.`,
  };
}

function handleChangeCategory(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  const groupId = (action.payload.groupId as string | undefined) ?? '';
  // Changing category may unblock a previously blocked group
  const newBlocked = groupId
    ? state.blockedResolutions.filter((id) => id !== groupId)
    : state.blockedResolutions;
  const stateUnblocked = { ...state, blockedResolutions: newBlocked };
  const newState = groupId ? resolveGroup(stateUnblocked, groupId) : stateUnblocked;

  return {
    newState,
    event: buildSemanticEvent('correction_applied', action.sessionId, {
      correctionType: 'change_category',
      groupId,
      previousCategoryId: action.payload.previousCategoryId,
      newCategoryId: action.payload.newCategoryId,
    }),
    appliedAction: action,
    diagnostic: `Category changed to ${action.payload.newCategoryId}${groupId ? ` for group ${groupId}` : ''}.`,
  };
}

function handleCreateAlias(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  return {
    newState: state,
    event: buildSemanticEvent('action_applied', action.sessionId, {
      actionType: 'create_alias',
      token: action.payload.token,
      canonicalMerchantKey: action.payload.canonicalMerchantKey,
    }),
    appliedAction: action,
    diagnostic: `Alias "${action.payload.token}" → "${action.payload.canonicalMerchantKey}" created.`,
  };
}

function handleIgnoreMerchant(
  state: ResolutionState,
  action: SemanticAction,
  session: SemanticSession,
): ResolutionTransition {
  const tokenLower = (action.payload.merchantToken as string).toLowerCase();
  const ctx = session.parserContexts[session.parserContexts.length - 1];

  // Auto-resolve unknown_merchant hints whose fragmentId contains the merchant token
  const toAutoResolve = (ctx?.clarificationHints ?? [])
    .filter(
      (h) =>
        h.kind === 'unknown_merchant' &&
        h.fragmentId.toLowerCase().includes(tokenLower),
    )
    .map((h) => h.fragmentId)
    .filter((id) => state.unresolvedHints.includes(id));

  const partial = {
    ...state,
    unresolvedHints: state.unresolvedHints.filter((id) => !toAutoResolve.includes(id)),
    autoResolvedHints: dedupe([...state.autoResolvedHints, ...toAutoResolve]),
  };
  const newState = { ...partial, ambiguityScore: computeAmbiguityScore(partial) };

  return {
    newState,
    event: buildSemanticEvent('action_applied', action.sessionId, {
      actionType: 'ignore_merchant',
      merchantToken: action.payload.merchantToken,
      autoResolvedHintIds: toAutoResolve,
    }),
    appliedAction: action,
    diagnostic: `Merchant "${action.payload.merchantToken}" ignored. ${toAutoResolve.length} hint(s) auto-resolved.`,
  };
}

function handleRetryParse(
  state: ResolutionState,
  action: SemanticAction,
): ResolutionTransition {
  // Retry clears all pending ambiguity — a new parse will re-populate them
  const partial = {
    ...state,
    unresolvedHints: [],
    autoResolvedHints: [...state.autoResolvedHints],
    blockedResolutions: [],
  };
  const newState = { ...partial, ambiguityScore: computeAmbiguityScore(partial) };

  return {
    newState,
    event: buildSemanticEvent('parser_pass', action.sessionId, {
      trigger: 'retry_parse',
      reason: action.payload.reason,
      modifiedInput: action.payload.modifiedInput,
    }),
    appliedAction: action,
    diagnostic: `Parser retry triggered: ${action.payload.reason}. Unresolved hints cleared.`,
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function resolveGroup(state: ResolutionState, groupId: string): ResolutionState {
  const partial = {
    ...state,
    pendingGroups: state.pendingGroups.filter((id) => id !== groupId),
    resolvedGroups: dedupe([...state.resolvedGroups, groupId]),
  };
  return { ...partial, ambiguityScore: computeAmbiguityScore(partial) };
}

function blockItem(state: ResolutionState, id: string): ResolutionState {
  const partial = {
    ...state,
    pendingGroups: state.pendingGroups.filter((gId) => gId !== id),
    blockedResolutions: dedupe([...state.blockedResolutions, id]),
  };
  return { ...partial, ambiguityScore: computeAmbiguityScore(partial) };
}

function dedupe<T>(arr: T[]): T[] {
  return arr.filter((v, i, a) => a.indexOf(v) === i);
}
