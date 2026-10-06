import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const session = vi.hoisted(() => ({ currentUser: null as null | { uid: string; getIdToken: ReturnType<typeof vi.fn> } }));
vi.mock('@/shared/lib/firebase', () => ({ getFirebaseAuth: () => session }));
import { parseChatMessage, ChatSessionChangedError } from '@/features/chat/services/parseChatMessage';
const fetchMock = vi.fn();
const context = { userId: 'alice', language: 'ru' as const, learned: {} };
const expense = { type: 'expense', amount: 25.5, currency: 'USD', categoryId: 'food', date: '2026-10-05',
  confidence: 0.95, needsClarification: false, clarificationQuestion: null, suggestedCategoryName: null,
  merchant: 'Dabbah', description: 'Milk' };
beforeEach(() => {
  session.currentUser = { uid: 'alice', getIdToken: vi.fn().mockResolvedValue('firebase-id-token') };
  vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  fetchMock.mockResolvedValue(Response.json({ ok: true, expense }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('sends only text/timezone with Firebase auth, preserving currency/date without auto-confirming', async () => {
  const result = await parseChatMessage('вчера молоко двадцать пять долларов', context);
  expect(fetchMock).toHaveBeenCalledWith('/api/chat/parse-expense', expect.objectContaining({
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer firebase-id-token' },
  }));
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(Object.keys(body).sort()).toEqual(['text', 'timeZone']);
  expect(result).toMatchObject({ kind: 'parsed', parsed: { amount: 25.5, currency: 'USD', date: '2026-10-05', note: 'Milk', storeName: 'Даббах' } });
  if (result.kind === 'parsed') expect(result.parsed.confirmed).toBeUndefined();
});
it('accepts a marked merchant draft without a category and never confirms it automatically', async () => {
  fetchMock.mockResolvedValue(Response.json({ ok: true, expense: { ...expense, categoryId: null, merchant: 'Rami Levy', merchantOnly: true } }));
  expect(await parseChatMessage('Рами Леви 25.5', context)).toMatchObject({ kind: 'parsed', parsed: {
    categoryId: null, merchantOnly: true, storeName: 'Рами Леви', storeId: 'rami_levi', needsConfirmation: true,
  } });
});
it('rejects an unmarked category-less AI response', async () => {
  fetchMock.mockResolvedValue(Response.json({ ok: true, expense: { ...expense, categoryId: null } }));
  expect(await parseChatMessage('Рами Леви одежда 25.5', context)).toMatchObject({ kind: 'clarification' });
});
it('keeps explicit income on the existing path without Groq', async () => {
  expect(await parseChatMessage('+100 зарплата', context)).toMatchObject({ kind: 'parsed', parsed: { isIncome: true, amount: 100 } });
  expect(fetchMock).not.toHaveBeenCalled();
});
it('shows the clarification and never falls back to an amount guess', async () => {
  fetchMock.mockResolvedValue(Response.json({ ok: false, message: 'Какая валюта?' }, { status: 422 }));
  expect(await parseChatMessage('кофе 20 EUR', context)).toEqual({ kind: 'clarification', message: 'Какая валюта?' });
});
it.each([401, 429, 503])('returns a visible safe failure for HTTP %s', async (status) => {
  fetchMock.mockResolvedValue(Response.json({ ok: false }, { status }));
  expect(await parseChatMessage('кофе 20 USD', context)).toMatchObject({ kind: 'clarification', message: expect.stringContaining('не сохранён') });
});
it('handles offline and non-JSON replies without falling back', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('<html>error</html>'));
  for (let i = 0; i < 2; i++) expect(await parseChatMessage('20 долларов', context)).toMatchObject({ kind: 'clarification' });
});
it('discards a result if the account changes while Groq is working', async () => {
  fetchMock.mockImplementation(async () => {
    session.currentUser = { uid: 'bob', getIdToken: vi.fn() };
    return Response.json({ ok: true, expense });
  });
  await expect(parseChatMessage('20 молоко', context)).rejects.toBeInstanceOf(ChatSessionChangedError);
});
it('does not send a request if the session changes while refreshing its token', async () => {
  session.currentUser!.getIdToken.mockImplementation(async () => { session.currentUser = null; return 'token'; });
  await expect(parseChatMessage('20 молоко', context)).rejects.toBeInstanceOf(ChatSessionChangedError);
  expect(fetchMock).not.toHaveBeenCalled();
});
it('bounds slow provider responses and does not retry', async () => {
  vi.useFakeTimers();
  fetchMock.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')))));
  const pending = parseChatMessage('20 молоко', context);
  await vi.advanceTimersByTimeAsync(25_000);
  expect(await pending).toMatchObject({ kind: 'clarification' }); expect(fetchMock).toHaveBeenCalledTimes(1);
});
