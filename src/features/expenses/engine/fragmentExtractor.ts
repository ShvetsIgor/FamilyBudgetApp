/**
 * LAYER: fragment extractor — semantic fragment extraction pipeline.
 *
 * Converts a sequence of ClassifiedTokens into typed SemanticFragments,
 * then identifies ambiguity as ClarificationHints.
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
 *     → Stage A: buildFragments  — greedy left-to-right bigram + single-token matching
 *     → Stage B: buildClarificationHints — analyze fragment set for ambiguity signals
 *   → { fragments: SemanticFragment[], clarificationHints: ClarificationHint[] }
 *
 * Matching priority per token position (highest priority first):
 *   1. Amount token → amount fragment
 *   2. Noise token  → skip (not included in output)
 *   3. Store bigram (two consecutive text tokens) → merchant fragment
 *   4. Item bigram  (two consecutive text tokens) → item fragment
 *   5. Single store token → merchant fragment
 *   6. Memory-known merchant → merchant fragment (lower confidence)
 *   7. Single item token → item fragment
 *   8. Unknown text → tag fragment (fallback)
 */

import type { SuggestionMemoryState } from '../store/suggestionMemorySlice';
import type { ClassifiedToken } from './tokenClassifier';
import { resolveAlias } from './inputNormalizer';
import {
  lookupStore,
  lookupStoreBigram,
  lookupItem,
  lookupItemBigram,
} from './semanticDictionary';
import type { StoreEntry } from './semanticDictionary';
import type {
  SemanticFragment,
  FragmentType,
  ClarificationHint,
  ClarificationKind,
} from './semanticFragment';

// ── Fragment builders ─────────────────────────────────────────────────────────

function fid(index: number): string {
  return `f${index}`;
}

function amountFragment(token: ClassifiedToken, idx: number): SemanticFragment {
  return {
    id: fid(idx),
    type: 'amount',
    rawValue: token.raw,
    normalizedValue: token.normalized,
    confidence: 1.0,
    candidateCategories: [],
  };
}

function merchantFromStore(
  rawValue: string,
  normalizedValue: string,
  store: StoreEntry,
  idx: number,
): SemanticFragment {
  const confidence = store.needsContext ? 0.95 : 1.0;
  return {
    id: fid(idx),
    type: 'merchant',
    rawValue,
    normalizedValue,
    confidence,
    candidateCategories: store.categoryId ? [store.categoryId] : [],
    metadata: {
      storeId: store.id,
      storeGroup: store.storeGroup,
      needsContext: store.needsContext,
    },
  };
}

function merchantFromMemory(
  token: ClassifiedToken,
  idx: number,
): SemanticFragment {
  return {
    id: fid(idx),
    type: 'merchant',
    rawValue: token.raw,
    normalizedValue: resolveAlias(token.normalized),
    confidence: 0.80,
    candidateCategories: [],
    metadata: { source: 'memory' },
  };
}

function itemFragment(
  rawValue: string,
  normalizedValue: string,
  categoryIds: string[],
  confidence: number,
  idx: number,
): SemanticFragment {
  return {
    id: fid(idx),
    type: 'item',
    rawValue,
    normalizedValue,
    confidence,
    candidateCategories: categoryIds,
  };
}

function tagFragment(token: ClassifiedToken, idx: number): SemanticFragment {
  return {
    id: fid(idx),
    type: 'tag',
    rawValue: token.raw,
    normalizedValue: resolveAlias(token.normalized),
    confidence: 0.30,
    candidateCategories: [],
  };
}

// ── Memory helpers ────────────────────────────────────────────────────────────

function isKnownMemoryMerchant(
  normalizedToken: string,
  memory: SuggestionMemoryState,
): boolean {
  const key = resolveAlias(normalizedToken);
  return (memory.merchants[key]?.length ?? 0) > 0;
}

// ── Stage A: Build fragments ──────────────────────────────────────────────────

/**
 * Greedy left-to-right fragment extraction.
 *
 * At each position tries (in order):
 *   1. Amount token
 *   2. Noise token (skipped)
 *   3. Store bigram (current + next text token)
 *   4. Item bigram  (current + next text token)
 *   5. Single store token
 *   6. Memory merchant
 *   7. Item dictionary match
 *   8. Tag (fallback)
 */
function buildFragments(
  tokens: ClassifiedToken[],
  memory?: SuggestionMemoryState,
): SemanticFragment[] {
  const fragments: SemanticFragment[] = [];
  let idx = 0;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i];

    // 1. Amount
    if (token.kind === 'amount') {
      fragments.push(amountFragment(token, idx++));
      i++;
      continue;
    }

    // 2. Noise — skip silently
    if (token.kind === 'noise') {
      i++;
      continue;
    }

    // token.kind === 'text' — try bigrams first, then single
    const next = i + 1 < tokens.length ? tokens[i + 1] : null;
    const nextIsText = next?.kind === 'text';

    // 3. Store bigram
    if (nextIsText) {
      const store = lookupStoreBigram(token.normalized, next!.normalized);
      if (store) {
        const raw = `${token.raw} ${next!.raw}`;
        const norm = `${resolveAlias(token.normalized)} ${resolveAlias(next!.normalized)}`;
        fragments.push(merchantFromStore(raw, norm, store, idx++));
        i += 2;
        continue;
      }
    }

    // 4. Item bigram
    if (nextIsText) {
      const itemBi = lookupItemBigram(token.normalized, next!.normalized);
      if (itemBi) {
        const raw = `${token.raw} ${next!.raw}`;
        const norm = `${token.normalized} ${next!.normalized}`;
        fragments.push(itemFragment(raw, norm, itemBi.categoryIds, itemBi.confidence, idx++));
        i += 2;
        continue;
      }
    }

    // 5. Single store
    const store = lookupStore(token.normalized);
    if (store) {
      fragments.push(merchantFromStore(token.raw, resolveAlias(token.normalized), store, idx++));
      i++;
      continue;
    }

    // 6. Memory merchant
    if (memory && isKnownMemoryMerchant(token.normalized, memory)) {
      fragments.push(merchantFromMemory(token, idx++));
      i++;
      continue;
    }

    // 7. Item dictionary
    const itemEntry = lookupItem(token.normalized);
    if (itemEntry) {
      fragments.push(
        itemFragment(token.raw, token.normalized, itemEntry.categoryIds, itemEntry.confidence, idx++),
      );
      i++;
      continue;
    }

    // 8. Tag (fallback)
    fragments.push(tagFragment(token, idx++));
    i++;
  }

  return fragments;
}

// ── Stage B: Build clarification hints ───────────────────────────────────────

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
  const tagFragments = fragments.filter((f) => f.type === 'tag');

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
 * Extract semantic fragments from a classified token sequence.
 *
 * @param tokens   Output of tokenizeAndClassify() — original casing in raw, normalized in normalized.
 * @param memory   Optional usage memory for merchant recognition (Stage 6).
 * @returns        Typed fragments + ambiguity hints for the orchestration layer.
 *
 * Examples:
 *   tokens for "Dabbah молоко 350":
 *     → [{ type:'merchant', rawValue:'Dabbah' }, { type:'item', rawValue:'молоко', candidateCategories:['dairy'] }, { type:'amount', rawValue:'350' }]
 *
 *   tokens for "rami levi 500":
 *     → [{ type:'merchant', rawValue:'rami levi', metadata: { storeId:'rami_levi', needsContext:true } }, { type:'amount', rawValue:'500' }]
 *
 *   tokens for "молоко хлеб шампунь 350" (no merchant):
 *     → [{ type:'item', rawValue:'молоко' }, { type:'item', rawValue:'хлеб' }, { type:'item', rawValue:'шампунь' }, { type:'amount' }]
 *     hints: [{ kind:'multiple_categories', candidates:['dairy','bakery','cosmetics'] }]
 */
export function extractFragments(
  tokens: ClassifiedToken[],
  memory?: SuggestionMemoryState,
): FragmentExtractionResult {
  const fragments = buildFragments(tokens, memory);
  const clarificationHints = buildClarificationHints(fragments);
  return { fragments, clarificationHints };
}
