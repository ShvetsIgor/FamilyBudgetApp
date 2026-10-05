import { isActiveCategory } from '@/features/categories/policy/categoryPolicy';
import type { Category, Currency } from '@/shared/types';
import { parseLocalDate } from '@/shared/utils/currency';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import { PARSER_CURRENCIES, type ParsedExpenseResult } from './expenseParser/schema';

const MIN_CONFIDENCE = 0.85;

export type ValidatedParsedExpense = ParsedExpenseResult & {
  amount: number;
  currency: Currency;
  categoryId: string;
  date: string;
  needsClarification: false;
  clarificationQuestion: null;
};

export type ExpenseValidationResult =
  | { valid: true; expense: ValidatedParsedExpense }
  | {
      valid: false;
      reason: 'clarification_required' | 'invalid_amount' | 'invalid_currency'
        | 'invalid_category' | 'low_confidence' | 'invalid_date';
    };

/**
 * Validates parser output without performing writes or reading the clock.
 * The caller supplies freshly loaded categories belonging to the authenticated
 * user, and today's date in that user's timezone. Privacy is resolved before
 * persistence by the existing resolveExpensePrivacy helper.
 */
export function validateParsedExpense(
  parsed: ParsedExpenseResult,
  context: { categories: readonly Category[]; todayKey: string },
): ExpenseValidationResult {
  if (parsed.needsClarification !== false) {
    return { valid: false, reason: 'clarification_required' };
  }
  const { amount, currency, categoryId, confidence } = parsed;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { valid: false, reason: 'invalid_amount' };
  }
  if (!currency || !(PARSER_CURRENCIES as readonly string[]).includes(currency)) {
    return { valid: false, reason: 'invalid_currency' };
  }
  if (parsed.suggestedCategoryName || !categoryId || !context.categories.some((category) => (
    category.id === categoryId && category.type === 'expense' && isActiveCategory(category)
  ))) {
    return { valid: false, reason: 'invalid_category' };
  }
  if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE || confidence > 1) {
    return { valid: false, reason: 'low_confidence' };
  }

  const date = parsed.date === null ? context.todayKey : parsed.date;
  // A round trip rejects calendar overflow, e.g. February 31 becoming March 3.
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || toLocalDateKey(parseLocalDate(date)) !== date) {
    return { valid: false, reason: 'invalid_date' };
  }

  return {
    valid: true,
    expense: { ...parsed, amount, currency, categoryId, date, needsClarification: false, clarificationQuestion: null },
  };
}
