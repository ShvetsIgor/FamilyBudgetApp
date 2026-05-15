import { describe, it, expect } from 'vitest';
import { getCurrencySymbol, formatAmount } from '@/shared/utils/currency';

describe('getCurrencySymbol', () => {
  it('returns correct symbols', () => {
    expect(getCurrencySymbol('ILS')).toBe('₪');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('RUB')).toBe('₽');
  });

  it('falls back to currency code for unknown currency', () => {
    expect(getCurrencySymbol('XYZ' as never)).toBe('XYZ');
  });
});

describe('formatAmount', () => {
  it('formats zero', () => {
    const result = formatAmount(0, 'USD');
    expect(result).toContain('0');
  });

  it('formats whole numbers without decimals', () => {
    const result = formatAmount(1000, 'USD');
    expect(result).toContain('1');
    expect(result).not.toContain('undefined');
  });

  it('formats fractional amounts', () => {
    const result = formatAmount(99.5, 'ILS');
    expect(result).toContain('99');
  });

  it('includes currency symbol', () => {
    const result = formatAmount(100, 'USD');
    expect(result).toContain('$');
  });
});
