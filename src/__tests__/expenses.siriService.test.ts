// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import type { ValidatedParsedExpense } from '@/features/ai/validateParsedExpense';
const mock = vi.hoisted(() => ({ get: vi.fn(), create: vi.fn(), set: vi.fn(), runTransaction: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/firebaseAdmin', () => ({ getAdminDb: () => ({
  collection: (path: string) => ({ doc: () => ({ path: `${path}/new-id`, id: 'new-id' }) }),
  doc: (path: string) => ({ path }), runTransaction: mock.runTransaction,
}) }));
import { addSiriExpense, SiriExpenseValidationError } from '@/features/expenses/services/siriExpensesService';
const expense: ValidatedParsedExpense = {
  type: 'expense', amount: 25, currency: 'CAD', categoryId: 'food', suggestedCategoryName: null, date: '2026-09-01',
  confidence: 0.95, needsClarification: false, clarificationQuestion: null, merchant: 'Cafe', description: 'Lunch',
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.get.mockResolvedValue({ exists: true, id: 'food', data: () => ({ type: 'expense', name: 'Private food', isPrivate: true }) });
  mock.runTransaction.mockImplementation(async (work) => work(mock));
});
it('queues an expense and currency stats in one transaction, using fresh privacy and user-local month', async () => {
  const saved = await addSiriExpense('alice', expense, 'Pacific/Kiritimati');
  expect(saved).toMatchObject({ id: 'new-id', categoryName: 'Private food' });
  expect(mock.runTransaction).toHaveBeenCalledTimes(1);
  expect(mock.get).toHaveBeenCalledWith({ path: 'categories/alice/expense/food' });
  const [ref, data] = mock.create.mock.calls[0];
  expect(ref.path).toBe('expenses/alice/items/new-id');
  expect(data).toMatchObject({ privacy: 'secret', paymentMethod: 'other', splits: [], tags: [], store: 'Cafe', comment: 'Lunch', isRecurring: false });
  expect((data.date as Timestamp).toDate().toISOString()).toBe('2026-08-31T22:00:00.000Z');
  const [statsRef, patch, options] = mock.set.mock.calls[0];
  expect(statsRef.path).toBe('monthlyStats/alice/months/2026-09');
  expect(Object.keys(patch.totalsByCurrency)).toEqual(['CAD']);
  expect(Object.keys(patch.byCategoryByCurrency.CAD)).toEqual(['food']);
  expect(options).toEqual({ merge: true });
});
it.each([undefined, { type: 'expense', archived: true }, { type: 'income' }])('rejects missing, archived or wrong-type categories before queuing writes', async (category) => {
  mock.get.mockResolvedValue({ exists: !!category, id: 'food', data: () => category });
  await expect(addSiriExpense('alice', expense, 'UTC')).rejects.toBeInstanceOf(SiriExpenseValidationError);
  expect(mock.create).not.toHaveBeenCalled(); expect(mock.set).not.toHaveBeenCalled();
});
it('does not report success before the transaction commits', async () => {
  mock.runTransaction.mockImplementation(async (work) => { await work(mock); throw new Error('commit failed'); });
  await expect(addSiriExpense('alice', expense, 'UTC')).rejects.toThrow('commit failed');
});
it.each(['ru', 'en'] as const)('includes a linked chat card in the transaction using %s without a request ID', async (language) => {
  await addSiriExpense('alice', expense, 'UTC', undefined, language);
  expect(mock.create).toHaveBeenCalledWith({ path: 'messages/alice/items/siri-new-id' }, expect.objectContaining({
    userId: 'alice', kind: 'bot', status: 'saved', expenseId: 'new-id',
    card: { kind: 'saved', data: expect.objectContaining({
      title: 'Cafe · Private food', amount: 25, currency: 'CA$', expenseId: 'new-id',
      hint: `${language === 'ru' ? 'Через Siri' : 'Via Siri'} · 2026-09-01`,
    }) },
  }));
});
it('does not recreate a chat card when replaying an already committed request', async () => {
  const saved = { id: 'original-id', amount: 25, currency: 'CAD', date: expense.date, categoryName: 'Food' };
  mock.get.mockResolvedValueOnce({ data: () => ({ fingerprint: 'same', expense: saved, language: 'en' }) });
  expect(await addSiriExpense('alice', expense, 'UTC', { id: 'retry', fingerprint: 'same', language: 'en' })).toEqual(saved);
  expect(mock.create).not.toHaveBeenCalled();
  expect(mock.set).not.toHaveBeenCalled();
});
