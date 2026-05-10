import type { Currency } from '@/shared/types';

const CURRENCY_SYMBOLS: Record<Currency, string> = {
  ILS: '₪',
  USD: '$',
  CAD: 'CA$',
  RUB: '₽',
};

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_SYMBOLS[currency];
}

// Parses a 'yyyy-MM-dd' string as local midnight (not UTC)
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function blockInvalidAmountKeys(e: React.KeyboardEvent) {
  if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
}

export function formatAmount(amount: number, currency: Currency): string {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
