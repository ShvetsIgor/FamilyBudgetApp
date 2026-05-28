import { describe, expect, it } from 'vitest';
import type { Category, CategoryFolder, SerializableExpense } from '@/shared/types';
import {
  getExpenseListMeta,
  hasMeaningfulSplit,
  matchesExpenseListFilter,
} from '@/features/expenses/utils/expensePresentation';

const folders: CategoryFolder[] = [
  {
    id: 'food',
    userId: 'u1',
    name: 'Supermarket',
    icon: 'cart',
    color: '#E07A5F',
    type: 'expense',
    order: 0,
  },
  {
    id: 'home',
    userId: 'u1',
    name: 'Home',
    icon: 'house',
    color: '#81B29A',
    type: 'expense',
    order: 1,
  },
];

const categories: Category[] = [
  {
    id: 'alcohol',
    userId: 'u1',
    name: 'Alcohol',
    icon: 'wine',
    color: '#E07A5F',
    folderId: 'food',
    isPrivate: false,
    order: 0,
    type: 'expense',
  },
  {
    id: 'household',
    userId: 'u1',
    name: 'Household',
    icon: 'spray',
    color: '#81B29A',
    folderId: 'home',
    isPrivate: false,
    order: 1,
    type: 'expense',
  },
];

function makeExpense(overrides: Partial<SerializableExpense> = {}): SerializableExpense {
  return {
    id: 'e1',
    userId: 'u1',
    amount: 250,
    currency: 'ILS',
    categoryId: 'alcohol',
    date: '2026-05-27T12:00:00.000Z',
    paymentMethod: 'card',
    store: 'Даббах',
    storeId: 'dabbah',
    storeGroup: 'supermarket',
    tags: [],
    privacy: 'regular',
    splits: [
      { categoryId: 'alcohol', amount: 100 },
      { categoryId: 'household', amount: 150 },
    ],
    isRecurring: false,
    createdAt: '2026-05-27T12:00:00.000Z',
    updatedAt: '2026-05-27T12:00:00.000Z',
    ...overrides,
  };
}

describe('expensePresentation', () => {
  it('treats split expenses with storeGroup as store-context entries', () => {
    const meta = getExpenseListMeta(makeExpense(), categories, folders);

    expect(meta).toMatchObject({
      key: 'store-group:supermarket',
      labelSource: 'Supermarket',
      icon: 'cart',
      color: '#E07A5F',
      kind: 'storeGroup',
    });
  });

  it('falls back to preset store-group label when folders are not loaded', () => {
    const meta = getExpenseListMeta(makeExpense(), categories, []);

    expect(meta?.labelSource).toBe('Supermarket');
    expect(meta?.kind).toBe('storeGroup');
  });

  it('uses the requested language for preset store-group fallback labels', () => {
    const meta = getExpenseListMeta(makeExpense(), categories, [], 'ru');

    expect(meta?.labelSource).toBe('Супермаркет');
    expect(meta?.kind).toBe('storeGroup');
  });

  it('keeps regular expenses category-based', () => {
    const meta = getExpenseListMeta(
      makeExpense({
        splits: [],
        storeGroup: undefined,
      }),
      categories,
      folders,
    );

    expect(meta).toMatchObject({
      key: 'category:alcohol',
      labelSource: 'Alcohol',
      icon: 'wine',
      color: '#E07A5F',
      kind: 'category',
    });
  });

  it('uses the folder label for split expenses without a storeGroup', () => {
    const meta = getExpenseListMeta(
      makeExpense({ storeGroup: undefined }),
      categories,
      folders,
    );

    expect(meta).toMatchObject({
      key: 'category:alcohol',
      labelSource: 'Supermarket',
      icon: 'cart',
      color: '#E07A5F',
      kind: 'storeGroup',
    });
  });

  it('returns null when category is not found', () => {
    const meta = getExpenseListMeta(
      makeExpense({ splits: [], storeGroup: undefined, categoryId: 'nonexistent' }),
      categories,
      folders,
    );
    expect(meta).toBeNull();
  });

  it('matches store-group filters only for real split expenses', () => {
    const splitExpense = makeExpense();
    const regularExpense = makeExpense({
      splits: [],
      storeGroup: 'supermarket',
    });

    expect(hasMeaningfulSplit(splitExpense)).toBe(true);
    expect(hasMeaningfulSplit(regularExpense)).toBe(false);
    expect(matchesExpenseListFilter(splitExpense, 'store-group:supermarket')).toBe(true);
    expect(matchesExpenseListFilter(regularExpense, 'store-group:supermarket')).toBe(false);
  });
});
