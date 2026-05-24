/**
 * LAYER: merchant classifier — token role assignment for expense input.
 *
 * Given a ParserContext (already parsed by inputPipeline), assigns a role
 * to each raw input token:
 *   merchant — token belongs to the detected merchant name
 *   item     — token is an item/product candidate
 *   amount   — token is a numeric amount
 *   noise    — stop word, punctuation-only, or too short
 *
 * This is a thin classification layer on top of what the parser already knows.
 * It does NOT re-parse — it re-annotates using parser-derived knowledge.
 *
 * Example:
 *   input:   "Dabbah drill milk 350"
 *   parser:  merchant="Dabbah", merchantKey="dabbah", itemCandidates=["drill","milk"], amount=350
 *   output:
 *     { raw: "Dabbah", normalized: "dabbah", role: "merchant" }
 *     { raw: "drill",  normalized: "drill",  role: "item"     }
 *     { raw: "milk",   normalized: "milk",   role: "item"     }
 *     { raw: "350",    normalized: "350",    role: "amount"   }
 *
 * Architecture invariants:
 *   - Pure functions. No mutations.
 *   - Never re-parses — derives from existing ParserContext fields only.
 *   - Store is NOT an entity. Merchant = lightweight contextual token.
 */

import type { ParserContext } from './inputPipeline';
import type { ClassifiedInputToken, TokenRole } from '../types/expenseContext';
import { normalizeText } from './inputNormalizer';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Classify each raw input token by its role in the expense context.
 * Splits the raw input on whitespace and matches against parser-derived fields.
 */
export function classifyInputTokens(ctx: ParserContext): ClassifiedInputToken[] {
  const merchantNorm = ctx.merchantKey ?? '';
  const itemNormSet = new Set(ctx.itemCandidates.map((t) => normalizeText(t)));

  return ctx.raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw): ClassifiedInputToken => {
      const normalized = normalizeText(raw);
      const role = assignRole(normalized, merchantNorm, itemNormSet);
      return { raw, normalized, role };
    });
}

/**
 * Return the raw merchant tokens (original casing) from the parsed context.
 * A multi-word merchant ("Rami Levi") returns multiple tokens.
 */
export function extractMerchantTokens(ctx: ParserContext): string[] {
  if (!ctx.merchant) return [];
  return ctx.merchant.trim().split(/\s+/).filter(Boolean);
}

/**
 * Return raw item token strings from the parsed context.
 */
export function extractItemTokens(ctx: ParserContext): string[] {
  return ctx.itemCandidates.filter((t) => t.trim().length >= 2);
}

/**
 * Return all non-noise normalized tokens (merchant key + item candidates).
 * De-duplicated. Used for metadata tag matching.
 */
export function extractNormalizedTokens(ctx: ParserContext): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const push = (s: string) => {
    const n = normalizeText(s);
    if (n && !seen.has(n)) { seen.add(n); result.push(n); }
  };

  if (ctx.merchantKey) push(ctx.merchantKey);
  for (const item of ctx.itemCandidates) push(item);

  return result;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function assignRole(
  normalized: string,
  merchantNorm: string,
  itemNormSet: Set<string>,
): TokenRole {
  if (!normalized) return 'noise';

  // Numeric → amount
  if (/^\d+([.,]\d+)?$/.test(normalized)) return 'amount';

  // Matches detected merchant key → merchant
  if (merchantNorm && normalized === merchantNorm) return 'merchant';

  // In item candidates list → item
  if (itemNormSet.has(normalized)) return 'item';

  // Single character → noise
  if (normalized.length <= 1) return 'noise';

  // Everything else that is text but wasn't classified — treat as noise
  // (could be connector words, currency symbols stripped by normalizer, etc.)
  return 'noise';
}
