/**
 * LAYER: purchase group types — structural grouping of semantic fragments.
 *
 * A PurchaseGroup collects all fragments that belong to the same purchase event.
 * In the current single-input model there is always exactly one group ('g0').
 *
 * The multi-group shape is intentional: when the pipeline is extended to process
 * OCR receipt lines or multi-purchase free-text, buildPurchaseGroups() can return
 * multiple PurchaseGroup objects without any interface change in consumers.
 *
 * Design constraints:
 *   - Pure data types — no functions, no imports
 *   - Fragment IDs are stable string references (e.g., 'f0', 'f1')
 *   - suggestedSplit is determined deterministically from fragment data
 *   - confidenceSignals are string labels, not numeric scores
 */

// ── PurchaseGroup ─────────────────────────────────────────────────────────────

/**
 * A grouped collection of semantic fragments representing one purchase event.
 *
 * Fragment membership:
 *   merchantFragmentId  — at most one; the first merchant-type fragment by index
 *   amountFragmentId    — at most one; the first amount-type fragment by index
 *   itemFragmentIds     — all fragments of type 'item', in extraction order
 *   modifierFragmentIds — all fragments of type 'modifier', in extraction order
 *
 * Split signal:
 *   suggestedSplit: true when 2+ item fragments carry different candidateCategories
 *                   OR when a 'multiple_categories' ClarificationHint is present
 *
 * Confidence signals (string labels, parallel to ConfidenceSignalKind in inputPipeline.ts
 * but owned by this layer to avoid cross-layer coupling):
 *   'merchant_identified' — at least one merchant fragment present
 *   'amount_present'      — at least one amount fragment present
 *   'items_found'         — at least one item fragment present
 *   'split_recommended'   — suggestedSplit is true
 */
export interface PurchaseGroup {
  /** Stable group identifier. Currently always 'g0'. */
  id: string;
  /** Fragment ID of the merchant fragment, if any. */
  merchantFragmentId?: string;
  /** Fragment ID of the amount fragment, if any. */
  amountFragmentId?: string;
  /** Fragment IDs of all item fragments, in extraction order. */
  itemFragmentIds: string[];
  /** Fragment IDs of all modifier fragments, in extraction order. */
  modifierFragmentIds: string[];
  /** String labels describing what was detected in this group. */
  confidenceSignals: string[];
  /** True when this group is a candidate for the split expense flow. */
  suggestedSplit: boolean;
}
