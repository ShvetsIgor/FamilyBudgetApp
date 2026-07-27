/**
 * Payment kind and category are one choice. The «Recurring» preset folder holds
 * a category per kind, so tapping the kind in the form also files the money —
 * and, being ordinary library entries, those categories stay editable.
 */
import { describe, it, expect } from 'vitest';
import {
  RECURRING_TYPE_CATEGORY, impliedCategoryFor, typeForCategoryId,
} from '@/features/recurring/utils/typeCategory';
import { CATEGORY_BLUEPRINTS, FOLDER_BLUEPRINTS } from '@/features/categories/preset/categoryPresets';
import { PRESET_EXPENSE_CATEGORY_IDS } from '@/features/categories/services/defaultCategories';
import type { RecurringType } from '@/shared/types';

const ALL_TYPES: RecurringType[] = [
  'subscription', 'rent', 'utility', 'credit', 'mortgage', 'installment', 'custom',
];

describe('recurring kind → category', () => {
  it('maps every kind, including the user-labelled one', () => {
    for (const type of ALL_TYPES) {
      expect(impliedCategoryFor(type), type).not.toBeNull();
    }
  });

  it('points every mapping at a real preset category inside the Recurring folder', () => {
    expect(FOLDER_BLUEPRINTS.some((f) => f.id === 'recurring')).toBe(true);
    for (const [type, implied] of Object.entries(RECURRING_TYPE_CATEGORY)) {
      const blueprint = CATEGORY_BLUEPRINTS.find((c) => c.id === implied.categoryId);
      expect(blueprint, `${type} → ${implied.categoryId}`).toBeDefined();
      expect(blueprint!.folderId).toBe('recurring');
      expect(implied.folderId).toBe('recurring');
    }
  });

  it('gives each kind its own category, so the breakdown stays meaningful', () => {
    const ids = ALL_TYPES.map((t) => impliedCategoryFor(t)!.categoryId);
    expect(new Set(ids).size).toBe(ALL_TYPES.length);
  });

  it('survives a category reset — the ids are stable presets', () => {
    for (const type of ALL_TYPES) {
      expect(PRESET_EXPENSE_CATEGORY_IDS.has(impliedCategoryFor(type)!.categoryId), type).toBe(true);
    }
  });

  it('resolves a category back to its kind, so the right chip lights up', () => {
    expect(typeForCategoryId('rec_rent')).toBe('rent');
    expect(typeForCategoryId('rec_subscription')).toBe('subscription');
  });

  it('returns no kind for a category the user picked themselves', () => {
    expect(typeForCategoryId('groceries')).toBeNull();
  });

  it('drops the leaves that only served the previous semantic mapping', () => {
    for (const dead of ['sub_generic', 'credit_payment', 'installment_pay']) {
      expect(CATEGORY_BLUEPRINTS.some((c) => c.id === dead), dead).toBe(false);
    }
  });
});
