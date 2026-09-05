import { describe, expect, it } from 'vitest';
import { statsPatchShape } from '@/features/expenses/services/expensesService';

const ILS = 'ILS' as const;

describe('statsPatchShape', () => {
  it('writes both halves for an ordinary new expense', () => {
    expect(statsPatchShape({ currency: ILS, totalExpenses: 120, byCategory: { groceries: 120 } }))
      .toEqual({ writesTotals: true, writesCategories: true });
  });

  it('writes the category maps for a category-only move', () => {
    // Same amount, same month, same currency — only the category changed.
    // This used to update `byCategory` and skip `byCategoryByCurrency`, so the
    // two maps disagreed for that month from then on.
    expect(statsPatchShape({
      currency: ILS,
      totalExpenses: 0,
      byCategory: { groceries: -120, bakery: 120 },
    })).toEqual({ writesTotals: false, writesCategories: true });
  });

  it('writes nothing for a metadata-only edit', () => {
    expect(statsPatchShape({ currency: ILS, totalExpenses: 0, byCategory: {} }))
      .toEqual({ writesTotals: false, writesCategories: false });
  });

  it('treats an all-zero category map as no category movement', () => {
    expect(statsPatchShape({ currency: ILS, totalExpenses: 0, byCategory: { groceries: 0 } }))
      .toEqual({ writesTotals: false, writesCategories: false });
  });

  it('writes the totals for a pure amount change that keeps the category', () => {
    expect(statsPatchShape({ currency: ILS, totalExpenses: 30, byCategory: { groceries: 30 } }))
      .toEqual({ writesTotals: true, writesCategories: true });
  });
});
