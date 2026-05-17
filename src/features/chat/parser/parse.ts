import type { ParseResult } from '@/shared/types/message';
import type { KeywordHit } from './dictionary';
import { KEYWORDS, EMOJI } from './dictionary';

export interface ParserContext {
  learned: Record<string, KeywordHit>;
}

export function parseMessage(text: string, ctx: ParserContext): ParseResult {
  // 1. Normalize
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');

  // 2. Slash-command → not an expense
  if (t.startsWith('/')) {
    return { amount: 0, categoryId: null, parentId: null, confidence: 'failed' };
  }

  // 3. Extract first number (integer or decimal, comma or dot separator)
  const numMatch = t.match(/(\d+([.,]\d+)?)/);
  if (!numMatch) {
    return { amount: 0, categoryId: null, parentId: null, confidence: 'failed' };
  }
  const amount = parseFloat(numMatch[1].replace(',', '.'));

  // 4. Remove number from text to get context
  const rest = t.replace(numMatch[0], '').trim();
  if (!rest) {
    // Bare number → clarify needed
    return { amount, categoryId: null, parentId: null, confidence: 'failed' };
  }

  // 5. Emoji (highest priority)
  for (const [emo, hit] of Object.entries(EMOJI)) {
    if (rest.includes(emo)) {
      return {
        amount,
        parentId: hit.parentId,
        categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: emo,
        confidence: 'high',
      };
    }
  }

  // 6. Learned keywords (priority over built-in)
  for (const [kw, hit] of Object.entries(ctx.learned)) {
    if (rest.includes(kw.toLowerCase())) {
      return {
        amount,
        parentId: hit.parentId,
        categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: kw,
        confidence: 'high',
      };
    }
  }

  // 7. Built-in keywords (longest match first to avoid "вода" matching inside "еда вне дома")
  const sortedKeywords = Object.entries(KEYWORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [kw, hit] of sortedKeywords) {
    if (rest.includes(kw)) {
      return {
        amount,
        parentId: hit.parentId,
        categoryId: hit.subId ?? hit.parentId,
        matchedKeyword: kw,
        confidence: 'medium',
      };
    }
  }

  // 8. Nothing matched → clarify
  return { amount, categoryId: null, parentId: null, confidence: 'failed' };
}
