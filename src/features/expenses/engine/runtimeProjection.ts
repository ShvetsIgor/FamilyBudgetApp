/**
 * LAYER: runtime projection — UX-ready view models for the conversational runtime.
 *
 * The UI must NOT consume raw engine state directly.
 * Instead: engine state → RuntimeProjection → view models → UI components.
 *
 * RuntimeProjection is a stable, UX-oriented snapshot of the current session.
 * It groups ambiguities, prioritizes actions, and hides engine internals from UI.
 *
 * Lifecycle stages:
 *   input        — no parse context yet (empty/first load)
 *   clarification— unresolved clarification hints exist
 *   review       — no hints; pending groups or data to confirm
 *   split        — pending groups with suggestedSplit after hint resolution
 *   resolved     — session is fully resolved
 *
 * Architecture invariants:
 *   - Pure types only — no logic in this file.
 *   - All view models are UX-oriented: no raw fragmentIds, no raw scores.
 *   - Labels are raw display strings (categoryId → label mapping done by UI).
 *   - All structures are serializable (no functions, no class instances).
 */

// ── Stage ─────────────────────────────────────────────────────────────────────

export type ProjectionStage =
  | 'input'          // awaiting user input / initial state
  | 'clarification'  // unresolved hints require user answers
  | 'review'         // data ready but not confirmed
  | 'split'          // purchase group suggests split (hints resolved)
  | 'resolved';      // session complete

// ── Clarification view models ─────────────────────────────────────────────────

export interface ClarificationOption {
  /** Category ID or merchant fragment ID depending on hint kind. */
  id: string;
  /** Human-readable label (categoryId as fallback if not mapped). */
  label: string;
}

export interface ClarificationCardViewModel {
  hintId: string;
  question: string;
  options: ClarificationOption[];
  hintKind: string;
  /** 0–100 ambiguity score for this hint. */
  ambiguityScore: number;
  /** True when user MUST answer (not auto-resolvable). */
  isRequired: boolean;
}

export interface ClarificationGroup {
  id: string;
  kind: string;
  cards: ClarificationCardViewModel[];
  /** True when this group can be collapsed without losing context. */
  isCollapsible: boolean;
  isExpanded: boolean;
  /** Lower = shown first. */
  priority: number;
}

// ── Suggestion view models ────────────────────────────────────────────────────

export interface SuggestionProjection {
  categoryId: string;
  /** Display label (categoryId until mapped by UI). */
  label: string;
  /** Engine score (0–∞). */
  score: number;
  /** Short human-readable reason labels. */
  reasons: string[];
  isHabit: boolean;
  /** True for the top-ranked suggestion. */
  isPrimary: boolean;
}

// ── Split view models ─────────────────────────────────────────────────────────

export interface SplitItemProjection {
  fragmentId: string;
  /** Display text of the item (rawValue from SemanticFragment). */
  label: string;
  /** Primary candidate category for this item, if known. */
  categoryId: string | undefined;
  /** Modifier text labels attached to this item. */
  modifiers: string[];
}

export interface SplitProjection {
  groupId: string;
  items: SplitItemProjection[];
  /** Amount to be split (from session context). */
  totalAmount: number | undefined;
  /** True when all items have a categoryId assigned. */
  canConfirm: boolean;
  /** Summary labels for modifiers that apply to the whole group. */
  modifierSummary: string[];
}

// ── Resolution progress view model ────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export interface ResolutionProjection {
  totalItems: number;
  resolvedItems: number;
  blockedItems: number;
  pendingItems: number;
  /** 0–100. */
  progressPercent: number;
  confidenceLevel: ConfidenceLevel;
  isComplete: boolean;
  /** Human-readable summary of the progress state. */
  summary: string;
}

// ── Action suggestion view model ──────────────────────────────────────────────

export type ActionSuggestionType =
  | 'confirm_split'
  | 'resolve_merchant'
  | 'create_alias'
  | 'retry_parse'
  | 'ignore_ambiguity'
  | 'accept_suggestion';

export interface RuntimeActionSuggestion {
  id: string;
  type: ActionSuggestionType;
  label: string;
  description: string;
  urgency: 'high' | 'medium' | 'low';
  /** Hint fragmentId or group ID this action targets. */
  targetId?: string;
}

// ── Semantic conflict view model ──────────────────────────────────────────────

export interface SemanticConflictViewModel {
  conflictId: string;
  kind: string;
  tokens: string[];
  explanation: string;
  resolutionOptions: string[];
}

// ── Runtime projection ────────────────────────────────────────────────────────

/**
 * The top-level UX snapshot of a semantic session.
 * Built by projectionEngine.buildRuntimeProjection().
 * Consumed directly by UI components — no raw engine types needed.
 */
export interface RuntimeProjection {
  sessionId: string;
  currentStage: ProjectionStage;
  groupedClarifications: ClarificationGroup[];
  visibleSuggestions: SuggestionProjection[];
  splitReview?: SplitProjection;
  resolutionProgress: ResolutionProjection;
  recommendedNextAction?: RuntimeActionSuggestion;
  /** Snapshot of the current input text. */
  currentInput: string;
  /** True when the user can submit the expense. */
  canSubmit: boolean;
}
