import type { Currency } from '@/shared/types';
import { formatAmount } from '@/shared/utils/currency';

/**
 * Money in different currencies never adds up into one number — there is no FX
 * source in this app, so a $12 charge must not silently become ₪12. Totals are
 * grouped per currency and rendered separately.
 *
 * Originally written for family aggregates (where several members may earn in
 * different currencies); personal totals need exactly the same discipline once
 * a single expense can carry its own currency.
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
  opts: { sign?: '+' | '-'; fallback: Currency },
): string {
  const sign = opts.sign ?? '';
  if (totals.length === 0) return `${formatAmount(0, opts.fallback)}`;
  return totals
    .map((g) => `${g.total > 0 ? sign : ''}${formatAmount(g.total, g.currency)}`)
    .join(' · ');
}

/**
 * Splits totals into the account's own currency and everything else, so a
 * screen can show one headline number and keep foreign amounts beside it
 * instead of folding them in.
 */
export function splitOwnCurrency(
  items: { amount: number; currency: Currency }[],
  own: Currency,
): { ownTotal: number; others: CurrencyTotal[] } {
  const totals = groupByCurrency(items);
  return {
    ownTotal: totals.find((t) => t.currency === own)?.total ?? 0,
    others: totals.filter((t) => t.currency !== own),
  };
}
