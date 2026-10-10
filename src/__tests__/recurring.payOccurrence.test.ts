/**
 * «Оплачено» books the pending occurrence and moves the schedule on in one
 * transaction. A template saved before categories became mandatory has none:
 * it must be refused with a reason the screen can explain, not crash on an
 * empty document path or advance without recording the money.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import type { SerializableRecurringPayment } from '@/shared/types';

const m = vi.hoisted(() => ({
  docs: {} as Record<string, Record<string, unknown>>,
  writes: [] as { op: 'set' | 'update'; path: string; data: Record<string, unknown> }[],
}));

vi.mock('@/shared/lib/firebase', () => ({ getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    doc: (_db: unknown, ...parts: string[]) => {
      // The real SDK rejects an empty segment too
      if (parts.some(part => !part)) throw new Error('Invalid document reference');
      return { path: parts.join('/'), id: parts.at(-1) };
    },
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({
      get: async (ref: { path: string; id: string }) => ({
        id: ref.id, exists: () => ref.path in m.docs, data: () => m.docs[ref.path],
      }),
      set: (ref: { path: string }, data: Record<string, unknown>) => { m.writes.push({ op: 'set', path: ref.path, data }); },
      update: (ref: { path: string }, data: Record<string, unknown>) => { m.writes.push({ op: 'update', path: ref.path, data }); },
    }),
  };
});

import { payRecurringOccurrence } from '@/features/recurring/services/recurringService';

const TEMPLATE = 'recurringPayments/bob/items/r1';
const due = new Date(2026, 8, 10, 12);
const start = new Date(2026, 5, 10, 12);

function storeTemplate(categoryId: string) {
  m.docs[TEMPLATE] = {
    userId: 'bob', name: 'Netflix', amount: 45, currency: 'ILS', categoryId, frequency: 'monthly',
    startDate: Timestamp.fromDate(start), nextDueDate: Timestamp.fromDate(due),
    type: 'subscription', reminderDays: 1, isActive: true,
  };
}

function item(fields: Partial<SerializableRecurringPayment> = {}): SerializableRecurringPayment {
  return {
    id: 'r1', userId: 'bob', name: 'Netflix', amount: 45, currency: 'ILS', categoryId: '',
    frequency: 'monthly', startDate: start.toISOString(), nextDueDate: due.toISOString(),
    type: 'subscription', reminderDays: 1, isActive: true, ...fields,
  };
}

beforeEach(() => {
  m.docs = { 'categories/bob/expense/food': { name: 'Food' } };
  m.writes = [];
});

describe('payRecurringOccurrence', () => {
  it('refuses a template without a category and writes nothing', async () => {
    storeTemplate('');
    await expect(payRecurringOccurrence('bob', item())).rejects.toThrow('recurring-category-required');
    expect(m.writes).toEqual([]);
  });

  it('answers a stale screen with the current state, category or not', async () => {
    storeTemplate('');
    const result = await payRecurringOccurrence('bob', item({ nextDueDate: new Date(2026, 7, 10, 12).toISOString() }));
    expect(result.expense).toBeNull();
    expect(result.recurring.nextDueDate).toBe(due.toISOString());
    expect(m.writes).toEqual([]);
  });

  it('books the occurrence under its deterministic id and advances the schedule', async () => {
    storeTemplate('food');
    const result = await payRecurringOccurrence('bob', item({ categoryId: 'food' }));

    expect(result.expense?.id).toBe('recurring-r1-2026-09-10');
    expect(m.writes).toContainEqual(expect.objectContaining({ op: 'set', path: 'expenses/bob/items/recurring-r1-2026-09-10' }));
    const advance = m.writes.find(w => w.op === 'update' && w.path === TEMPLATE);
    expect((advance?.data.nextDueDate as Timestamp).toDate().getMonth()).toBe(9);
  });
});
