/**
 * Re-export of the shared currency-total helpers.
 *
 * These started here, for family aggregates. Personal totals need exactly the
 * same rule once a single expense can carry its own currency (a $12 charge must
 * never become ₪12), so the logic moved to `shared/utils/currencyTotals`; this
 * module stays as the family-facing name already used across those screens.
 */
export {
  groupByCurrency,
  primaryCurrency,
  distinctCurrencies,
  formatCurrencyTotals,
  splitOwnCurrency,
  type CurrencyTotal,
} from '@/shared/utils/currencyTotals';
