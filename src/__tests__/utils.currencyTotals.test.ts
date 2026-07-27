/**
 * Money in different currencies is never added together — there is no FX
 * source, so a $12 charge must not silently become ₪12 in a shekel total.
 */
import { describe, it, expect } from 'vitest';
import { groupByCurrency, splitOwnCurrency, formatCurrencyTotals } from '@/shared/utils/currencyTotals';
import { toOwnCurrency, foreignTotals, type MonthStats } from '@/features/stats/services/statsService';

const ILS = 'ILS' as const;
const USD = 'USD' as const;

const items = [
  { amount: 120, currency: ILS },
  { amount: 400, currency: ILS },
  { amount: 12, currency: USD },
];

describe('splitOwnCurrency', () => {
  it('keeps the account currency apart from everything else', () => {
    const out = splitOwnCurrency(items, ILS);
    expect(out.ownTotal).toBe(520);
    expect(out.others).toEqual([{ currency: USD, total: 12 }]);
  });

  it('never folds a foreign amount into the own total', () => {
    const out = splitOwnCurrency(items, ILS);
    expect(out.ownTotal).not.toBe(532);
  });

  it('reports zero own total when nothing is in that currency', () => {
    const out = splitOwnCurrency([{ amount: 12, currency: USD }], ILS);
    expect(out.ownTotal).toBe(0);
    expect(out.others).toHaveLength(1);
  });
});

describe('groupByCurrency', () => {
  it('sums within a currency, largest first', () => {
    expect(groupByCurrency(items)).toEqual([
      { currency: ILS, total: 520 },
      { currency: USD, total: 12 },
    ]);
  });
});

describe('formatCurrencyTotals', () => {
  it('renders each currency separately', () => {
    const text = formatCurrencyTotals(groupByCurrency(items), { sign: '-', fallback: ILS });
    expect(text).toContain('520');
    expect(text).toContain('12');
    expect(text).toContain('·');
  });
});

const stats = (over: Partial<MonthStats> = {}): MonthStats => ({
  month: '2026-07',
  totalExpenses: 532,
  totalIncome: 6500,
  byCategory: {},
  totalsByCurrency: { ILS: 520, USD: 12 },
  incomeByCurrency: { ILS: 6500 },
  byCategoryByCurrency: {
    ILS: { groceries: 520 },
    USD: { subscriptions: 12 },
  },
  currencyBreakdownComplete: true,
  ...over,
});

describe('toOwnCurrency', () => {
  it('reads the totals of one currency out of stored stats', () => {
    const out = toOwnCurrency(stats(), ILS);
    expect(out.totalExpenses).toBe(520);
    expect(out.totalIncome).toBe(6500);
    expect(out.byCategory).toEqual({ groceries: 520 });
  });

  it('falls back to the legacy blind sum when no breakdown was stored', () => {
    const legacy = stats({
      totalsByCurrency: undefined,
      incomeByCurrency: undefined,
      byCategoryByCurrency: undefined,
      currencyBreakdownComplete: undefined,
    });
    expect(toOwnCurrency(legacy, ILS).totalExpenses).toBe(532);
  });

  it('yields zero for a currency the month has none of', () => {
    expect(toOwnCurrency(stats(), 'CAD').totalExpenses).toBe(0);
  });

  it('does not trust a partial map added to a legacy monthlyStats document', () => {
    const partiallyUpgraded = stats({
      totalExpenses: 1_012,
      totalsByCurrency: { USD: 12 },
      currencyBreakdownComplete: undefined,
    });

    expect(toOwnCurrency(partiallyUpgraded, ILS).totalExpenses).toBe(1_012);
  });
});

describe('foreignTotals', () => {
  it('collects the other currencies across months', () => {
    const out = foreignTotals([stats(), stats()], ILS);
    expect(out).toEqual([{ currency: USD, total: 24 }]);
  });

  it('is empty when everything is in the account currency', () => {
    const single = stats({ totalsByCurrency: { ILS: 520 } });
    expect(foreignTotals([single], ILS)).toEqual([]);
  });

  it('ignores partial legacy maps whose historical currencies are unknown', () => {
    const partial = stats({
      totalsByCurrency: { USD: 12 },
      currencyBreakdownComplete: undefined,
    });
    expect(foreignTotals([partial], ILS)).toEqual([]);
  });
});
