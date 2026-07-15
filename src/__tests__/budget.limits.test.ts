/**
 * budgets/{uid} limits cleanup: remap after category reset, prune of
 * orphaned entries (deleted custom categories, folder-keyed legacy limits).
 */
import { describe, it, expect } from 'vitest';
import { remapLimits } from '@/features/budget/utils/limits';
import { PRESET_EXPENSE_CATEGORY_IDS } from '@/features/categories/services/defaultCategories';

const keep = new Set(['groceries', 'coffee', 'fuel']);

describe('remapLimits', () => {
  it('remaps old ids to new ids', () => {
    const out = remapLimits({ oldA: 500 }, { oldA: 'groceries' }, keep);
    expect(out).toEqual({ groceries: 500 });
  });

  it('keeps unmapped ids that are still valid', () => {
    const out = remapLimits({ coffee: 200 }, {}, keep);
    expect(out).toEqual({ coffee: 200 });
  });

  it('drops ids that resolve to nothing (deleted custom categories, folder ids)', () => {
    const out = remapLimits(
      { randomFirestoreId: 300, food: 2000, coffee: 150 },
      {},
      keep,
    );
    expect(out).toEqual({ coffee: 150 });
  });

  it('drops ids whose remap target is not kept', () => {
    const out = remapLimits({ oldA: 300 }, { oldA: 'goneToo' }, keep);
    expect(out).toEqual({});
  });

  it('takes the larger limit when two ids remap onto one', () => {
    const out = remapLimits(
      { oldA: 300, oldB: 700 },
      { oldA: 'groceries', oldB: 'groceries' },
      keep,
    );
    expect(out).toEqual({ groceries: 700 });
  });

  it('drops non-positive limits', () => {
    const out = remapLimits({ groceries: 0, coffee: -5, fuel: 100 }, {}, keep);
    expect(out).toEqual({ fuel: 100 });
  });
});

describe('PRESET_EXPENSE_CATEGORY_IDS', () => {
  it('contains blueprint expense ids and savings, but no folder or income ids', () => {
    expect(PRESET_EXPENSE_CATEGORY_IDS.has('groceries')).toBe(true);
    expect(PRESET_EXPENSE_CATEGORY_IDS.has('savings')).toBe(true);
    // folder ids are not category ids — folder-keyed limits must not survive
    expect(PRESET_EXPENSE_CATEGORY_IDS.has('food')).toBe(false);
    expect(PRESET_EXPENSE_CATEGORY_IDS.has('income')).toBe(false);
  });
});
