/**
 * The «recurring only» analytics view cannot read stored `monthlyStats` — those
 * carry no recurring flag — so it rebuilds the same shape from raw expenses.
 */
import { describe, it, expect } from 'vitest';
import { monthStatsFromExpenses, isRecurringExpense } from '@/features/analytics/utils/monthStatsFromExpenses';

const exp = (over: Partial<Parameters<typeof monthStatsFromExpenses>[0][number]> = {}) => ({
  amount: 100,
  categoryId: 'rent',
  date: new Date(2026, 6, 15, 12).toISOString(),
  splits: [],
  tags: ['recurring'],
  isRecurring: true,
  ...over,
});

describe('isRecurringExpense', () => {
  it('accepts either the flag or the tag', () => {
    expect(isRecurringExpense({ isRecurring: true, tags: [] })).toBe(true);
    expect(isRecurringExpense({ isRecurring: false, tags: ['recurring'] })).toBe(true);
  });

  it('rejects an ordinary expense', () => {
    expect(isRecurringExpense({ isRecurring: false, tags: ['coffee'] })).toBe(false);
  });
});

describe('monthStatsFromExpenses', () => {
  it('returns one entry per requested month, in order, zero-filled', () => {
    const out = monthStatsFromExpenses([], ['2026-05', '2026-06', '2026-07']);
    expect(out.map((m) => m.month)).toEqual(['2026-05', '2026-06', '2026-07']);
    expect(out.every((m) => m.totalExpenses === 0)).toBe(true);
  });

  it('sums into the local month bucket', () => {
    const out = monthStatsFromExpenses([exp(), exp({ amount: 50 })], ['2026-07']);
    expect(out[0].totalExpenses).toBe(150);
    expect(out[0].byCategory).toEqual({ rent: 150 });
  });

  it('buckets a past-midnight expense by its local month', () => {
    // 00:30 local on 1 July is still June in UTC for a clock ahead of UTC
    const out = monthStatsFromExpenses(
      [exp({ date: new Date(2026, 6, 1, 0, 30).toISOString() })],
      ['2026-06', '2026-07'],
    );
    expect(out[1].totalExpenses).toBe(100);
  });

  it('credits split rows to their own categories with the remainder on the main one', () => {
    const out = monthStatsFromExpenses(
      [exp({ amount: 100, categoryId: 'rent', splits: [{ categoryId: 'utilities', amount: 30 }] })],
      ['2026-07'],
    );
    expect(out[0].byCategory).toEqual({ utilities: 30, rent: 70 });
    expect(out[0].totalExpenses).toBe(100);
  });

  it('adds no remainder when splits cover the whole amount', () => {
    const out = monthStatsFromExpenses(
      [exp({ amount: 100, categoryId: 'rent', splits: [{ categoryId: 'utilities', amount: 100 }] })],
      ['2026-07'],
    );
    expect(out[0].byCategory).toEqual({ utilities: 100 });
  });

  it('ignores expenses outside the requested months', () => {
    const out = monthStatsFromExpenses([exp({ date: new Date(2025, 0, 5, 12).toISOString() })], ['2026-07']);
    expect(out[0].totalExpenses).toBe(0);
  });

  it('leaves income at zero so filtered spend is never compared to full income', () => {
    const out = monthStatsFromExpenses([exp()], ['2026-07']);
    expect(out[0].totalIncome).toBe(0);
  });
});
