/**
 * Parser pipeline — pure stage functions.
 *
 * Each stage has a narrow, independently testable contract.
 * Future integrations replace or augment individual stages:
 *
 *   TODO(OCR):  receipt scanner → inject into extractCandidateItems
 *   TODO(AI):   candidate generator → replace/augment extractCandidateItems
 *   TODO(AI):   confidence scorer   → replace scoreConfidence with model output
 *   TODO(AI):   merchant resolver   → augment detectMerchant with fuzzy matching
 *
 * Pipeline order (enforced in parse.ts):
 *   tokenizeInput → [extractDate] → extractAmounts → [resolveEmojiHit]
 *   → detectMerchant → extractCandidateItems → resolveCategoryCandidates
 *   → scoreConfidence
 *
 * [extractDate] lives in parseDate.ts (separate concern, called directly).
 */

import { matchStore } from './storeDictionary';
import { matchItem } from './itemDictionary';
import { EMOJI } from './dictionary';
import type { StoreMatch } from './dictionaries/stores';
import type { ItemMatch } from './dictionaries/types';
import type { ParseConfidence } from '@/shared/types/message';

export type { StoreMatch, ItemMatch };

// ── Stage 1: tokenizeInput ─────────────────────────────────────────────────
// Normalizes whitespace, detects control prefixes.

export interface TokenizeResult {
  normalized: string;
  lower: string;
  isIncome: boolean;
  isSlashCommand: boolean;
}

export function tokenizeInput(raw: string): TokenizeResult {
  const normalized = raw.trim().replace(/\s+/g, ' ');
  const lower = normalized.toLowerCase();
  return {
    normalized,
    lower,
    isIncome: lower.startsWith('+'),
    isSlashCommand: lower.startsWith('/'),
  };
}

// ── Stage 2: detectMerchant ───────────────────────────────────────────────
// Matches a known store/merchant in the text.
// Merchant is a SIGNAL that affects confidence scoring.
// Merchant store group does NOT directly determine categoryId — item keywords take precedence.
//
// TODO(AI): fuzzy name matching for unregistered merchants
// TODO(OCR): receipt header text → merchant name extraction

export function detectMerchant(text: string): StoreMatch | undefined {
  return matchStore(text) ?? undefined;
}

// ── Stage 3: extractAmounts ───────────────────────────────────────────────
// Finds the primary numeric amount in the text.

export interface AmountExtraction {
  amount: number;
  rest: string;
}

export function extractAmounts(text: string): AmountExtraction | null {
  const m = text.match(/(\d+([.,]\d+)?)/);
  if (!m) return null;
  return {
    amount: parseFloat(m[1].replace(',', '.')),
    rest: text.replace(m[0], '').trim(),
  };
}

// ── Stage 4: resolveEmojiHit ──────────────────────────────────────────────
// Emoji provides highest-priority, unambiguous category signal.

export function resolveEmojiHit(text: string): { emoji: string; categoryId: string } | null {
  for (const [emoji, hit] of Object.entries(EMOJI)) {
    if (text.includes(emoji)) return { emoji, categoryId: hit.categoryId };
  }
  return null;
}

// ── Stage 5: extractCandidateItems ────────────────────────────────────────
// Matches item keywords in text. Returns all candidates found.
// Currently at most one match (keyword scan). Future: multiple items.
//
// TODO(OCR): OCR line items → return structured ItemMatch[] directly
// TODO(AI):  model returns items with quantities, unit prices, sub-categories

export function extractCandidateItems(text: string): ItemMatch[] {
  const hit = matchItem(text);
  return hit ? [hit] : [];
}

// ── Stage 6: resolveCategoryCandidates ────────────────────────────────────
// Determines the best categoryId from merchant + item signals.
// Resolution priority: item keyword > self-describing store > ambiguous store.

export function resolveCategoryCandidates(
  merchant: StoreMatch | undefined,
  items: ItemMatch[],
): { categoryId: string | null; confidence: ParseConfidence } {
  // Both signals present → item category is more specific
  if (merchant && items.length > 0) {
    return { categoryId: items[0].categoryId, confidence: 'high' };
  }
  // Self-describing store (e.g. McDonald's, Uber, Netflix)
  if (merchant && !merchant.needsContext && merchant.categoryId) {
    return { categoryId: merchant.categoryId, confidence: 'high' };
  }
  // Ambiguous store (e.g. supermarket, pharmacy) — needs item context
  if (merchant?.needsContext) {
    return { categoryId: null, confidence: 'low' };
  }
  // Item keyword only (no store match)
  if (items.length > 0) {
    return { categoryId: items[0].categoryId, confidence: 'medium' };
  }
  return { categoryId: null, confidence: 'failed' };
}

// ── Stage 7: scoreConfidence ──────────────────────────────────────────────
// Converts categorical confidence to a numeric score and a confirmation flag.
// needsConfirmation: true means "parser has a candidate but user should verify".
//
// TODO(AI): model returns raw score → map to ParseConfidence bucket here

const CONFIDENCE_SCORE: Record<ParseConfidence, number> = {
  high:   1.0,
  medium: 0.6,
  low:    0.3,
  failed: 0.0,
};

export interface ConfidenceScore {
  score: number;
  needsConfirmation: boolean;
}

export function scoreConfidence(confidence: ParseConfidence): ConfidenceScore {
  return {
    score: CONFIDENCE_SCORE[confidence],
    // Only 'low' signals "I have a partial match but need confirmation".
    // 'failed' means no match at all — the UI handles that differently.
    needsConfirmation: confidence === 'low',
  };
}
