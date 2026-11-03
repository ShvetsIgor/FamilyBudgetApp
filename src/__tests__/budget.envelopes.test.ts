/**
 * /budget category envelopes: month spend vs per-category limits.
 * Split rows count toward their own categories, remainder toward the main
 * one; limits that resolve to no known category are hidden.
 */
import { describe, it, expect } from 'vitest';
import { buildEnvelopes, spentByCategory } from '@/features/budget/utils/envelopes';
import type { Category, Currency } from '@/shared/types';

const MONTH = '2026-07';

const cat = (id: string, name: string): Category => ({
  id, name, userId: 'u1', icon: 'cart', color: '#E07A5F',
  isPrivate: false, order: 0, type: 'expense',
});

const exp = (
  amount: number,
  categoryId: string,
  date = '2026-07-10T12:00:00.000Z',
  splits: { categoryId: string; amount: number }[] = [],
  currency: Currency = 'ILS',
) => ({ amount, categoryId, date, splits, currency });

const categories = [cat('groceries', 'Groceries'), cat('coffee', 'Coffee')];

describe('buildEnvelopes', () => {
  it('sums month expenses per category and ignores other months', () => {
    const out = buildEnvelopes(
      [exp(100, 'groceries'), exp(50, 'groceries'), exp(999, 'groceries', '2026-06-10T12:00:00.000Z')],
      { groceries: 500 },
      categories,
      MONTH,
      'ILS',
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ catId: 'groceries', spent: 150, limit: 500, name: 'Groceries' });
  });

  it('counts split rows toward their categories and the remainder toward the main one', () => {
    const out = buildEnvelopes(
      [exp(100, 'groceries', undefined, [{ categoryId: 'coffee', amount: 30 }])],
      { groceries: 500, coffee: 100 },
      categories,
      MONTH,
      'ILS',
    );
    const byId = Object.fromEntries(out.map((e) => [e.catId, e.spent]));
    expect(byId).toEqual({ coffee: 30, groceries: 70 });
  });

  it('does not count a foreign charge against a limit set in the account currency', () => {
    const out = buildEnvelopes(
      [exp(100, 'coffee'), exp(12, 'coffee', undefined, [], 'USD')],
      { coffee: 200 },
      categories,
      MONTH,
      'ILS',
    );
    expect(out[0].spent).toBe(100);
  });

  it('hides limits that resolve to no known category', () => {
    const out = buildEnvelopes(
      [exp(40, 'coffee')],
      { coffee: 100, deletedCat: 300, food: 2000 },
      categories,
      MONTH,
      'ILS',
    );
    expect(out.map((e) => e.catId)).toEqual(['coffee']);
  });

  it('shows a zero-spend envelope for a category with a limit but no expenses', () => {
    const out = buildEnvelopes([], { coffee: 100 }, categories, MONTH, 'ILS');
    expect(out[0]).toMatchObject({ catId: 'coffee', spent: 0, limit: 100 });
  });

  it('sorts by fill ratio, most consumed first', () => {
    const out = buildEnvelopes(
      [exp(90, 'coffee'), exp(100, 'groceries')],
      { coffee: 100, groceries: 500 },
      categories,
      MONTH,
      'ILS',
    );
    expect(out.map((e) => e.catId)).toEqual(['coffee', 'groceries']);
  });
});

describe('spentByCategory', () => {
  it('ignores a rounding remainder and adds up to the receipt', () => {
    const out = spentByCategory([exp(100, 'groceries', undefined, [
      { categoryId: 'coffee', amount: 60 },
      { categoryId: 'groceries', amount: 40 },
    ])]);
    expect(out).toEqual({ coffee: 60, groceries: 40 });
  });
});
