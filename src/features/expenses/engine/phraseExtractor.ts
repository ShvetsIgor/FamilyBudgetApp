/**
 * LAYER: phrase extractor — token sequence → semantic phrase extraction.
 *
 * Converts a ClassifiedToken[] into SemanticPhrase[] using greedy left-to-right
 * matching. Phrases are the intermediate representation between tokens and fragments:
 *
 *   tokens → phrases → fragments → relationships → purchase groups
 *
 * Architecture invariants:
 *   - Pure function: same inputs → same output, always (deterministic).
 *   - Memory is optional; pipeline degrades gracefully without it.
 *   - No AI, no embeddings, no probabilistic logic.
 *   - All phrase classification uses dictionary lookups or curated rule sets.
 *
 * Extraction priority (greedy, at each token position, highest → lowest):
 *   1.  Amount token        → amount_phrase  (1.0)
 *   2a. Noise modifier token → modifier_phrase if noise token is a modifier prefix
 *   2b. Noise token         → noise_phrase   (1.0, skipped by fragment builder)
 *   3.  Store trigram       → merchant_phrase
 *   4.  Store bigram        → merchant_phrase
 *   5.  Payment bigram      → payment_phrase (checked before item bigrams)
 *   6.  Item bigram         → item_phrase
 *   7.  Modifier bigram     → modifier_phrase (text modifier prefix + any text)
 *   8.  Single store token  → merchant_phrase
 *   9.  Memory merchant     → merchant_phrase (0.80)
 *  10.  Single item token   → item_phrase    (0.85)
 *  11.  Standalone modifier → modifier_phrase (0.60)
 *  12.  Unknown text        → tag_phrase     (0.30)
 *
 * Modifier prefix notes:
 *   Some modifier prefixes (e.g., "for", "с") are classified as noise tokens
 *   by the tokenClassifier. These are caught in step 2a before noise handling.
 *   Others (e.g., "без", "without", "для") are text tokens, caught in step 7.
 */

import type { ClassifiedToken } from './tokenClassifier';
import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import { resolveAlias } from './inputNormalizer';
import {
  lookupStore,
  lookupStoreBigram,
  lookupStoreTrigram,
  lookupItem,
  lookupItemBigram,
  lookupPaymentPhrase,
} from './semanticDictionary';
import type { StoreEntry } from './semanticDictionary';
import type { SemanticPhrase } from './semanticPhrase';

// ── Modifier knowledge ────────────────────────────────────────────────────────

/**
 * Tokens (noise or text) that signal the next token is a modifier target.
 * Covers both noise-classified tokens (for, с) and text-classified tokens
 * (without, без, для) so both code paths can reference a single set.
 */
export const MODIFIER_PREFIXES = new Set([
  // English (some are noise tokens, some are text tokens)
  'for', 'without', 'with', 'no', 'non', 'via',
  // Russian (с is noise; без, для are text)
  'без', 'для', 'с',
]);

/**
 * Standalone adjectives that classify as modifier_phrase without a following token.
 * These are common food/product quality descriptors with unambiguous modifier meaning.
 */
export const STANDALONE_MODIFIERS = new Set([
  // English quality / size / diet adjectives
  'organic', 'fresh', 'frozen', 'whole', 'half', 'diet', 'lite', 'light',
  'large', 'small', 'big', 'mini', 'extra', 'regular', 'jumbo',
  'low', 'high', 'free', 'raw', 'vegan', 'kosher', 'halal',
  'natural', 'premium', 'protein', 'sugar-free', 'fat-free', 'gluten-free',
  // Russian
  'органический', 'свежий', 'замороженный', 'большой', 'маленький',
  'цельный', 'обезжиренный', 'диетический', 'постный', 'натуральный',
]);

// ── Phrase ID helper ──────────────────────────────────────────────────────────

function pid(index: number): string {
  return `p${index}`;
}

// ── Memory helper ─────────────────────────────────────────────────────────────

function isKnownMemoryMerchant(
  normalizedToken: string,
  memory: SuggestionMemoryState,
): boolean {
  const key = resolveAlias(normalizedToken);
  return (memory.merchants[key]?.length ?? 0) > 0;
}

// ── Phrase builders ───────────────────────────────────────────────────────────

function amountPhrase(token: ClassifiedToken, tokenIndex: number, idx: number): SemanticPhrase {
  return {
    id: pid(idx),
    type: 'amount_phrase',
    rawText: token.raw,
    normalizedText: token.normalized,
    tokenIndexes: [tokenIndex],
    confidence: 1.0,
  };
}

function noisePhrase(token: ClassifiedToken, tokenIndex: number, idx: number): SemanticPhrase {
  return {
    id: pid(idx),
    type: 'noise_phrase',
    rawText: token.raw,
    normalizedText: token.normalized,
    tokenIndexes: [tokenIndex],
    confidence: 1.0,
  };
}

function merchantPhraseFromStore(
  rawTokens: ClassifiedToken[],
  tokenIndexes: number[],
  store: StoreEntry,
  idx: number,
): SemanticPhrase {
  const rawText = rawTokens.map((t) => t.raw).join(' ');
  const normalizedText = rawTokens.map((t) => resolveAlias(t.normalized)).join(' ');
  const confidence = store.needsContext ? 0.95 : 1.0;
  return {
    id: pid(idx),
    type: 'merchant_phrase',
    rawText,
    normalizedText,
    tokenIndexes,
    confidence,
    metadata: {
      storeId: store.id,
      storeGroup: store.storeGroup,
      needsContext: store.needsContext,
      categoryId: store.categoryId,
    },
  };
}

function merchantPhraseFromMemory(
  token: ClassifiedToken,
  tokenIndex: number,
  idx: number,
): SemanticPhrase {
  return {
    id: pid(idx),
    type: 'merchant_phrase',
    rawText: token.raw,
    normalizedText: resolveAlias(token.normalized),
    tokenIndexes: [tokenIndex],
    confidence: 0.80,
    metadata: { source: 'memory' },
  };
}

function itemPhrase(
  rawTokens: ClassifiedToken[],
  tokenIndexes: number[],
  categoryIds: string[],
  confidence: number,
  idx: number,
): SemanticPhrase {
  return {
    id: pid(idx),
    type: 'item_phrase',
    rawText: rawTokens.map((t) => t.raw).join(' '),
    normalizedText: rawTokens.map((t) => t.normalized).join(' '),
    tokenIndexes,
    confidence,
    metadata: { categoryIds },
  };
}

function paymentPhrase(
  rawTokens: ClassifiedToken[],
  tokenIndexes: number[],
  categoryIds: string[],
  confidence: number,
  idx: number,
): SemanticPhrase {
  return {
    id: pid(idx),
    type: 'payment_phrase',
    rawText: rawTokens.map((t) => t.raw).join(' '),
    normalizedText: rawTokens.map((t) => t.normalized).join(' '),
    tokenIndexes,
    confidence,
    metadata: { categoryIds },
  };
}

function modifierPhrase(
  rawTokens: ClassifiedToken[],
  tokenIndexes: number[],
  confidence: number,
  idx: number,
): SemanticPhrase {
  return {
    id: pid(idx),
    type: 'modifier_phrase',
    rawText: rawTokens.map((t) => t.raw).join(' '),
    normalizedText: rawTokens.map((t) => t.normalized).join(' '),
    tokenIndexes,
    confidence,
  };
}

function tagPhrase(token: ClassifiedToken, tokenIndex: number, idx: number): SemanticPhrase {
  return {
    id: pid(idx),
    type: 'tag_phrase',
    rawText: token.raw,
    normalizedText: resolveAlias(token.normalized),
    tokenIndexes: [tokenIndex],
    confidence: 0.30,
  };
}

// ── Main extraction ───────────────────────────────────────────────────────────

/**
 * Extract semantic phrases from a classified token sequence.
 *
 * Greedy left-to-right. At each position tries phrase patterns from highest
 * to lowest priority and advances past all consumed tokens.
 *
 * Noise tokens produce noise_phrase entries for inspectability — but if a noise
 * token is a modifier prefix (e.g., "for", "с"), it is consumed as part of a
 * modifier_phrase bigram instead.
 *
 * Memory detection (step 9) happens here so the fragment builder receives
 * pre-classified phrases and does not need to re-inspect memory.
 *
 * @param tokens  Output of tokenizeAndClassify() — original casing in raw.
 * @param memory  Optional usage memory for merchant recognition (step 9).
 */
export function extractPhrases(
  tokens: ClassifiedToken[],
  memory?: SuggestionMemoryState,
): SemanticPhrase[] {
  const phrases: SemanticPhrase[] = [];
  let pidIdx = 0;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];
    const next1 = i + 1 < tokens.length ? tokens[i + 1] : null;
    const next2 = i + 2 < tokens.length ? tokens[i + 2] : null;
    const next1IsText = next1?.kind === 'text';
    const next2IsText = next2?.kind === 'text';

    // Step 1: Amount token
    if (token.kind === 'amount') {
      phrases.push(amountPhrase(token, i, pidIdx++));
      i++;
      continue;
    }

    // Step 2a: Noise modifier prefix — try modifier bigram before emitting noise
    // Covers: "for X" ("for" is noise), "с молоком" ("с" is noise)
    if (token.kind === 'noise') {
      if (MODIFIER_PREFIXES.has(token.normalized) && next1IsText) {
        phrases.push(modifierPhrase([token, next1!], [i, i + 1], 0.70, pidIdx++));
        i += 2;
        continue;
      }
      // Step 2b: Regular noise token
      phrases.push(noisePhrase(token, i, pidIdx++));
      i++;
      continue;
    }

    // Steps 3–12 apply to text tokens only

    // Step 3: Store trigram (3 consecutive text tokens)
    if (next1IsText && next2IsText) {
      const store = lookupStoreTrigram(token.normalized, next1!.normalized, next2!.normalized);
      if (store) {
        phrases.push(merchantPhraseFromStore(
          [token, next1!, next2!],
          [i, i + 1, i + 2],
          store,
          pidIdx++,
        ));
        i += 3;
        continue;
      }
    }

    // Step 4: Store bigram (2 consecutive text tokens)
    if (next1IsText) {
      const store = lookupStoreBigram(token.normalized, next1!.normalized);
      if (store) {
        phrases.push(merchantPhraseFromStore(
          [token, next1!],
          [i, i + 1],
          store,
          pidIdx++,
        ));
        i += 2;
        continue;
      }
    }

    // Step 5: Payment bigram (checked before item bigrams)
    if (next1IsText) {
      const payment = lookupPaymentPhrase(token.normalized, next1!.normalized);
      if (payment) {
        phrases.push(paymentPhrase(
          [token, next1!],
          [i, i + 1],
          payment.categoryIds,
          payment.confidence,
          pidIdx++,
        ));
        i += 2;
        continue;
      }
    }

    // Step 6: Item bigram
    if (next1IsText) {
      const itemBi = lookupItemBigram(token.normalized, next1!.normalized);
      if (itemBi) {
        phrases.push(itemPhrase(
          [token, next1!],
          [i, i + 1],
          itemBi.categoryIds,
          itemBi.confidence,
          pidIdx++,
        ));
        i += 2;
        continue;
      }
    }

    // Step 7: Modifier bigram (text modifier prefix + any text token)
    // Covers: "without sugar", "без сахара", "для детей", "no sugar"
    if (next1IsText && MODIFIER_PREFIXES.has(token.normalized)) {
      phrases.push(modifierPhrase([token, next1!], [i, i + 1], 0.70, pidIdx++));
      i += 2;
      continue;
    }

    // Step 8: Single store token
    const store = lookupStore(token.normalized);
    if (store) {
      phrases.push(merchantPhraseFromStore([token], [i], store, pidIdx++));
      i++;
      continue;
    }

    // Step 9: Memory merchant
    if (memory && isKnownMemoryMerchant(token.normalized, memory)) {
      phrases.push(merchantPhraseFromMemory(token, i, pidIdx++));
      i++;
      continue;
    }

    // Step 10: Single item token from dictionary
    const itemEntry = lookupItem(token.normalized);
    if (itemEntry) {
      phrases.push(itemPhrase(
        [token],
        [i],
        itemEntry.categoryIds,
        itemEntry.confidence,
        pidIdx++,
      ));
      i++;
      continue;
    }

    // Step 11: Standalone modifier adjective
    if (STANDALONE_MODIFIERS.has(token.normalized)) {
      phrases.push(modifierPhrase([token], [i], 0.60, pidIdx++));
      i++;
      continue;
    }

    // Step 12: Unknown text → tag_phrase
    phrases.push(tagPhrase(token, i, pidIdx++));
    i++;
  }

  return phrases;
}
