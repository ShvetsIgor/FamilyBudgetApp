/**
 * LAYER: semantic phrase types — multi-token phrase model.
 *
 * SemanticPhrase represents a typed span of one or more tokens identified as a
 * semantic unit. It sits between the token classifier and the fragment extractor
 * in the pipeline:
 *
 *   tokens → semantic phrases → semantic fragments → relationships → purchase groups
 *
 * Design constraints:
 *   - Pure data types — no functions, no imports
 *   - tokenIndexes are 0-based positions in the original ClassifiedToken array
 *   - confidence values are deterministic (derived from lookup tiers, not ML)
 *   - metadata carries dictionary-sourced data passed through to the fragment builder
 */

// ── SemanticPhrase ────────────────────────────────────────────────────────────

export type PhraseType =
  | 'merchant_phrase'   // known or memory-recognized store/vendor name
  | 'item_phrase'       // product or service keyword phrase
  | 'modifier_phrase'   // qualifier phrase (e.g., "for kids", "without sugar")
  | 'payment_phrase'    // payment method phrase (e.g., "credit card")
  | 'amount_phrase'     // numeric monetary value
  | 'tag_phrase'        // unknown entity — fallback classification
  | 'noise_phrase';     // stop word or structurally irrelevant token

/**
 * A typed span of one or more tokens representing a semantic unit.
 *
 * Confidence tiers (deterministic — assigned by rule, not ML):
 *   1.00 — amount / noise / store with known category (needsContext: false)
 *   0.95 — store from dictionary (needsContext: true — type certain, category ambiguous)
 *   0.90 — payment bigram (structured payment keyword) / high-confidence item bigram
 *   0.85 — item bigram (standard) / item single token from dictionary
 *   0.80 — memory-recognized merchant / payment phrase (lower-confidence)
 *   0.70 — modifier prefix bigram ("for X", "without X")
 *   0.60 — standalone modifier adjective ("organic", "fresh")
 *   0.30 — unknown entity (tag fallback)
 */
export interface SemanticPhrase {
  /** Short unique id within the extraction result, e.g. "p0", "p1". */
  id: string;
  /** Original casing from user input (display-safe). Multi-token: joined with space. */
  rawText: string;
  /** Lowercased + alias-resolved form. Multi-token: joined with space. */
  normalizedText: string;
  /**
   * 0-based positions in the original ClassifiedToken array that this phrase spans.
   * Single-token phrase: [i]. Bigram: [i, i+1]. Trigram: [i, i+1, i+2].
   */
  tokenIndexes: number[];
  type: PhraseType;
  /** Deterministic confidence in the type classification (0.0–1.0). */
  confidence: number;
  /** Dictionary-sourced metadata carried through to the fragment builder. */
  metadata?: Record<string, unknown>;
}
