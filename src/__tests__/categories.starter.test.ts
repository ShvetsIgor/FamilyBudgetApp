/**
 * The chat's first-expense setup. A new account has no active expense
 * category, so the chat offers starter presets; activating them is an explicit
 * tap that writes every folder and category in ONE transaction under stable
 * preset ids, never duplicates what exists, never overwrites a document the
 * given lists missed, and brings archived presets back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, CategoryFolder } from '@/shared/types';

const m = vi.hoisted(() => ({
  batches: [] as { ops: { op: 'set' | 'update'; path: string; data: Record<string, unknown> }[]; committed: boolean }[],
  /** Documents that already exist in Firestore, by path. */
  docs: new Map<string, Record<string, unknown>>(),
  reads: [] as string[],
}));

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/'), id: parts.at(-1) }),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const batch = { ops: [] as (typeof m.batches)[number]['ops'], committed: false };
      m.batches.push(batch);
      let wrote = false;
      const tx = {
        get: async (ref: { path: string; id: string }) => {
          if (wrote) throw new Error('Firestore transactions require all reads before writes');
          m.reads.push(ref.path);
          const data = m.docs.get(ref.path);
          return { id: ref.id, exists: () => data !== undefined, data: () => data };
        },
        set: (ref: { path: string }, data: Record<string, unknown>) => { wrote = true; batch.ops.push({ op: 'set', path: ref.path, data }); },
        update: (ref: { path: string }, data: Record<string, unknown>) => { wrote = true; batch.ops.push({ op: 'update', path: ref.path, data }); },
      };
      const result = await fn(tx);
      batch.committed = true;
      return result;
    },
  };
});

import {
  STARTER_CATEGORY_IDS,
  activateStarterCategories,
  needsStarterCategories,
  starterOptions,
} from '@/features/categories/services/starterCategories';
import { CATEGORY_BLUEPRINTS } from '@/features/categories/preset/categoryPresets';

function cat(id: string, fields: Partial<Category> = {}): Category {
  return { id, userId: 'u1', name: id, icon: 'box', color: '#000', isPrivate: false, order: 0, type: 'expense', ...fields };
}

function folder(id: string, fields: Partial<CategoryFolder> = {}): CategoryFolder {
  return { id, userId: 'u1', name: id, type: 'expense', order: 0, ...fields };
}

beforeEach(() => { m.batches = []; m.docs = new Map(); m.reads = []; });

describe('needsStarterCategories', () => {
  it('treats an account with only the app-managed savings category as empty', () => {
    expect(needsStarterCategories([])).toBe(true);
    expect(needsStarterCategories([cat('savings', { name: 'Savings' })])).toBe(true);
  });

  it('also ignores the savings category created by the savings flow under a random id', () => {
    expect(needsStarterCategories([cat('Xk29fQr7', { name: 'Savings' })])).toBe(true);
    // A user category that merely contains the word is a real choice
    expect(needsStarterCategories([cat('Xk29fQr7', { name: 'Savings jar' })])).toBe(false);
  });

  it('ignores archived categories and counts any active one', () => {
    expect(needsStarterCategories([cat('coffee', { archived: true })])).toBe(true);
    expect(needsStarterCategories([cat('coffee', { archived: true }), cat('my-own')])).toBe(false);
  });

  it('ignores income categories', () => {
    expect(needsStarterCategories([cat('salary', { type: 'income' })])).toBe(true);
  });
});

describe('starter presets', () => {
  it('every default id is a real expense blueprint', () => {
    for (const id of STARTER_CATEGORY_IDS) {
      const preset = CATEGORY_BLUEPRINTS.find((entry) => entry.id === id);
      expect(preset, id).toBeDefined();
      expect(preset!.folderId).not.toBe('income');
    }
    expect(starterOptions('en')).toHaveLength(STARTER_CATEGORY_IDS.length);
  });

  it('names options in the active language', () => {
    expect(starterOptions('ru').find((o) => o.id === 'groceries')?.name).toBe('Продукты');
    expect(starterOptions('en').find((o) => o.id === 'groceries')?.name).toBe('Groceries');
  });
});

describe('activateStarterCategories', () => {
  it('writes preset folders and categories in one transaction under stable ids', async () => {
    const result = await activateStarterCategories({
      userId: 'u1', blueprintIds: ['groceries', 'coffee', 'restaurant'], language: 'ru',
      folders: [folder('mine', { order: 4 })], categories: [],
    });

    expect(m.batches).toHaveLength(1);
    expect(m.batches[0].committed).toBe(true);
    const sets = Object.fromEntries(m.batches[0].ops.map((op) => [op.path, op.data]));
    expect(Object.keys(sets).sort()).toEqual([
      'categories/u1/expense/coffee',
      'categories/u1/expense/groceries',
      'categories/u1/expense/restaurant',
      'categoryFolders/u1/expense/dining',
      'categoryFolders/u1/expense/food',
    ]);
    expect(sets['categoryFolders/u1/expense/food']).toMatchObject({ name: 'Супермаркет', type: 'expense', order: 5, userId: 'u1' });
    expect(sets['categoryFolders/u1/expense/dining']).toMatchObject({ name: 'Вне дома', order: 6 });
    expect(sets['categories/u1/expense/groceries']).toMatchObject({
      name: 'Продукты', folderId: 'food', isPrivate: false, type: 'expense', order: 0, userId: 'u1',
    });
    // Two categories in the same folder get consecutive orders
    expect([sets['categories/u1/expense/restaurant'].order, sets['categories/u1/expense/coffee'].order].sort()).toEqual([0, 1]);

    expect(result.folders.map((f) => f.id)).toEqual(['food', 'dining']);
    // Every target is read inside the transaction before anything is written
    expect(m.reads.sort()).toEqual([
      'categories/u1/expense/coffee', 'categories/u1/expense/groceries', 'categories/u1/expense/restaurant',
      'categoryFolders/u1/expense/dining', 'categoryFolders/u1/expense/food',
    ]);
    expect(result.created.map((c) => c.id)).toEqual(['groceries', 'coffee', 'restaurant']);
    expect(result.activeIds).toEqual(['groceries', 'coffee', 'restaurant']);
  });

  it('names entities in English for an English user', async () => {
    await activateStarterCategories({ userId: 'u1', blueprintIds: ['fuel'], language: 'en', folders: [], categories: [] });
    const sets = Object.fromEntries(m.batches[0].ops.map((op) => [op.path, op.data]));
    expect(sets['categoryFolders/u1/expense/car']).toMatchObject({ name: 'Car', order: 0 });
    expect(sets['categories/u1/expense/fuel']).toMatchObject({ name: 'Fuel', folderId: 'car' });
  });

  it('is idempotent: nothing is written when everything is already active', async () => {
    const result = await activateStarterCategories({
      userId: 'u1', blueprintIds: ['groceries', 'groceries'], language: 'en',
      folders: [folder('food')], categories: [cat('groceries', { folderId: 'food' })],
    });
    expect(m.batches).toEqual([]);
    expect(result).toEqual({
      folders: [], created: [], restored: [], adopted: { folders: [], categories: [] }, activeIds: ['groceries'],
    });
  });

  it('skips a preset whose name already exists as an active category or folder', async () => {
    const result = await activateStarterCategories({
      userId: 'u1', blueprintIds: ['coffee', 'groceries'], language: 'ru',
      folders: [folder('my-market', { name: 'супермаркет' })],
      categories: [cat('my-coffee', { name: 'Кофе' })],
    });
    const paths = m.batches[0].ops.map((op) => op.path);
    expect(paths).toEqual(['categories/u1/expense/groceries']);
    expect(m.batches[0].ops[0].data).toMatchObject({ folderId: 'my-market' });
    expect(result.activeIds).toEqual(['my-coffee', 'groceries']);
  });

  it('un-archives an archived preset instead of overwriting it', async () => {
    const archived = cat('coffee', { name: 'Мой кофе', archived: true, folderId: 'dining', usageCount: 7 });
    m.docs.set('categories/u1/expense/coffee', { ...archived, id: undefined });
    const result = await activateStarterCategories({
      userId: 'u1', blueprintIds: ['coffee'], language: 'ru', folders: [], categories: [archived],
    });
    const ops = m.batches[0].ops;
    expect(ops).toContainEqual({ op: 'set', path: 'categoryFolders/u1/expense/dining', data: expect.objectContaining({ name: 'Вне дома' }) });
    expect(ops).toContainEqual({ op: 'update', path: 'categories/u1/expense/coffee', data: { archived: false, folderId: 'dining' } });
    expect(ops.some((op) => op.op === 'set' && op.path === 'categories/u1/expense/coffee')).toBe(false);
    expect(result.restored).toEqual([{ ...archived, archived: false, folderId: 'dining' }]);
    expect(result.created).toEqual([]);
    expect(result.activeIds).toEqual(['coffee']);
  });

  it('keeps an un-archived category in its own surviving folder', async () => {
    m.docs.set('categories/u1/expense/coffee', { name: 'coffee', type: 'expense', archived: true, folderId: 'cafes' });
    await activateStarterCategories({
      userId: 'u1', blueprintIds: ['coffee'], language: 'en',
      folders: [folder('cafes')], categories: [cat('coffee', { archived: true, folderId: 'cafes' })],
    });
    expect(m.batches[0].ops).toEqual([
      { op: 'update', path: 'categories/u1/expense/coffee', data: { archived: false, folderId: 'cafes' } },
    ]);
  });

  it('ignores unknown and income blueprint ids', async () => {
    const result = await activateStarterCategories({
      userId: 'u1', blueprintIds: ['nope', 'salary'], language: 'en', folders: [], categories: [],
    });
    expect(m.batches).toEqual([]);
    expect(result.activeIds).toEqual([]);
  });

  it('never overwrites a renamed preset document that the given (stale) list missed', async () => {
    // Another device activated Groceries and renamed it after this list was read
    m.docs.set('categories/u1/expense/groceries', {
      name: 'Еда домой', icon: 'cart', color: '#123456', folderId: 'food', type: 'expense', order: 3, usageCount: 12, userId: 'u1',
    });
    m.docs.set('categoryFolders/u1/expense/food', { name: 'Магазины', type: 'expense', order: 0, userId: 'u1' });
    const result = await activateStarterCategories({
      userId: 'u1', blueprintIds: ['groceries', 'coffee'], language: 'ru', folders: [], categories: [],
    });

    const ops = m.batches[0].ops;
    expect(ops.some((op) => op.path === 'categories/u1/expense/groceries')).toBe(false);
    expect(ops.some((op) => op.path === 'categoryFolders/u1/expense/food')).toBe(false);
    expect(ops.map((op) => op.path).sort()).toEqual(['categories/u1/expense/coffee', 'categoryFolders/u1/expense/dining']);
    expect(result.adopted.categories).toEqual([expect.objectContaining({ id: 'groceries', name: 'Еда домой', usageCount: 12 })]);
    expect(result.adopted.folders).toEqual([expect.objectContaining({ id: 'food', name: 'Магазины' })]);
    expect(result.created.map((c) => c.id)).toEqual(['coffee']);
    expect(result.activeIds).toEqual(['groceries', 'coffee']);
  });

  it('only un-archives an archived document the given list missed, keeping its name', async () => {
    m.docs.set('categories/u1/expense/fuel', { name: 'Бензин мой', type: 'expense', archived: true, folderId: 'gone', userId: 'u1' });
    const result = await activateStarterCategories({
      userId: 'u1', blueprintIds: ['fuel'], language: 'ru', folders: [], categories: [],
    });
    expect(m.batches[0].ops).toEqual([
      { op: 'set', path: 'categoryFolders/u1/expense/car', data: expect.objectContaining({ name: 'Машина' }) },
      { op: 'update', path: 'categories/u1/expense/fuel', data: { archived: false, folderId: 'car' } },
    ]);
    expect(result.adopted.categories).toEqual([expect.objectContaining({ id: 'fuel', name: 'Бензин мой', archived: false })]);
  });
});
