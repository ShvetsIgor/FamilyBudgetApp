import type { ParseResult } from '@/shared/types/message';
import type { KeywordHit } from './dictionary';
import { EMOJI } from './dictionary';
import { extractDate } from './parseDate';
import { matchStore } from './storeDictionary';
import { matchItem } from './itemDictionary';

export interface ParserContext {
  learned: Record<string, KeywordHit>;
}

export function parseMessage(text: string, ctx: ParserContext): ParseResult {
  // 1. Normalize
  const origInput = text.trim().replace(/\s+/g, ' ');
  let t = origInput.toLowerCase();

  // 2. Slash-command → not an expense
  if (t.startsWith('/')) {
    return { amount: 0, categoryId: null, parentId: null, confidence: 'failed' };
  }

  // 2.1 Income prefix "+" → strip and mark as income, skip store/item dictionaries
  const isIncome = t.startsWith('+');
  if (isIncome) {
    t = t.slice(1).trimStart();
    if (!t) return { amount: 0, categoryId: null, parentId: null, confidence: 'failed', isIncome: true };
  }

  // 3. Extract date (removes date tokens from text)
  const extracted = extractDate(t);
  const date = extracted?.date;
  const dateLabel = extracted?.label;
  if (extracted) {
    t = extracted.rest.replace(/\s+/g, ' ').trim();
  }

  // 4. Extract number
  const numMatch = t.match(/(\d+([.,]\d+)?)/);
  if (!numMatch) {
    return { amount: 0, categoryId: null, parentId: null, confidence: 'failed', date, dateLabel, ...(isIncome ? { isIncome } : {}) };
  }
  const amount = parseFloat(numMatch[1].replace(',', '.'));

  // 5. Context text (without number and date tokens)
  const rest = t.replace(numMatch[0], '').trim();

  const inc = isIncome ? { isIncome: true as const } : {};
  const df = date != null ? { date, ...(dateLabel != null ? { dateLabel } : {}) } : {};

  // For income: always clarify category (don't use expense store/item dictionaries)
  if (isIncome) {
    const note = rest ? rest.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : undefined;
    return { amount, categoryId: null, parentId: null, confidence: 'failed', note, ...df, ...inc };
  }

  if (!rest) {
    return { amount, categoryId: null, parentId: null, confidence: 'failed', date, dateLabel };
  }

  const note = rest.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

  // 6. Emoji (highest priority)
  for (const [emo, hit] of Object.entries(EMOJI)) {
    if (rest.includes(emo)) {
      return { amount, parentId: hit.parentId, categoryId: hit.subId ?? hit.parentId, matchedKeyword: emo, confidence: 'high', note, ...df };
    }
  }

  // 7. Learned keywords (user-specific, priority over built-in)
  // Always ask for confirmation so user can pick a different category for the same place
  for (const [kw, hit] of Object.entries(ctx.learned)) {
    if (rest.includes(kw.toLowerCase())) {
      const storeCheck = matchStore(rest);
      if (storeCheck) break; // defer to store pipeline
      return {
        amount, parentId: null, categoryId: null, matchedKeyword: kw, confidence: 'low',
        learnedCategoryId: hit.subId ?? hit.parentId, learnedParentId: hit.parentId,
        note, ...df,
      };
    }
  }

  // 8. Store + Item pipeline
  const storeMatch = matchStore(rest);
  const itemMatch = matchItem(rest);

  if (storeMatch && itemMatch) {
    // Both known → high confidence; use item category (more specific)
    return {
      amount, confidence: 'high',
      parentId: itemMatch.parentId, categoryId: itemMatch.subId,
      storeId: storeMatch.id, storeName: storeMatch.name, storeGroup: storeMatch.storeGroup,
      matchedKeyword: itemMatch.keyword,
      note, ...df,
    };
  }

  if (storeMatch && !itemMatch) {
    if (storeMatch.needsContext) {
      // Ambiguous store (supermarket, amazon, pharmacy) → always ask what was bought
      return {
        amount, confidence: 'low',
        parentId: null, categoryId: null,
        storeId: storeMatch.id, storeName: storeMatch.name, storeGroup: storeMatch.storeGroup,
        note, ...df,
      };
    }
    // Self-describing store (McDonalds, Uber, Netflix) → high confidence
    return {
      amount, confidence: 'high',
      parentId: storeMatch.parentId ?? null, categoryId: storeMatch.subId ?? null,
      storeId: storeMatch.id, storeName: storeMatch.name, storeGroup: storeMatch.storeGroup,
      matchedKeyword: storeMatch.keyword,
      note, ...df,
    };
  }

  if (itemMatch) {
    // Item only (no store known) → medium confidence
    return {
      amount, confidence: 'medium',
      parentId: itemMatch.parentId, categoryId: itemMatch.subId,
      matchedKeyword: itemMatch.keyword,
      note, ...df,
    };
  }

  // 9. Nothing matched → clarify
  return { amount, categoryId: null, parentId: null, confidence: 'failed', note, ...df };
}
