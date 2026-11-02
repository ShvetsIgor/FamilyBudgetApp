/**
 * The month's category list silently stopped at eight rows, and analytics'
 * «total» summed only its top six. A breakdown must add up to what it breaks down.
 */
import { describe, expect, it } from 'vitest';
import { aggregateTopCategories, pieSlices } from '@/features/categories/utils/statsAggregation';
import type { Category } from '@/shared/types';

const cats = Array.from({ length: 11 }, (_, i) => ({
  id: `c${i}`, userId: 'u', name: `Cat ${i}`, icon: 'box', color: '#111', type: 'expense', isPrivate: false, order: i,
})) as Category[];
const byCategory = Object.fromEntries(cats.map((c, i) => [c.id, (i + 1) * 10]));
const total = Object.values(byCategory).reduce((s, v) => s + v, 0);

describe('aggregateTopCategories', () => {
  it('returns every category by default, largest first, adding up to the total', () => {
    const rows = aggregateTopCategories([{ byCategory }], cats);
    expect(rows).toHaveLength(11);
    expect(rows[0].catId).toBe('c10');
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(total);
  });

  it('still cuts to a limit when something is labelled as a top', () => {
    expect(aggregateTopCategories([{ byCategory }], cats, 6).map((r) => r.catId)).toEqual(['c10', 'c9', 'c8', 'c7', 'c6', 'c5']);
  });

  it('sums a category across months and drops empty ones', () => {
    const rows = aggregateTopCategories([{ byCategory: { c0: 5, c1: 0 } }, { byCategory: { c0: 7 } }], cats);
    expect(rows.map((r) => [r.catId, r.total])).toEqual([['c0', 12]]);
  });
});

describe('pieSlices', () => {
  const rows = [50, 40, 30, 20, 10].map((amount, i) => ({ id: String(i), amount }));
  const rest = (amount: number) => ({ id: 'rest', amount });

  it('keeps every row when they fit', () => {
    expect(pieSlices(rows, 5, rest)).toBe(rows);
  });

  it('folds the smallest rows into one slice, preserving the total', () => {
    const slices = pieSlices(rows, 3, rest);
    expect(slices.map((s) => s.id)).toEqual(['0', '1', 'rest']);
    expect(slices[2].amount).toBe(60);
    expect(slices.reduce((s, r) => s + r.amount, 0)).toBe(150);
  });
});
