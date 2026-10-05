import { describe, expect, it } from 'vitest';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import type { ParsedExpenseResult } from '@/features/ai/expenseParser/schema';
import type { Category } from '@/shared/types';

const category: Category = {
  id: 'groceries', userId: 'user-1', name: 'Продукты', type: 'expense',
  icon: 'cart', color: '#000000', order: 0, isPrivate: false,
};
const context = { categories: [category], todayKey: '2026-09-21' };
const parsed: ParsedExpenseResult = {
  type: 'expense', amount: 187.5, currency: 'ILS', merchant: 'Shufersal',
  description: 'Продукты', categoryId: 'groceries', date: null,
  confidence: 0.9, needsClarification: false, clarificationQuestion: null,
};

describe('validateParsedExpense', () => {
  it('accepts a complete result and uses the caller\'s local today without mutating input', () => {
    const input = Object.freeze({ ...parsed });
    expect(validateParsedExpense(input, context)).toEqual({
      valid: true, expense: { ...parsed, date: context.todayKey },
    });
    expect(input.date).toBeNull();
  });

  it('never overrides a request for clarification even with high confidence', () => {
    expect(validateParsedExpense({ ...parsed, confidence: 1, needsClarification: true }, context))
      .toEqual({ valid: false, reason: 'clarification_required' });
  });

  it.each([null, 0, -1, NaN, Infinity, -Infinity])('rejects amount %s', (amount) => {
    expect(validateParsedExpense({ ...parsed, amount }, context))
      .toEqual({ valid: false, reason: 'invalid_amount' });
  });

  it.each(['ILS', 'USD', 'CAD', 'RUB'] as const)('preserves supported currency %s', (currency) => {
    expect(validateParsedExpense({ ...parsed, currency }, context)).toMatchObject({
      valid: true, expense: { currency },
    });
  });

  it.each([null, 'EUR', ''])('rejects unsupported or missing currency %s without defaulting', (currency) => {
    const input = { ...parsed, currency } as ParsedExpenseResult;
    expect(validateParsedExpense(input, context)).toEqual({ valid: false, reason: 'invalid_currency' });
  });

  it.each([null, '', 'invented-category'])('rejects a missing or unknown category %s', (categoryId) => {
    expect(validateParsedExpense({ ...parsed, categoryId }, context))
      .toEqual({ valid: false, reason: 'invalid_category' });
  });

  it('rejects a category removed after parsing', () => {
    expect(validateParsedExpense(parsed, { ...context, categories: [] }))
      .toEqual({ valid: false, reason: 'invalid_category' });
  });

  it.each([{ archived: true }, { type: 'income' as const }])('rejects an unavailable expense category %j', (change) => {
    expect(validateParsedExpense(parsed, { ...context, categories: [{ ...category, ...change }] }))
      .toEqual({ valid: false, reason: 'invalid_category' });
  });

  it('accepts a private active category for subsequent privacy resolution', () => {
    expect(validateParsedExpense(parsed, { ...context, categories: [{ ...category, isPrivate: true }] }).valid)
      .toBe(true);
  });

  it.each([0, 0.849, -1, 1.1, NaN, Infinity])('rejects low or invalid confidence %s', (confidence) => {
    expect(validateParsedExpense({ ...parsed, confidence }, context))
      .toEqual({ valid: false, reason: 'low_confidence' });
  });

  it.each([0.85, 1])('accepts confidence boundary %s', (confidence) => {
    expect(validateParsedExpense({ ...parsed, confidence }, context).valid).toBe(true);
  });

  it.each(['2024-02-29', '2026-09-20', '2026-12-31'])('preserves valid explicit date %s', (date) => {
    expect(validateParsedExpense({ ...parsed, date }, context)).toMatchObject({ valid: true, expense: { date } });
  });

  it.each(['2026-02-29', '2026-02-31', '2026-04-31', '2026-13-01', '2026-00-01', '2026-09-00',
    '2026-9-21', '2026-09-21T00:00:00Z', 'yesterday', ''])('rejects invalid explicit date %s', (date) => {
    expect(validateParsedExpense({ ...parsed, date }, context)).toEqual({ valid: false, reason: 'invalid_date' });
  });

  it('rejects an invalid fallback today rather than using the server clock', () => {
    expect(validateParsedExpense(parsed, { ...context, todayKey: '2026-02-31' }))
      .toEqual({ valid: false, reason: 'invalid_date' });
  });
});
