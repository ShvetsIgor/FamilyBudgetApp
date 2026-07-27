/**
 * Picking a recurring kind implies its category, so the form does not ask
 * twice. The implied targets must be real preset categories sitting in their
 * real preset folder — otherwise materializing one on save would create an
 * orphan the pickers can never resolve.
 */
import { describe, it, expect } from 'vitest';
import { RECURRING_TYPE_CATEGORY, impliedCategoryFor } from '@/features/recurring/utils/typeCategory';
import { CATEGORY_BLUEPRINTS, FOLDER_BLUEPRINTS } from '@/features/categories/preset/categoryPresets';
import type { RecurringType } from '@/shared/types';

const ALL_TYPES: RecurringType[] = [
  'subscription', 'rent', 'utility', 'credit', 'mortgage', 'installment', 'custom',
];

describe('recurring kind → implied category', () => {
  it('covers every kind explicitly', () => {
    for (const type of ALL_TYPES) {
      expect(Object.prototype.hasOwnProperty.call(RECURRING_TYPE_CATEGORY, type)).toBe(true);
    }
  });

  it('points every mapping at an existing preset category in the stated folder', () => {
    for (const [type, implied] of Object.entries(RECURRING_TYPE_CATEGORY)) {
      if (!implied) continue;
      const blueprint = CATEGORY_BLUEPRINTS.find((c) => c.id === implied.categoryId);
      expect(blueprint, `${type} → ${implied.categoryId}`).toBeDefined();
      expect(blueprint!.folderId).toBe(implied.folderId);
      expect(FOLDER_BLUEPRINTS.some((f) => f.id === implied.folderId)).toBe(true);
    }
  });

  it('keeps rent, utilities and mortgage in their semantic home folder', () => {
    expect(impliedCategoryFor('rent')).toEqual({ categoryId: 'rent', folderId: 'home' });
    expect(impliedCategoryFor('utility')).toEqual({ categoryId: 'utilities', folderId: 'home' });
    expect(impliedCategoryFor('mortgage')).toEqual({ categoryId: 'mortgage', folderId: 'home' });
  });

  it('leaves the user-labelled kind unmapped, so the form still asks', () => {
    expect(impliedCategoryFor('custom')).toBeNull();
  });

  it('never routes a kind into a folder named after the mechanism', () => {
    const folderIds = Object.values(RECURRING_TYPE_CATEGORY)
      .filter(Boolean)
      .map((implied) => implied!.folderId);
    expect(folderIds).not.toContain('recurring');
  });
});
