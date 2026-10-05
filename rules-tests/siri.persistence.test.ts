import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { ValidatedParsedExpense } from '@/features/ai/validateParsedExpense';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/firebaseAdmin', () => ({ getAdminDb: () => db }));
import { consumeSiriQuota } from '@/features/ai/siriRateLimit';
import { findSiriReceipt, siriRequestFingerprint, SiriRequestConflictError } from '@/features/ai/siriIdempotency';
import { addSiriExpense, SiriExpenseValidationError } from '@/features/expenses/services/siriExpensesService';

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('This test requires the Firestore emulator.');
const app = initializeApp({ projectId: 'demo-siri-persistence' }, 'siri-persistence-tests');
const db = getFirestore(app);
const uid = 'siri-test-user';
const expense: ValidatedParsedExpense = {
  type: 'expense', amount: 25, currency: 'CAD', categoryId: 'food', date: '2026-09-01',
  confidence: 0.95, needsClarification: false, clarificationQuestion: null, merchant: null, description: null,
};
beforeEach(async () => {
  await Promise.all(['expenses', 'monthlyStats', 'categories', 'users', 'messages'].map((name) => db.recursiveDelete(db.doc(`${name}/${uid}`))));
  await db.doc(`categories/${uid}/expense/food`).set({ type: 'expense', name: 'Food', isPrivate: true });
});
afterAll(async () => { await db.terminate(); await deleteApp(app); });

it('persists the private expense and matching per-currency aggregates', async () => {
  const saved = await addSiriExpense(uid, expense, 'Pacific/Kiritimati');
  const data = (await db.doc(`expenses/${uid}/items/${saved.id}`).get()).data()!;
  const stats = (await db.doc(`monthlyStats/${uid}/months/2026-09`).get()).data()!;
  expect(data.privacy).toBe('secret');
  expect(data.date.toDate().toISOString()).toBe('2026-08-31T22:00:00.000Z');
  expect(stats.totalsByCurrency).toEqual({ CAD: 25 });
  expect(stats.byCategoryByCurrency).toEqual({ CAD: { food: 25 } });
  const message = (await db.doc(`messages/${uid}/items/siri-${saved.id}`).get()).data()!;
  expect(message).toMatchObject({ userId: uid, status: 'saved', expenseId: saved.id,
    card: { kind: 'saved', data: { expenseId: saved.id, amount: 25, currency: 'CA$', hint: 'Via Siri · 2026-09-01' } } });
  expect(message.createdAt.toMillis()).toBe(data.createdAt.toMillis());
});
it('does not lose increments or mix currencies during concurrent saves', async () => {
  await Promise.all([
    addSiriExpense(uid, expense, 'UTC'),
    addSiriExpense(uid, expense, 'UTC'),
    addSiriExpense(uid, { ...expense, currency: 'USD', amount: 7 }, 'UTC'),
  ]);
  expect((await db.collection(`expenses/${uid}/items`).get()).size).toBe(3);
  const stats = (await db.doc(`monthlyStats/${uid}/months/2026-09`).get()).data()!;
  expect(stats.totalsByCurrency).toEqual({ CAD: 50, USD: 7 });
  expect(stats.byCategoryByCurrency).toEqual({ CAD: { food: 50 }, USD: { food: 7 } });
});
it('writes neither expense nor stats when the category was archived after parsing', async () => {
  await db.doc(`categories/${uid}/expense/food`).update({ archived: true });
  await expect(addSiriExpense(uid, expense, 'UTC')).rejects.toBeInstanceOf(SiriExpenseValidationError);
  expect((await db.collection(`expenses/${uid}/items`).get()).empty).toBe(true);
  expect((await db.doc(`monthlyStats/${uid}/months/2026-09`).get()).exists).toBe(false);
  expect((await db.collection(`messages/${uid}/items`).get()).empty).toBe(true);
});

it('commits concurrent identical request IDs only once and replays after expense deletion', async () => {
  const request = { id: 'same-id', fingerprint: siriRequestFingerprint('Coffee 25', 'UTC'), language: 'en' as const };
  const [first, retry] = await Promise.all([
    addSiriExpense(uid, expense, 'UTC', request),
    addSiriExpense(uid, expense, 'UTC', request),
  ]);
  expect(retry).toEqual(first);
  expect((await db.collection(`expenses/${uid}/items`).get()).size).toBe(1);
  expect((await db.collection(`messages/${uid}/items`).get()).size).toBe(1);
  expect((await db.doc(`monthlyStats/${uid}/months/2026-09`).get()).data()!.totalsByCurrency).toEqual({ CAD: 25 });
  expect((await findSiriReceipt(uid, request.id, request.fingerprint))?.expense).toEqual(first);
  expect(await findSiriReceipt('other-owner', request.id, request.fingerprint)).toBeNull();
  await db.doc(`expenses/${uid}/items/${first.id}`).delete();
  await db.doc(`messages/${uid}/items/siri-${first.id}`).delete();
  expect(await addSiriExpense(uid, expense, 'UTC', request)).toEqual(first);
  expect((await db.collection(`expenses/${uid}/items`).get()).empty).toBe(true);
  expect((await db.collection(`messages/${uid}/items`).get()).empty).toBe(true);
});
it('rejects a changed payload under the same ID without changing stats', async () => {
  const request = { id: 'same-id', fingerprint: siriRequestFingerprint('Coffee 25', 'UTC'), language: 'en' as const };
  await addSiriExpense(uid, expense, 'UTC', request);
  await expect(addSiriExpense(uid, { ...expense, amount: 99 }, 'UTC', { ...request, fingerprint: siriRequestFingerprint('Coffee 99', 'UTC') })).rejects.toBeInstanceOf(SiriRequestConflictError);
  expect((await db.doc(`monthlyStats/${uid}/months/2026-09`).get()).data()!.totalsByCurrency).toEqual({ CAD: 25 });
});
it('does not reserve a request ID when validation aborts the transaction', async () => {
  await db.doc(`categories/${uid}/expense/food`).update({ archived: true });
  const request = { id: 'retryable-id', fingerprint: 'hash', language: 'en' as const };
  await expect(addSiriExpense(uid, expense, 'UTC', request)).rejects.toBeInstanceOf(SiriExpenseValidationError);
  expect(await findSiriReceipt(uid, request.id, request.fingerprint)).toBeNull();
});

it('allows only one concurrent request when the shared account quota has one slot left', async () => {
  const now = 1_000_000;
  const ref = db.doc(`users/${uid}/shortcutUsage/rateLimit`);
  await ref.set({ minute: { count: 9, resetAt: now + 60_000 }, day: { count: 9, resetAt: now + 86_400_000 } });
  const results = await Promise.all(Array.from({ length: 3 }, () => consumeSiriQuota(uid, now)));
  expect(results.filter((result) => result.allowed)).toHaveLength(1);
  expect((await ref.get()).data()!.minute.count).toBe(10);
  expect((await ref.get()).data()!.day.count).toBe(10);
});
