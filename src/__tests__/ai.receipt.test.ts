/**
 * A read receipt is recorded by its total, split across the user's categories.
 * The model's answer is untrusted: totals, currencies, dates, lines and
 * categories are all re-checked, and whatever the lines do not cover stays
 * without a category for the user to assign.
 */
import { describe, expect, it } from 'vitest';
import { receiptExpenseParts, sanitizeReceipt } from '@/features/ai/receiptParser/receipt';

const opts = { categoryIds: ['groceries', 'household'], defaultCurrency: 'ILS' as const, todayKey: '2026-10-11' };
const raw = (over: Record<string, unknown> = {}) => ({
  merchant: 'Shufersal', date: '2026-10-09', currency: 'ILS', total: 76.1,
  items: [
    { name: 'Milk', amount: 6.9, categoryId: 'groceries' },
    { name: 'Bread', amount: 12.5, categoryId: 'groceries' },
    { name: 'Dish soap', amount: 14.9, categoryId: 'household' },
    { name: 'Coffee', amount: 32, categoryId: null },
  ],
  ...over,
});

describe('sanitizeReceipt', () => {
  it('groups lines by category, largest first, unknown and the uncovered rest last', () => {
    const result = sanitizeReceipt(raw({ total: 80 }), opts);
    expect(result).toEqual({ ok: true, receipt: {
      merchant: 'Shufersal', date: '2026-10-09', currency: 'ILS', total: 80,
      groups: [
        { categoryId: 'groceries', amount: 19.4, names: ['Milk', 'Bread'] },
        { categoryId: 'household', amount: 14.9, names: ['Dish soap'] },
        { categoryId: null, amount: 45.7, names: ['Coffee'] }, // 32 unknown + 13.70 the lines do not cover
      ],
    } });
  });

  it('always adds up to exactly the total', () => {
    const result = sanitizeReceipt(raw(), opts);
    if (!result.ok) throw new Error('expected ok');
    expect(Math.round(result.receipt.groups.reduce((s, g) => s + g.amount, 0) * 100) / 100).toBe(76.1);
  });

  it('drops lines that add up to more than the total — they cannot be trusted', () => {
    const result = sanitizeReceipt(raw({ total: 20 }), opts);
    expect(result).toMatchObject({ ok: true, receipt: { groups: [{ categoryId: null, amount: 20, names: [] }] } });
  });

  it('never keeps an invented category, a bad line or control characters', () => {
    const result = sanitizeReceipt(raw({ total: 10, items: [
      { name: 'Wine\u0000\nred', amount: 10, categoryId: 'alcohol' }, { name: 'x', amount: -3 }, { name: 'y', amount: 'nan' },
    ] }), opts);
    expect(result).toMatchObject({ ok: true, receipt: { groups: [{ categoryId: null, amount: 10, names: ['Wine red'] }] } });
  });

  it('refuses a receipt without a readable total', () => {
    expect(sanitizeReceipt(raw({ total: null }), opts)).toEqual({ ok: false, reason: 'no_total' });
    expect(sanitizeReceipt(raw({ total: -5 }), opts)).toEqual({ ok: false, reason: 'no_total' });
    expect(sanitizeReceipt(null, opts)).toEqual({ ok: false, reason: 'unreadable' });
    expect(sanitizeReceipt([raw()], opts)).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses an unsupported printed currency and defaults an unreadable one', () => {
    expect(sanitizeReceipt(raw({ currency: 'EUR' }), opts)).toEqual({ ok: false, reason: 'currency' });
    expect(sanitizeReceipt(raw({ currency: null }), { ...opts, defaultCurrency: 'USD' }))
      .toMatchObject({ ok: true, receipt: { currency: 'USD' } });
  });

  it.each([[null], ['2026-13-01'], ['2026-10-12'], ['2024-01-01'], ['09/10/26']])('date %s falls back to today', (date) => {
    expect(sanitizeReceipt(raw({ date }), opts)).toMatchObject({ ok: true, receipt: { date: '2026-10-11' } });
  });
});

describe('receiptExpenseParts', () => {
  it('makes the largest group the main category and the rest splits, merging repeats', () => {
    expect(receiptExpenseParts([
      { categoryId: 'household', amount: 14.9, names: [] },
      { categoryId: 'groceries', amount: 19.4, names: [] },
      { categoryId: 'groceries', amount: 32, names: [] },
    ])).toEqual({ categoryId: 'groceries', splits: [{ categoryId: 'household', amount: 14.9 }] });
  });

  it('refuses while any amount lacks a category', () => {
    expect(() => receiptExpenseParts([{ categoryId: null, amount: 5, names: [] }])).toThrow(/category/);
    expect(() => receiptExpenseParts([])).toThrow();
  });
});
