/**
 * A JSON export is only a backup if it restores. Round trip: real Firestore
 * Timestamps → export normalization → JSON text → restore plan must give back
 * the same documents with the same TYPES (a date restored as a string drops
 * the entry out of every month query), under the target uid.
 */
import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { normalizeForExport } from '@/features/debug/services/exportAllDataService';
import { buildRestorePlan } from '@/features/debug/services/restorePlan';

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
const OLD = 'oldUid0000000000000000000001';
const NEW = 'newUid0000000000000000000002';

function snapshot() {
  return {
    schemaVersion: 3,
    exportedAt: '2026-10-11T00:00:00.000Z',
    userId: OLD,
    derivedCollections: ['monthlyStats'],
    expenses: [{
      id: 'e1', userId: OLD, amount: 42.5, currency: 'ILS', categoryId: 'groceries',
      date: ts('2026-09-30T21:30:00.000Z'), createdAt: ts('2026-09-30T21:31:00.000Z'),
      splits: [{ categoryId: 'bakery', amount: 10 }], goalOwnerId: OLD,
    }],
    incomes: [{ id: 'i1', userId: OLD, amount: 9000, currency: 'ILS', date: ts('2026-09-10T09:00:00.000Z') }],
    savingsGoals: [{
      id: 'g1', userId: OLD, name: 'Trip', createdAt: ts('2026-01-01T00:00:00.000Z'),
      // Stored as a string in Firestore — must stay a string
      contributions: { c1: { amount: 5, date: '2026-02-01T10:00:00.000Z', byId: OLD } },
    }],
    recurringIncome: [{ id: 'r1', userId: OLD, nextDueDate: '2026-11-01', createdAt: ts('2026-01-01T00:00:00.000Z') }],
    messages: [
      { id: 'm1', userId: OLD, senderId: OLD, kind: 'user', text: 'кофе 20', status: 'saved', createdAt: ts('2026-09-30T21:30:00.000Z') },
      { id: 'm2', userId: OLD, senderId: OLD, kind: 'user', text: 'хлеб 8', status: 'failed',
        saveAttempt: { categoryId: 'bakery', startedAt: '2026-09-30T21:40:00.000Z' }, createdAt: ts('2026-09-30T21:40:00.000Z') },
      { id: 'm3', userId: OLD, senderId: 'bot', kind: 'bot', text: '?', status: 'clarifying',
        card: { kind: 'clarify', data: { userMsgId: 'm2' } }, createdAt: ts('2026-09-30T21:40:01.000Z') },
    ],
    monthlyStats: [{ id: '2026-09', totalExpenses: 42.5 }],
    learnedKeywords: [{ id: 'латте', categoryId: 'coffee' }],
    profile: { name: 'Sofia', email: 's@example.com', currency: 'ILS', familyId: 'fam1', accountType: 'family', createdAt: ts('2025-12-01T00:00:00.000Z') },
    budgets: { limits: { groceries: 2000 } },
    localSuggestionMemory: { merchants: {} },
  };
}

const exportText = (data: unknown) => JSON.stringify(normalizeForExport(data), null, 2);
const restore = (text: string, uid = NEW) => buildRestorePlan(JSON.parse(text), uid, (iso) => Timestamp.fromDate(new Date(iso)));
const byPath = (plan: ReturnType<typeof restore>) => new Map(plan.writes.map((w) => [w.path, w.data]));

describe('JSON export → restore round trip', () => {
  it('brings entries back with Timestamps where Firestore had them', () => {
    const writes = byPath(restore(exportText(snapshot())));
    const expense = writes.get(`expenses/${NEW}/items/e1`)!;
    expect(expense.date).toBeInstanceOf(Timestamp);
    expect((expense.date as Timestamp).toDate().toISOString()).toBe('2026-09-30T21:30:00.000Z');
    expect(expense.createdAt).toBeInstanceOf(Timestamp);
    expect(expense.amount).toBe(42.5);
    expect(expense.splits).toEqual([{ categoryId: 'bakery', amount: 10 }]);
    expect(writes.get(`incomes/${NEW}/items/i1`)!.date).toBeInstanceOf(Timestamp);
  });

  it('keeps genuine string dates as strings', () => {
    const writes = byPath(restore(exportText(snapshot())));
    const goal = writes.get(`savingsGoals/${NEW}/goals/g1`)!;
    expect((goal.contributions as Record<string, { date: unknown }>).c1.date).toBe('2026-02-01T10:00:00.000Z');
    expect(writes.get(`recurringIncome/${NEW}/items/r1`)!.nextDueDate).toBe('2026-11-01');
  });

  it('moves everything to the target uid, including self references', () => {
    const plan = restore(exportText(snapshot()));
    expect(plan.sourceUid).toBe(OLD);
    expect(JSON.stringify(plan.writes.map((w) => [w.path, w.data]))).not.toContain(OLD);
    const writes = byPath(plan);
    expect(writes.get(`expenses/${NEW}/items/e1`)!.goalOwnerId).toBe(NEW);
    expect(writes.get(`messages/${NEW}/items/m1`)!.senderId).toBe(NEW);
    expect(writes.get(`users/${NEW}/learnedKeywords/латте`)).toEqual({ categoryId: 'coffee' });
    expect(writes.get(`budgets/${NEW}`)).toEqual({ limits: { groceries: 2000 } });
  });

  it('restores the profile outside any family', () => {
    const profile = byPath(restore(exportText(snapshot()))).get(`users/${NEW}`)!;
    expect(profile.familyId).toBeNull();
    expect(profile.accountType).toBe('personal');
    expect(profile.createdAt).toBeInstanceOf(Timestamp);
  });

  it('skips derived and device-local sections', () => {
    const plan = restore(exportText(snapshot()));
    expect(plan.writes.some((w) => w.path.startsWith('monthlyStats/'))).toBe(false);
    expect(plan.skipped.join(' ')).toContain('monthlyStats');
  });

  it('leaves no chat action that could book money again', () => {
    const writes = byPath(restore(exportText(snapshot())));
    expect(writes.has(`messages/${NEW}/items/m3`)).toBe(false);
    const failed = writes.get(`messages/${NEW}/items/m2`)!;
    expect(failed.status).toBe('undone');
    expect(failed.saveAttempt).toBeUndefined();
    expect(writes.get(`messages/${NEW}/items/m1`)!.status).toBe('saved');
  });

  it('reads schema 2 exports, reviving only the fields the app stores as Timestamps', () => {
    const v2 = JSON.parse(exportText(snapshot()), (_key, value) =>
      value && typeof value === 'object' && !Array.isArray(value) && '$timestamp' in value ? value.$timestamp : value);
    v2.schemaVersion = 2;
    const writes = byPath(restore(JSON.stringify(v2)));
    expect(writes.get(`expenses/${NEW}/items/e1`)!.date).toBeInstanceOf(Timestamp);
    const goal = writes.get(`savingsGoals/${NEW}/goals/g1`)!;
    expect(goal.createdAt).toBeInstanceOf(Timestamp);
    expect((goal.contributions as Record<string, { date: unknown }>).c1.date).toBe('2026-02-01T10:00:00.000Z');
    expect(writes.get(`recurringIncome/${NEW}/items/r1`)!.nextDueDate).toBe('2026-11-01');
  });

  it('refuses malformed exports instead of writing half of them', () => {
    const ok = (iso: string) => iso;
    expect(() => buildRestorePlan({ schemaVersion: 9, userId: OLD }, NEW, ok)).toThrow(/schemaVersion/);
    expect(() => buildRestorePlan({ schemaVersion: 3 }, NEW, ok)).toThrow(/userId/);
    expect(() => buildRestorePlan({ schemaVersion: 3, userId: OLD, expenses: [{ amount: 1 }] }, NEW, ok)).toThrow(/valid id/);
    expect(() => buildRestorePlan({ schemaVersion: 3, userId: OLD, expenses: [{ id: 'a/b' }] }, NEW, ok)).toThrow(/valid id/);
    expect(() => buildRestorePlan({ schemaVersion: 3, userId: OLD }, 'x/y', ok)).toThrow(/target uid/);
  });
});
