import { describe, it, expect } from 'vitest';
import { legacyCategoryMap } from '@/features/categories/services/defaultCategories';
import {
  selectFolders,
  selectCategoriesInFolder,
  selectUnfolderedCategories,
  selectAllActiveCategories,
} from '@/features/categories/store/selectors';
import type { RootState } from '@/store/store';
import type { Category, CategoryFolder } from '@/shared/types';

// ── legacyCategoryMap ─────────────────────────────────────────────────────────

describe('legacyCategoryMap', () => {
  it('maps food → groceries', () => {
    expect(legacyCategoryMap['food']).toBe('groceries');
  });

  it('maps home → household', () => {
    expect(legacyCategoryMap['home']).toBe('household');
  });

  it('maps transport → public_transport', () => {
    expect(legacyCategoryMap['transport']).toBe('public_transport');
  });

  it('maps entertainment → movies', () => {
    expect(legacyCategoryMap['entertainment']).toBe('movies');
  });

  it('maps shopping → clothing', () => {
    expect(legacyCategoryMap['shopping']).toBe('clothing');
  });

  it('maps health → pharmacy', () => {
    expect(legacyCategoryMap['health']).toBe('pharmacy');
  });

  it('maps income → salary', () => {
    expect(legacyCategoryMap['income']).toBe('salary');
  });

  it('all mapped values are non-empty strings', () => {
    for (const [, value] of Object.entries(legacyCategoryMap)) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('covers at least 10 legacy IDs', () => {
    expect(Object.keys(legacyCategoryMap).length).toBeGreaterThanOrEqual(10);
  });
});

// ── Selector helpers ──────────────────────────────────────────────────────────

function makePartialState(
  expenseCats: Category[],
  incomeCats: Category[] = [],
  expenseFolders: CategoryFolder[] = [],
  incomeFolders: CategoryFolder[] = [],
): RootState {
  return {
    categories: {
      expense: expenseCats,
      income: incomeCats,
      folders: { expense: expenseFolders, income: incomeFolders },
      status: 'ready',
      error: null,
    },
  } as unknown as RootState;
}

function makeCategory(id: string, overrides: Partial<Category> = {}): Category {
  return {
    id, userId: 'u1', name: id, icon: 'box', color: '#E07A5F',
    type: 'expense', isPrivate: false, order: 0, ...overrides,
  };
}

function makeFolder(id: string, overrides: Partial<CategoryFolder> = {}): CategoryFolder {
  return { id, userId: 'u1', name: id, type: 'expense', order: 0, ...overrides };
}

// ── selectFolders ─────────────────────────────────────────────────────────────

describe('selectFolders', () => {
  it('returns expense folders', () => {
    const folder = makeFolder('f1');
    const state = makePartialState([], [], [folder]);
    expect(selectFolders(state, 'expense')).toHaveLength(1);
    expect(selectFolders(state, 'expense')[0].id).toBe('f1');
  });

  it('returns income folders', () => {
    const folder = makeFolder('f1', { type: 'income' });
    const state = makePartialState([], [], [], [folder]);
    expect(selectFolders(state, 'income')).toHaveLength(1);
    expect(selectFolders(state, 'expense')).toHaveLength(0);
  });

  it('returns empty array when no folders', () => {
    const state = makePartialState([]);
    expect(selectFolders(state, 'expense')).toHaveLength(0);
  });
});

// ── selectCategoriesInFolder ──────────────────────────────────────────────────

describe('selectCategoriesInFolder', () => {
  it('returns only categories with matching folderId', () => {
    const c1 = makeCategory('c1', { folderId: 'food' });
    const c2 = makeCategory('c2', { folderId: 'food' });
    const c3 = makeCategory('c3', { folderId: 'transport' });
    const state = makePartialState([c1, c2, c3]);
    const result = selectCategoriesInFolder(state, 'food', 'expense');
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(expect.arrayContaining(['c1', 'c2']));
  });

  it('excludes archived categories', () => {
    const c1 = makeCategory('c1', { folderId: 'food' });
    const c2 = makeCategory('c2', { folderId: 'food', archived: true });
    const state = makePartialState([c1, c2]);
    expect(selectCategoriesInFolder(state, 'food', 'expense')).toHaveLength(1);
  });

  it('returns empty array for unknown folderId', () => {
    const c1 = makeCategory('c1', { folderId: 'food' });
    const state = makePartialState([c1]);
    expect(selectCategoriesInFolder(state, 'unknown', 'expense')).toHaveLength(0);
  });
});

// ── selectUnfolderedCategories ────────────────────────────────────────────────

describe('selectUnfolderedCategories', () => {
  it('returns active categories without folderId', () => {
    const c1 = makeCategory('c1');
    const c2 = makeCategory('c2', { folderId: 'food' });
    const state = makePartialState([c1, c2]);
    const result = selectUnfolderedCategories(state, 'expense');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c1');
  });

  it('excludes archived categories', () => {
    const c1 = makeCategory('c1');
    const c2 = makeCategory('c2', { archived: true });
    const state = makePartialState([c1, c2]);
    expect(selectUnfolderedCategories(state, 'expense')).toHaveLength(1);
  });
});

// ── selectAllActiveCategories ─────────────────────────────────────────────────

describe('selectAllActiveCategories', () => {
  it('returns all non-archived categories', () => {
    const c1 = makeCategory('c1');
    const c2 = makeCategory('c2', { archived: true });
    const c3 = makeCategory('c3', { folderId: 'food' });
    const state = makePartialState([c1, c2, c3]);
    const result = selectAllActiveCategories(state, 'expense');
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(expect.arrayContaining(['c1', 'c3']));
  });
});
