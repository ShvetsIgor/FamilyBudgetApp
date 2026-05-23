/**
 * LAYER: fragment extractor — semantic fragment extraction pipeline.
 *
 * Converts a token sequence into typed SemanticFragments by running tokens
 * through the phrase extractor first, then mapping phrases to fragments.
 *
 * Architecture invariants:
 *   - Pure function: same inputs → same output, always (deterministic).
 *   - Does NOT resolve final categories (that is the suggestion engine's job).
 *   - candidateCategories in fragments are dictionary hints, not rankings.
 *   - Memory is optional; pipeline degrades gracefully without it.
 *   - No AI, no embeddings, no probabilistic logic.
 *
 * Pipeline:
 *   ClassifiedToken[]
 *     → phraseExtractor: extractPhrases  — greedy phrase detection (bigrams, modifiers, etc.)
 *     → buildFragmentsFromPhrases        — map each phrase to a typed SemanticFragment
 *     → buildClarificationHints          — analyze fragment set for ambiguity signals
 *   → { fragments: SemanticFragment[], clarificationHints: ClarificationHint[] }
 *
 * Phrase → Fragment type mapping:
 *   amount_phrase   → amount   (confidence 1.0)
 *   merchant_phrase → merchant (confidence from phrase — 0.80/0.95/1.0)
 *   item_phrase     → item     (confidence from phrase — 0.85/0.90)
 *   payment_phrase  → item     (confidence from phrase, metadata.payment: true)
 *   modifier_phrase → modifier (confidence from phrase — 0.60/0.70)
 *   tag_phrase      → tag      (confidence 0.30)
 *   noise_phrase    → (skipped — not included in fragment output)
 */

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import type { ClassifiedToken } from './tokenClassifier';
import type {
  SemanticFragment,
  ClarificationHint,
  ClarificationKind,
} from './semanticFragment';
import type { SemanticPhrase } from './semanticPhrase';
import { extractPhrases } from './phraseExtractor';

// ── Fragment ID helper ────────────────────────────────────────────────────────

function fid(index: number): string {
  return `f${index}`;
}

// ── Phase A: Build fragments from phrases ─────────────────────────────────────

/**
 * Map a SemanticPhrase[] to a SemanticFragment[].
 *
 * Phrase metadata (dictionary-sourced) is carried through directly.
 * noise_phrase entries are silently skipped — they are in the phrase list
 * for inspectability but should not produce fragments.
 */
function buildFragmentsFromPhrases(phrases: SemanticPhrase[]): SemanticFragment[] {
  const fragments: SemanticFragment[] = [];
  let idx = 0;

  for (const phrase of phrases) {
    const id = fid(idx);
    const rawValue = phrase.rawText;
    const normalizedValue = phrase.normalizedText;

    switch (phrase.type) {
      case 'noise_phrase':
        break; // skip — not in fragment output

      case 'amount_phrase':
        fragments.push({ id, type: 'amount', rawValue, normalizedValue, confidence: 1.0, candidateCategories: [] });
        idx++;
        break;

      case 'merchant_phrase': {
        const categoryId = phrase.metadata?.categoryId as string | undefined;
        const source = phrase.metadata?.source as string | undefined;
        const storeId = phrase.metadata?.storeId as string | undefined;
        const storeGroup = phrase.metadata?.storeGroup as string | undefined;
        const needsContext = phrase.metadata?.needsContext as boolean | undefined;
        fragments.push({
          id,
          type: 'merchant',
          rawValue,
          normalizedValue,
          confidence: phrase.confidence,
          candidateCategories: categoryId ? [categoryId] : [],
          metadata: source
            ? { source }
            : { storeId, storeGroup, needsContext },
        });
        idx++;
        break;
      }

      case 'item_phrase': {
        const categoryIds = (phrase.metadata?.categoryIds as string[] | undefined) ?? [];
        fragments.push({ id, type: 'item', rawValue, normalizedValue, confidence: phrase.confidence, candidateCategories: categoryIds });
        idx++;
        break;
      }

      case 'payment_phrase': {
        const categoryIds = (phrase.metadata?.categoryIds as string[] | undefined) ?? [];
        fragments.push({
          id,
          type: 'item',
          rawValue,
          normalizedValue,
          confidence: phrase.confidence,
          candidateCategories: categoryIds,
          metadata: { payment: true },
        });
        idx++;
        break;
      }

      case 'modifier_phrase':
        fragments.push({ id, type: 'modifier', rawValue, normalizedValue, confidence: phrase.confidence, candidateCategories: [] });
        idx++;
        break;

      case 'tag_phrase':
        fragments.push({ id, type: 'tag', rawValue, normalizedValue, confidence: 0.30, candidateCategories: [] });
        idx++;
        break;
    }
  }

  return fragments;
}

// ── Phase B: Build clarification hints ───────────────────────────────────────

function addHint(
  hints: ClarificationHint[],
  kind: ClarificationKind,
  fragmentId: string,
  candidates: string[],
  message: string,
): void {
  hints.push({ kind, fragmentId, candidates, message });
}

function buildClarificationHints(
  fragments: SemanticFragment[],
): ClarificationHint[] {
  const hints: ClarificationHint[] = [];

  const merchantFragments = fragments.filter((f) => f.type === 'merchant');
  const itemFragments = fragments.filter((f) => f.type === 'item');

  // unknown_merchant: first significant fragment is a tag (no dictionary match, no memory)
  const firstSignificant = fragments.find(
    (f) => f.type !== 'amount' && f.type !== 'noise',
  );
  if (firstSignificant?.type === 'tag') {
    addHint(
      hints,
      'unknown_merchant',
      firstSignificant.id,
      [],
      `"${firstSignificant.rawValue}" не найдено в справочнике — выберите категорию вручную`,
    );
  }

  // ambiguous_item: merchant with needsContext: true and no candidate categories
  for (const f of merchantFragments) {
    if (
      f.metadata?.needsContext === true &&
      (!f.candidateCategories || f.candidateCategories.length === 0)
    ) {
      addHint(
        hints,
        'ambiguous_item',
        f.id,
        [],
        `"${f.rawValue}" — магазин с неизвестной категорией (нужен контекст)`,
      );
    }
  }

  // multiple_categories: 2+ item fragments with different candidate categories
  if (itemFragments.length >= 2) {
    const categorySet = new Set(itemFragments.flatMap((f) => f.candidateCategories ?? []));
    if (categorySet.size > 1) {
      addHint(
        hints,
        'multiple_categories',
        itemFragments[0].id,
        [...categorySet],
        `${itemFragments.length} товара с разными категориями — возможен сплит`,
      );
    }
  }

  // conflicting_signals: 2+ merchant fragments
  if (merchantFragments.length > 1) {
    addHint(
      hints,
      'conflicting_signals',
      merchantFragments[0].id,
      merchantFragments.map((f) => f.id),
      `Несколько вероятных магазинов: ${merchantFragments.map((f) => f.rawValue).join(', ')}`,
    );
  }

  return hints;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface FragmentExtractionResult {
  fragments: SemanticFragment[];
  clarificationHints: ClarificationHint[];
}

/**
 * Build SemanticFragments and ClarificationHints from already-extracted phrases.
 *
 * Use this when you have already called extractPhrases() and want to avoid
 * extracting them again (e.g., parseInput() exposes phrases in ParserContext).
 *
 * @param phrases  Output of extractPhrases() from phraseExtractor.ts.
 * @returns        Typed fragments + ambiguity hints.
 */
export function extractFragmentsFromPhrases(
  phrases: SemanticPhrase[],
): FragmentExtractionResult {
  const fragments = buildFragmentsFromPhrases(phrases);
  const clarificationHints = buildClarificationHints(fragments);
  return { fragments, clarificationHints };
}

/**
 * Extract semantic fragments from a classified token sequence.
 *
 * Backward-compatible entry point: internally calls extractPhrases() then
 * extractFragmentsFromPhrases(). Use this when you don't need phrases separately.
 *
 * @param tokens   Output of tokenizeAndClassify() — original casing in raw.
 * @param memory   Optional usage memory for merchant recognition.
 * @returns        Typed fragments + ambiguity hints for the orchestration layer.
 */
export function extractFragments(
  tokens: ClassifiedToken[],
  memory?: SuggestionMemoryState,
): FragmentExtractionResult {
  const phrases = extractPhrases(tokens, memory);
  return extractFragmentsFromPhrases(phrases);
}
