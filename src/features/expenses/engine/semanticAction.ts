/**
 * LAYER: semantic action — user/runtime/constructor action model.
 *
 * SemanticAction is a discrete decision in the resolution lifecycle.
 * ResolutionState tracks which groups/hints are resolved, pending, or blocked.
 *
 * Action sources:
 *   user        — direct user gesture (button tap, form submit)
 *   runtime     — auto-resolved by runtime policy (low-noise hints, etc.)
 *   constructor — issued by constructor tooling (registry editor, session inspector)
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - Actions are immutable records; never mutated after creation.
 *   - ResolutionState is derived from session + applied actions (no in-place edits).
 */

// ── Action types ──────────────────────────────────────────────────────────────

export type SemanticActionType =
  | 'accept_suggestion'    // user confirms a category suggestion for a group
  | 'reject_suggestion'    // user rejects a suggestion (group becomes blocked)
  | 'resolve_clarification'// user answers a clarification hint question
  | 'split_purchase'       // user requests purchase split into multiple categories
  | 'merge_group'          // user merges two purchase groups
  | 'change_category'      // user overrides the category of a group/fragment
  | 'create_alias'         // user/constructor creates a merchant alias
  | 'ignore_merchant'      // user marks an unknown merchant as ignorable
  | 'retry_parse';         // runtime/user requests a fresh parse pass

export type ActionSource = 'user' | 'runtime' | 'constructor';

export interface SemanticAction {
  id: string;
  createdAt: number;
  type: SemanticActionType;
  payload: Record<string, unknown>;
  source: ActionSource;
  sessionId: string;
}

// ── Typed payloads ────────────────────────────────────────────────────────────

export interface AcceptSuggestionPayload {
  categoryId: string;
  groupId?: string;
  suggestionScore?: number;
  merchantKey?: string;
}

export interface RejectSuggestionPayload {
  categoryId: string;
  groupId?: string;
  reason?: string;
}

export interface ResolveClarificationPayload {
  hintFragmentId: string;
  chosenCategoryId: string;
  hintKind: string;
}

export interface SplitPurchasePayload {
  groupId: string;
  categoryIds: string[];
}

export interface MergeGroupPayload {
  sourceGroupId: string;
  targetGroupId: string;
}

export interface ChangeCategoryPayload {
  fragmentId?: string;
  groupId?: string;
  previousCategoryId: string | undefined;
  newCategoryId: string;
}

export interface CreateAliasPayload {
  token: string;
  canonicalMerchantKey: string;
}

export interface IgnoreMerchantPayload {
  merchantToken: string;
  merchantKey?: string;
}

export interface RetryParsePayload {
  reason: string;
  modifiedInput?: string;
}

// ── Resolution state ──────────────────────────────────────────────────────────

/**
 * ResolutionState tracks how many ambiguities have been resolved.
 * Derived deterministically from session + applied SemanticActions.
 *
 * ambiguityScore: normalized [0, 1].
 *   0 = no pending items.
 *   1 = all items still pending (session just created).
 *   Computed as: (unresolvedHints + pendingGroups) / max(1, all tracked items).
 */
export interface ResolutionState {
  /** Group IDs that have been confirmed/accepted/split. */
  resolvedGroups: string[];
  /** Group IDs still awaiting a user or runtime decision. */
  pendingGroups: string[];
  /** Hint fragment IDs not yet answered. */
  unresolvedHints: string[];
  /** Hint fragment IDs resolved automatically by runtime policy. */
  autoResolvedHints: string[];
  /** Group or hint IDs blocked (rejected or unresolvable conflict). */
  blockedResolutions: string[];
  /** Normalized ambiguity score [0, 1]. */
  ambiguityScore: number;
}
