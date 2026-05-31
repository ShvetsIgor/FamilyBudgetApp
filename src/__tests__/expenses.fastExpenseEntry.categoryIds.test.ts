/**
 * Tests that FastExpenseEntry never uses folder IDs as expense/split categoryIds.
 *
 * The bug: useCategoryGroups returns CategoryGroup[] (folder view-models).
 * Previously the component treated those groups as selectable categories,
 * causing folder IDs like "food" to be saved as expense.categoryId.
 *
 * These tests verify the pure initialization helpers and the save-guard invariant.
 */

import { describe, it, expect } from 'vitest';
import { isActiveCategory } from '@/features/categories/policy/categoryPolicy';
import type { Category, CategoryFolder } from '@/shared/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const folders: CategoryFolder[] = [
  { id: 'food', userId: 'user-1', name: 'Food', icon: 'food', color: '#F59E0B', type: 'expense', order: 0 },
  { id: 'home', userId: 'user-1', name: 'Home', icon: 'home', color: '#6366F1', type: 'expense', order: 1 },
];

const categories: Category[] = [
  { id: 'groceries', userId: 'user-1', name: 'Groceries', icon: 'cart', color: '#F59E0B', type: 'expense', order: 0, folderId: 'food', isPrivate: false },
  { id: 'cafe', userId: 'user-1', name: 'Cafe', icon: 'coffee', color: '#FBBF24', type: 'expense', order: 1, folderId: 'food', isPrivate: false },
  { id: 'tools', userId: 'user-1', name: 'Tools', icon: 'hammer', color: '#6366F1', type: 'expense', order: 2, folderId: 'home', isPrivate: false },
  { id: 'repairs', userId: 'user-1', name: 'Repairs', icon: 'wrench', color: '#8B5CF6', type: 'expense', order: 3, folderId: 'home', isPrivate: false },
  { id: 'savings', userId: 'user-1', name: 'Savings', icon: 'piggy', color: '#10B981', type: 'expense', order: 99, isPrivate: false },
];

const folderIds = new Set(folders.map((f) => f.id));

// Mirrors the activeExpCats derivation from FastExpenseEntry
function getActiveExpCats(allCats: Category[]) {
  return allCats.filter((c) => !c.archived && c.name !== 'Savings');
}

// Mirrors initSelectedCatId logic for a new expense (no initialExpense, no merchant)
function initSelectedCatId(activeExpCats: Category[]): string {
  return activeExpCats[0]?.id ?? '';
}

// Mirrors initSelectedCatId for edit mode
function initSelectedCatIdEdit(
  initialCategoryId: string,
  allCats: Category[],
  activeExpCats: Category[],
): string {
  const cat = allCats.find((c) => c.id === initialCategoryId);
  if (cat && !cat.archived) return cat.id;
  return activeExpCats[0]?.id ?? '';
}

// Mirrors the save guard in handleSave
function getEffectiveCatId(selectedCatId: string, activeExpCats: Category[]): string {
  return activeExpCats.some((c) => c.id === selectedCatId)
    ? selectedCatId
    : activeExpCats[0]?.id ?? '';
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('FastExpenseEntry — category IDs must never be folder IDs', () => {
  it('activeExpCats contains real categories, not folders', () => {
    const activeExpCats = getActiveExpCats(categories);
    for (const cat of activeExpCats) {
      expect(folderIds.has(cat.id)).toBe(false);
    }
  });

  it('activeExpCats excludes Savings category', () => {
    const activeExpCats = getActiveExpCats(categories);
    expect(activeExpCats.find((c) => c.name === 'Savings')).toBeUndefined();
  });

  it('initSelectedCatId returns a real category id, not a folder id', () => {
    const activeExpCats = getActiveExpCats(categories);
    const id = initSelectedCatId(activeExpCats);
    expect(id).not.toBe('');
    expect(folderIds.has(id)).toBe(false);
    // Must be a real category
    expect(categories.find((c) => c.id === id)).toBeDefined();
  });

  it('initSelectedCatId in edit mode preserves existing real category id', () => {
    const activeExpCats = getActiveExpCats(categories);
    const id = initSelectedCatIdEdit('tools', categories, activeExpCats);
    expect(id).toBe('tools');
    expect(folderIds.has(id)).toBe(false);
  });

  it('initSelectedCatId in edit mode falls back when existing category is archived', () => {
    const archived = categories.map((c) =>
      c.id === 'tools' ? { ...c, archived: true } : c,
    );
    const activeExpCats = getActiveExpCats(archived);
    const id = initSelectedCatIdEdit('tools', archived, activeExpCats);
    expect(folderIds.has(id)).toBe(false);
    expect(id).not.toBe('tools'); // archived — should not be returned
    expect(activeExpCats.find((c) => c.id === id)).toBeDefined();
  });

  it('save guard blocks folder id from being saved as categoryId', () => {
    const activeExpCats = getActiveExpCats(categories);
    // Simulate scenario where selectedCatId is a folder id (old bug)
    const effective = getEffectiveCatId('food', activeExpCats);
    expect(folderIds.has(effective)).toBe(false);
    expect(activeExpCats.find((c) => c.id === effective)).toBeDefined();
  });

  it('save guard preserves valid real category id', () => {
    const activeExpCats = getActiveExpCats(categories);
    const effective = getEffectiveCatId('groceries', activeExpCats);
    expect(effective).toBe('groceries');
  });

  it('split categoryIds must be real category ids', () => {
    // Simulate split items that came from the picker (second level)
    const splitCategoryIds = ['groceries', 'tools'];
    const activeExpCats = getActiveExpCats(categories);
    for (const catId of splitCategoryIds) {
      expect(folderIds.has(catId)).toBe(false);
      expect(activeExpCats.find((c) => c.id === catId)).toBeDefined();
    }
  });

  it('save guard filters out splits with folder ids', () => {
    const activeExpCats = getActiveExpCats(categories);
    // Simulate hypothetical invalid splits (folder id slipped through)
    const rawSplits = [
      { categoryId: 'groceries', amount: 100 },
      { categoryId: 'food', amount: 50 }, // folder ID — should be dropped
    ];
    const validSplits = rawSplits.filter((sp) =>
      activeExpCats.some((c) => c.id === sp.categoryId),
    );
    expect(validSplits).toHaveLength(1);
    expect(validSplits[0].categoryId).toBe('groceries');
  });

  it('isActiveCategory policy does not count folders as active categories', () => {
    // Folders are not Category objects — they never pass the isActiveCategory gate
    // Verify that archived categories are excluded
    const archived: Category = { ...categories[0], archived: true };
    expect(isActiveCategory(archived)).toBe(false);
    expect(isActiveCategory(categories[0])).toBe(true);
  });

  it('getCatsInGroup returns real categories for a folder id, not the folder itself', () => {
    // Simulate getCatsInGroup logic (filtering by folderId)
    const catsInFood = categories.filter(
      (c) => c.folderId === 'food' && isActiveCategory(c),
    );
    for (const cat of catsInFood) {
      expect(folderIds.has(cat.id)).toBe(false);
    }
    expect(catsInFood.map((c) => c.id)).toEqual(expect.arrayContaining(['groceries', 'cafe']));
  });
});
