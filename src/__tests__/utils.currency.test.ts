import { describe, it, expect } from 'vitest';
import { getCurrencySymbol, formatAmount } from '@/shared/utils/currency';

describe('getCurrencySymbol', () => {
  it('returns ₪ for ILS', () => expect(getCurrencySymbol('ILS')).toBe('₪'));
  it('returns $ for USD',  () => expect(getCurrencySymbol('USD')).toBe('$'));
  it('returns CA$ for CAD', () => expect(getCurrencySymbol('CAD')).toBe('CA$'));
  it('returns ₽ for RUB', () => expect(getCurrencySymbol('RUB')).toBe('₽'));
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
