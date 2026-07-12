/**
 * №15/16: family aggregates must never sum different currencies into one
 * number — group per currency and render each separately.
 */
import { describe, it, expect } from 'vitest';
import {
  groupByCurrency, primaryCurrency, distinctCurrencies, formatCurrencyTotals,
} from '@/features/family/utils/familyCurrency';
import type { Currency } from '@/shared/types';

const item = (amount: number, currency: Currency) => ({ amount, currency });

describe('groupByCurrency', () => {
  it('sums within each currency, largest first, never across', () => {
    const out = groupByCurrency([
      item(100, 'ILS'), item(50, 'USD'), item(200, 'ILS'), item(10, 'USD'),
    ]);
    expect(out).toEqual([
      { currency: 'ILS', total: 300 },
      { currency: 'USD', total: 60 },
    ]);
  });

  it('returns empty for no items', () => {
    expect(groupByCurrency([])).toEqual([]);
  });
});

describe('primaryCurrency / distinctCurrencies', () => {
  it('primary is the largest-total currency', () => {
    expect(primaryCurrency([item(10, 'USD'), item(100, 'ILS')], 'USD')).toBe('ILS');
  });
  it('falls back when empty', () => {
    expect(primaryCurrency([], 'CAD')).toBe('CAD');
  });
  it('distinct lists currencies primary-first', () => {
    expect(distinctCurrencies([item(10, 'USD'), item(100, 'ILS'), item(5, 'USD')]))
      .toEqual(['ILS', 'USD']);
  });
});

describe('formatCurrencyTotals', () => {
  it('joins per-currency totals with a separator and sign', () => {
    const s = formatCurrencyTotals(
      [{ currency: 'ILS', total: 300 }, { currency: 'USD', total: 60 }],
      { sign: '-', fallback: 'ILS' },
    );
    // Exact symbols depend on the formatter, but both currencies must appear,
    // separated, each carrying the sign.
    expect(s).toContain('300');
    expect(s).toContain('60');
    expect(s).toContain(' · ');
    expect(s.startsWith('-')).toBe(true);
  });

  it('renders a single formatted zero in the fallback when empty', () => {
    const s = formatCurrencyTotals([], { fallback: 'USD' });
    expect(s).toContain('0');
    expect(s).not.toContain(' · ');
  });
});
