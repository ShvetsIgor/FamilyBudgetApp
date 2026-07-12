import type { Currency } from '@/shared/types';
import { formatAmount } from '@/shared/utils/currency';

/**
 * Family aggregates must never add different currencies into one number —
 * without a reliable FX backend that would be a lie. These helpers group
 * amounts by currency and render each currency's total separately.
 */

export interface CurrencyTotal {
  currency: Currency;
  total: number;
}

/** Sums amounts per currency, largest first. */
export function groupByCurrency(items: { amount: number; currency: Currency }[]): CurrencyTotal[] {
  const map = new Map<Currency, number>();
  for (const it of items) {
    map.set(it.currency, (map.get(it.currency) ?? 0) + it.amount);
  }
  return [...map.entries()]
    .map(([currency, total]) => ({ currency, total }))
    .sort((a, b) => b.total - a.total);
}

/** The currency carrying the largest total (fallback for single-value UI). */
export function primaryCurrency(
  items: { amount: number; currency: Currency }[],
  fallback: Currency,
): Currency {
  return groupByCurrency(items)[0]?.currency ?? fallback;
}

/** The distinct currencies present, primary first. */
export function distinctCurrencies(items: { amount: number; currency: Currency }[]): Currency[] {
  return groupByCurrency(items).map((g) => g.currency);
}

/**
 * Renders per-currency totals as one string, e.g. "-₪5,000 · -$300".
 * An empty list renders as a single formatted zero in `fallback`.
 */
export function formatCurrencyTotals(
  totals: CurrencyTotal[],
  opts: { sign?: '+' | '-'; fallback: Currency } ,
): string {
  const sign = opts.sign ?? '';
  if (totals.length === 0) return `${formatAmount(0, opts.fallback)}`;
  return totals
    .map((g) => `${g.total > 0 ? sign : ''}${formatAmount(g.total, g.currency)}`)
    .join(' · ');
}
