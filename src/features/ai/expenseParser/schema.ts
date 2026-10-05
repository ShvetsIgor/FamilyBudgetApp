import type { Currency } from '@/shared/types';

/**
 * Currencies the AI parser may return.
 *
 * The task spec asked for ILS/USD/EUR/RUB/CAD, but the app's `Currency` type
 * (`shared/types/index.ts`) is only 'ILS' | 'USD' | 'CAD' | 'RUB' — EUR was
 * never wired into `getCurrencySymbol`, `totalsByCurrency`,
 * `byCategoryByCurrency`, or any currency picker. Returning EUR from the
 * parser would either fail to type-check against `AddExpenseInput.currency`
 * or, if force-cast, silently corrupt every currency-keyed map in the app
 * that has never seen that key. Scoped out here on purpose; adding EUR is a
 * deliberate app-wide change, not a one-line schema edit.
 */
export const PARSER_CURRENCIES = ['ILS', 'USD', 'CAD', 'RUB'] as const satisfies readonly Currency[];

export type ParserCurrency = (typeof PARSER_CURRENCIES)[number];

/** MVP supports only a single, non-split expense (see product decision in the task). */
export type ParsedExpenseType = 'expense';

/**
 * What `parseExpenseText` (next step) resolves free text into.
 *
 * `date` is a local `YYYY-MM-DD` key (see `shared/utils/dateKey.ts`), never a
 * UTC ISO string with a time component — the app has a standing rule against
 * mixing the two (see CLAUDE.md §6), and five entry forms were bug-fixed in
 * 2026-09-05 for exactly that mistake. `null` means "no date mentioned",
 * resolved to today by the caller, not by the model guessing.
 */
export interface ParsedExpenseResult {
  type: ParsedExpenseType;
  amount: number | null;
  currency: ParserCurrency | null;
  merchant: string | null;
  description: string | null;
  /** Must be one of the categoryIds passed into the parser, or null — never invented. */
  categoryId: string | null;
  /** Display-only suggestion when no active category fits. Never creates a category. */
  suggestedCategoryName: string | null;
  date: string | null;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string | null;
}

const PARSED_EXPENSE_PROPERTY_ORDER = [
  'type', 'amount', 'currency', 'merchant', 'description',
  'categoryId', 'suggestedCategoryName', 'date', 'confidence', 'needsClarification', 'clarificationQuestion',
] as const satisfies readonly (keyof ParsedExpenseResult)[];

/**
 * Groq structured-output JSON Schema, built per request from the caller's
 * actual active categoryIds — this is what makes requirement "categoryId
 * only from the provided list or null" a schema-level guarantee (Groq
 * `strict: true` cannot return a value outside an enum) rather than only a
 * prompt instruction. The server-side re-check against the same list
 * (validation step, later) stays anyway — a single layer is never enough
 * for something that creates a financial write.
 */
export function buildExpenseParserJsonSchema(categoryIds: readonly string[]) {
  return {
    name: 'expense_parse_result',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', enum: ['expense'] },
        amount: { type: ['number', 'null'] },
        currency: { type: ['string', 'null'], enum: [...PARSER_CURRENCIES, null] },
        merchant: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        categoryId: { type: ['string', 'null'], enum: [...categoryIds, null] },
        suggestedCategoryName: { type: ['string', 'null'] },
        date: { type: ['string', 'null'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        needsClarification: { type: 'boolean' },
        clarificationQuestion: { type: ['string', 'null'] },
      },
      required: [...PARSED_EXPENSE_PROPERTY_ORDER],
    },
  } as const;
}
