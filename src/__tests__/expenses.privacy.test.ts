/**
 * №9: an expense in a private category must be owner-only ('secret'), so the
 * "hidden from family" promise is real — not just a hidden category name.
 */
import { describe, it, expect } from 'vitest';
import { resolveExpensePrivacy, isCategoryPrivate } from '@/features/expenses/utils/expensePrivacy';
import type { Category } from '@/shared/types';

const cat = (id: string, isPrivate: boolean): Category => ({
  id, userId: 'u1', name: id, icon: 'box', color: '#000', type: 'expense',
  order: 0, isPrivate,
});

const cats = [cat('open', false), cat('priv', true), cat('open2', false)];

describe('isCategoryPrivate', () => {
  it('true only when isPrivate', () => {
    expect(isCategoryPrivate(cat('priv', true))).toBe(true);
    expect(isCategoryPrivate(cat('open', false))).toBe(false);
    expect(isCategoryPrivate(undefined)).toBe(false);
  });
});

describe('resolveExpensePrivacy', () => {
  it('regular category → regular', () => {
    expect(resolveExpensePrivacy({ categories: cats, categoryId: 'open' })).toBe('regular');
  });

  it('private main category → secret', () => {
    expect(resolveExpensePrivacy({ categories: cats, categoryId: 'priv' })).toBe('secret');
  });

  it('any private split category → secret even if main is public', () => {
    expect(resolveExpensePrivacy({
      categories: cats, categoryId: 'open', splitCategoryIds: ['open2', 'priv'],
    })).toBe('secret');
  });

  it('never downgrades an existing secret on edit', () => {
    expect(resolveExpensePrivacy({
      categories: cats, categoryId: 'open', previousPrivacy: 'secret',
    })).toBe('secret');
  });

  it('edit moving INTO a private category becomes secret', () => {
    expect(resolveExpensePrivacy({
      categories: cats, categoryId: 'priv', previousPrivacy: 'regular',
    })).toBe('secret');
  });

  it('unknown category id → regular (no crash)', () => {
    expect(resolveExpensePrivacy({ categories: cats, categoryId: 'ghost' })).toBe('regular');
  });
});
