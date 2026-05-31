import type { ParseResult } from '@/shared/types/message';
import type { KeywordHit } from './dictionary';
import { extractDate } from './parseDate';
import { normalizeName } from '@/shared/utils/normalizeName';
import {
  tokenizeInput,
  detectMerchant,
  extractAmounts,
  resolveEmojiHit,
  extractCandidateItems,
  resolveCategoryCandidates,
  scoreConfidence,
} from './pipeline';

export interface ParserContext {
  learned: Record<string, KeywordHit>;
}

export function parseMessage(text: string, ctx: ParserContext): ParseResult {
  // ── Stage 1: tokenize ────────────────────────────────────────────────────
  const { normalized, lower, isIncome, isSlashCommand } = tokenizeInput(text);

  if (isSlashCommand) {
    return { amount: 0, categoryId: null, confidence: 'failed' };
  }

  let t = isIncome ? lower.slice(1).trimStart() : lower;
  const displayText = isIncome ? normalized.slice(1).trimStart() : normalized;
  if (isIncome && !t) {
    return { amount: 0, categoryId: null, confidence: 'failed', isIncome: true };
  }

  // ── [extractDate] ─────────────────────────────────────────────────────────
  const extracted = extractDate(t);
  const date = extracted?.date;
  const dateLabel = extracted?.label;
  if (extracted) t = extracted.rest.replace(/\s+/g, ' ').trim();
  // Strip the same date phrase from the display string so the note doesn't
  // end up containing "5 июня" or "завтра".
  const displayWithoutDate = extracted
    ? displayText.replace(new RegExp(extracted.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').replace(/\s+/g, ' ').trim()
    : displayText;

  const df = date != null ? { date, ...(dateLabel != null ? { dateLabel } : {}) } : {};
  const inc = isIncome ? { isIncome: true as const } : {};

  // ── Stage 3: extract amount ───────────────────────────────────────────────
  const amounts = extractAmounts(t);
  if (!amounts) {
    return { amount: 0, categoryId: null, confidence: 'failed', ...df, ...inc };
  }
  const { amount, rest } = amounts;
  const displayRest = extractAmounts(displayWithoutDate)?.rest ?? rest;

  // Income: skip expense store/item pipeline. Preserve user casing via displayRest.
  if (isIncome) {
    const displayIncomeRest = extractAmounts(displayWithoutDate)?.rest ?? rest;
    const note = displayIncomeRest ? normalizeName(displayIncomeRest) : undefined;
    return { amount, categoryId: null, confidence: 'failed', ...(note ? { note } : {}), ...df, ...inc };
  }

  if (!rest) {
    return { amount, categoryId: null, confidence: 'failed', ...df };
  }

  const note = normalizeName(displayRest);

  // ── Stage 4: emoji (highest priority) ────────────────────────────────────
  const emojiHit = resolveEmojiHit(rest);
  if (emojiHit) {
    return { amount, categoryId: emojiHit.categoryId, matchedKeyword: emojiHit.emoji, confidence: 'high', note, ...df };
  }

  // ── Learned keywords (user-specific, checked before built-in dictionaries) ──
  for (const [kw, hit] of Object.entries(ctx.learned)) {
    if (rest.includes(kw.toLowerCase())) {
      if (detectMerchant(rest)) break; // known store → defer to merchant pipeline
      return {
        amount, categoryId: null, matchedKeyword: kw, confidence: 'low',
        learnedCategoryId: hit.categoryId,
        note, ...df,
      };
    }
  }

  // ── Stage 2: detect merchant ──────────────────────────────────────────────
  const merchant = detectMerchant(rest);
  // ── Stage 5: extract candidate items ─────────────────────────────────────
  const candidates = extractCandidateItems(rest);

  // ── Stage 6: resolve category ─────────────────────────────────────────────
  const { categoryId, confidence } = resolveCategoryCandidates(merchant, candidates);

  // ── Stage 7: score confidence ─────────────────────────────────────────────
  const { needsConfirmation } = scoreConfidence(confidence);

  if (merchant) {
    const storeFields = { storeId: merchant.id, storeName: merchant.name, storeGroup: merchant.storeGroup };
    // Item keyword takes precedence for matchedKeyword when both signals present
    const matchedKeyword = candidates.length > 0 ? candidates[0].keyword : merchant.keyword;
    return {
      amount, categoryId, confidence,
      ...(needsConfirmation ? { needsConfirmation } : {}),
      ...(matchedKeyword && !merchant.needsContext ? { matchedKeyword } : {}),
      ...storeFields,
      note, ...df,
    };
  }

  if (candidates.length > 0) {
    return {
      amount, categoryId, confidence,
      matchedKeyword: candidates[0].keyword,
      note, ...df,
    };
  }

  // Unrecognized text with amount → treat as unknown store name for folder-first clarification
  if (rest.trim()) {
    const storeName = normalizeName(displayRest);
    const storeId = `unknown_${rest.trim().toLowerCase().replace(/\s+/g, '_')}`;
    return { amount, categoryId: null, confidence: 'low', storeId, storeName, note: storeName, ...df };
  }

  return { amount, categoryId: null, confidence: 'failed', note, ...df };
}
