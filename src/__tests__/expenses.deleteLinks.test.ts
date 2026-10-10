/**
 * Deleting an expense rolls its links back in the same transaction. A goal
 * that belongs to another family member can stop being readable for us, and
 * Undo must re-apply exactly what the deletion removed — nothing found afresh.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { SerializableExpense } from '@/shared/types';

const m = vi.hoisted(() => ({
  docs: {} as Record<string, Record<string, unknown> | Error>,
  reads: [] as string[][],
  writes: [] as { op: 'set' | 'update' | 'delete'; path: string; data?: Record<string, unknown> }[],
}));

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/'), id: parts.at(-1) }),
    collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    query: (ref: unknown) => ref,
    where: () => null,
    getDocs: async () => ({ docs: [] }),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const reads: string[] = [];
      m.reads.push(reads);
      const pending: typeof m.writes = [];
      const tx = {
        get: async (ref: { path: string; id: string }) => {
          reads.push(ref.path);
          const value = m.docs[ref.path];
          if (value instanceof Error) throw value;
          return { id: ref.id, exists: () => value !== undefined, data: () => value };
        },
        set: (ref: { path: string }, data: Record<string, unknown>) => { pending.push({ op: 'set', path: ref.path, data }); },
        update: (ref: { path: string }, data: Record<string, unknown>) => { pending.push({ op: 'update', path: ref.path, data }); },
        delete: (ref: { path: string }) => { pending.push({ op: 'delete', path: ref.path }); },
      };
      const result = await fn(tx);
      m.writes.push(...pending); // a thrown attempt commits nothing
      return result;
    },
  };
});

import { deleteExpense, restoreExpense } from '@/features/expenses/services/expensesService';

const EXPENSE = 'expenses/bob/items/e1';
const FOREIGN_GOAL = 'savingsGoals/alice/goals/g1';
const OWN_GOAL = 'savingsGoals/bob/goals/g1';
const date = new Date(2026, 8, 10, 12);

function denied(code = 'permission-denied') {
  return Object.assign(new Error(code), { code });
}

function stored(fields: Record<string, unknown> = {}) {
  return {
    userId: 'bob', amount: 50, currency: 'ILS', categoryId: 'food', date: Timestamp.fromDate(date),
    paymentMethod: 'other', tags: ['savings'], privacy: 'regular', splits: [], isRecurring: false,
    goalId: 'g1', createdAt: Timestamp.fromDate(date), updatedAt: Timestamp.fromDate(date), ...fields,
  };
}

function serializable(fields: Partial<SerializableExpense> = {}): SerializableExpense {
  return {
    id: 'e1', userId: 'bob', amount: 50, currency: 'ILS', categoryId: 'food', date: date.toISOString(),
    paymentMethod: 'other', tags: ['savings'], privacy: 'regular', splits: [], isRecurring: false,
    goalId: 'g1', createdAt: date.toISOString(), updatedAt: date.toISOString(), ...fields,
  };
}

beforeEach(() => {
  m.docs = { 'categories/bob/expense/food': { name: 'Food' } };
  m.reads = [];
  m.writes = [];
});

describe('deleteExpense with a linked goal', () => {
  it('still deletes our expense when another member\'s goal is no longer readable', async () => {
    m.docs[EXPENSE] = stored({ goalOwnerId: 'alice', contributionId: 'c1' });
    m.docs[FOREIGN_GOAL] = denied();

    const deletion = await deleteExpense('bob', serializable({ goalOwnerId: 'alice', contributionId: 'c1' }));

    expect(m.reads).toHaveLength(2);
    expect(m.reads[1]).not.toContain(FOREIGN_GOAL);
    expect(deletion.expense?.id).toBe('e1');
    expect(deletion.links.contribution).toBeUndefined();
    expect(m.writes).toContainEqual({ op: 'delete', path: EXPENSE });
    expect(m.writes.some(w => w.path === FOREIGN_GOAL)).toBe(false);
  });

  it('does not retry past a denied read of our own goal', async () => {
    m.docs[EXPENSE] = stored({ contributionId: 'c1' });
    m.docs[OWN_GOAL] = denied();

    await expect(deleteExpense('bob', serializable({ contributionId: 'c1' }))).rejects.toThrow('permission-denied');
    expect(m.reads).toHaveLength(1);
    expect(m.writes).toEqual([]);
  });

  it('does not retry other failures on a foreign goal', async () => {
    m.docs[EXPENSE] = stored({ goalOwnerId: 'alice', contributionId: 'c1' });
    m.docs[FOREIGN_GOAL] = denied('unavailable');

    await expect(deleteExpense('bob', serializable({ goalOwnerId: 'alice', contributionId: 'c1' }))).rejects.toThrow('unavailable');
    expect(m.reads).toHaveLength(1);
    expect(m.writes).toEqual([]);
  });

  it('rolls back the linked contribution of a readable goal', async () => {
    m.docs[EXPENSE] = stored({ contributionId: 'c1' });
    m.docs[OWN_GOAL] = { currentAmount: 80, contributions: { c1: { amount: 50, date: date.toISOString(), byId: 'bob' } } };

    const deletion = await deleteExpense('bob', serializable({ contributionId: 'c1' }));

    expect(deletion.links.contribution).toMatchObject({ id: 'c1', amount: 50 });
    const goalUpdate = m.writes.find(w => w.path === OWN_GOAL);
    expect(goalUpdate?.data).toMatchObject({ currentAmount: 30, lastContributionId: 'c1' });
    expect(goalUpdate?.data).toHaveProperty(['contributions.c1']);
  });
});

describe('restoreExpense', () => {
  it('leaves the goal alone when the deletion removed no contribution', async () => {
    // A legacy entry of the same amount must not be mistaken for ours
    m.docs[OWN_GOAL] = { currentAmount: 50, contributions: [{ amount: 50, date: date.toISOString() }] };

    await restoreExpense('bob', { expense: serializable(), links: {}, recurring: null });

    expect(m.reads.flat()).not.toContain(OWN_GOAL);
    expect(m.writes.some(w => w.path === OWN_GOAL)).toBe(false);
    expect(m.writes).toContainEqual(expect.objectContaining({ op: 'set', path: EXPENSE }));
  });

  it('re-applies exactly the contribution the deletion removed', async () => {
    m.docs[OWN_GOAL] = { currentAmount: 30, contributions: {} };
    const contribution = { id: 'c1', amount: 50, date: date.toISOString(), byId: 'bob' };

    await restoreExpense('bob', { expense: serializable({ contributionId: 'c1' }), links: { contribution }, recurring: null });

    const goalUpdate = m.writes.find(w => w.path === OWN_GOAL);
    expect(goalUpdate?.data).toMatchObject({
      currentAmount: 80, lastContributionId: 'c1',
      'contributions.c1': { amount: 50, byId: 'bob' },
    });
  });
});
