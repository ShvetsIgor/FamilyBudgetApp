/**
 * LAYER: semantic fragment types — shared model for the extraction pipeline.
 *
 * SemanticFragment is the fundamental unit produced by the fragment extractor.
 * It carries typed, explainable information about a span of user input.
 *
 * ClarificationHint signals ambiguity that the UX layer may surface
 * to guide the user toward split, clarification, or confirmation flows.
 *
 * Design constraints:
 *   - Pure data types — no functions, no imports
 *   - All confidence values are deterministic (derived from lookup tiers, not ML)
 *   - candidateCategories are hints from the dictionary layer, NOT final selections
 *     (the suggestion engine resolves final categories from memory + signals)
 */

// ── SemanticFragment ──────────────────────────────────────────────────────────

export type FragmentType =
  | 'merchant'   // known or likely store/vendor name
  | 'item'       // product or service keyword (maps to candidate categories)
  | 'amount'     // numeric monetary value
  | 'tag'        // unknown text — contextual hint, no confident type classification
  | 'modifier'   // qualifies another fragment (e.g., "credit", "online", "iced")
  | 'noise';     // stop word or structurally irrelevant token

/**
 * Confidence tiers (deterministic — assigned by lookup result, not by ML):
 *
 *   1.00 — amount token (always certain) / store with known category (needsContext: false)
 *   0.95 — store match from dictionary (needsContext: true — type certain, category ambiguous)
 *   0.85 — exact item dictionary match / item bigram
 *   0.80 — merchant known from usage memory
 *   0.70 — modifier classification (structured phrase like "credit card")
 *   0.30 — unknown token classified as tag (fallback)
 */
export interface SemanticFragment {
  /** Short unique id within the extraction result, e.g. "f0", "f1", "f2". */
  id: string;
  type: FragmentType;
  /** Original casing from user input (display-safe). */
  rawValue: string;
  /** Lowercased + alias-resolved form (key-safe for lookups). */
  normalizedValue: string;
  /** Deterministic confidence in the type classification (0.0–1.0). */
  confidence: number;
  /**
   * Category IDs that this fragment suggests, from the dictionary layer.
   * Empty for merchant (needsContext: true), amount, tag, modifier, noise.
   * One or more IDs for item and self-describing merchant (needsContext: false).
   */
  candidateCategories?: string[];
  /** Extra structured data from the source dictionary entry. */
  metadata?: Record<string, unknown>;
}

// ── ClarificationHint ─────────────────────────────────────────────────────────

export type ClarificationKind =
  | 'ambiguous_item'        // merchant exists but needsContext → category unclear
  | 'multiple_categories'   // 2+ item fragments with different candidate categories → split candidate
  | 'unknown_merchant'      // merchant-position token not found in any dictionary or memory
  | 'conflicting_signals';  // 2+ fragments both classified as merchant

export interface ClarificationHint {
  kind: ClarificationKind;
  /** ID of the primary fragment triggering this hint. */
  fragmentId: string;
  /**
   * Relevant category IDs or fragment IDs, depending on kind:
   *   ambiguous_item        → []  (no category known)
   *   multiple_categories   → all unique candidateCategory IDs across item fragments
   *   unknown_merchant      → []
   *   conflicting_signals   → all merchant fragment IDs
   */
  candidates: string[];
  /** Human-readable explanation for debug/display. */
  message?: string;
}
