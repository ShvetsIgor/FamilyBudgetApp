import { describe, it, expect } from 'vitest';
import { calculateSplit } from '@/features/expenses/utils/splitAlgorithm';

describe('calculateSplit', () => {
  it('returns full amount as remainder when no splits', () => {
    const result = calculateSplit(100, []);
    expect(result.remainder).toBe(100);
    expect(result.splitTotal).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it('correctly sums splits', () => {
    const splits = [
      { categoryId: 'a', amount: 30 },
      { categoryId: 'b', amount: 20 },
    ];
    const result = calculateSplit(100, splits);
    expect(result.splitTotal).toBe(50);
    expect(result.remainder).toBe(50);
    expect(result.isValid).toBe(true);
  });

  it('remainder is zero when splits equal total', () => {
    const splits = [{ categoryId: 'a', amount: 100 }];
    const result = calculateSplit(100, splits);
    expect(result.remainder).toBe(0);
    expect(result.isValid).toBe(true);
  });

  it('marks invalid when splits exceed total', () => {
    const splits = [{ categoryId: 'a', amount: 150 }];
    const result = calculateSplit(100, splits);
    expect(result.remainder).toBe(-50);
    expect(result.isValid).toBe(false);
  });

  it('handles decimal amounts', () => {
    const splits = [{ categoryId: 'a', amount: 33.33 }];
    const result = calculateSplit(100, splits);
    expect(result.remainder).toBeCloseTo(66.67);
  });
});
