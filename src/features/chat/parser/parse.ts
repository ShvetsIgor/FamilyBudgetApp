import type { ParseResult } from '@/shared/types/message';
import type { KeywordHit } from './dictionary';
import { KEYWORDS, EMOJI } from './dictionary';
import { extractDate } from './parseDate';

export interface ParserContext {
  learned: Record<string, KeywordHit>;
}

export function parseMessage(text: string, ctx: ParserContext): ParseResult {
  // 1. Normalize
  let t = text.trim().toLowerCase().replace(/\s+/g, ' ');

  // 2. Slash-command → not an expense
  if (t.startsWith('/')) {
    return { amount: 0, categoryId: null, parentId: null, confidence: 'failed' };
  }

  // 3. Extract date before searching for keywords (removes date tokens from text)
  const extracted = extractDate(t);
  const date = extracted?.date;
  const dateLabel = extracted?.label;
  if (extracted) {
    t = extracted.rest.replace(/\s+/g, ' ').trim();
  }

  // 4. Extract first number (integer or decimal, comma or dot separator)
  const numMatch = t.match(/(\d+([.,]\d+)?)/);
  if (!numMatch) {
    return { amount: 0, categoryId: null, parentId: null, confidence: 'failed', date, dateLabel };
  }
  const amount = parseFloat(numMatch[1].replace(',', '.'));

  // 5. Remove number from text to get context
  const rest = t.replace(numMatch[0], '').trim();
  if (!rest) {
    // Bare number → clarify needed (keep date)
    return { amount, categoryId: null, parentId: null, confidence: 'failed', date, dateLabel };
  }

  // 6. Emoji (highest priority)
  for (const [emo, hit] of Object.entries(EMOJI)) {
    if (rest.includes(emo)) {
      return {
        amount,
        parentId: hit.parentId,
        categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: emo,
        confidence: 'high',
        date,
        dateLabel,
      };
    }
  }

  // 7. Learned keywords (priority over built-in)
  for (const [kw, hit] of Object.entries(ctx.learned)) {
    if (rest.includes(kw.toLowerCase())) {
      return {
        amount,
        parentId: hit.parentId,
        categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: kw,
        confidence: 'high',
        date,
        dateLabel,
      };
    }
  }

  // 8. Built-in keywords (longest match first)
  const sortedKeywords = Object.entries(KEYWORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [kw, hit] of sortedKeywords) {
    if (rest.includes(kw)) {
      return {
        amount,
        parentId: hit.parentId,
        categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: kw,
        confidence: 'medium',
        date,
        dateLabel,
      };
    }
  }

  // 9. Nothing matched → clarify (preserve date)
  return { amount, categoryId: null, parentId: null, confidence: 'failed', date, dateLabel };
}
