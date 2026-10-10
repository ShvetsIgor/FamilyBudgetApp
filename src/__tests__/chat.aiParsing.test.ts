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
it('maps the zero-categories refusal to starter setup instead of a long instruction', async () => {
  fetchMock.mockResolvedValue(Response.json({ error: 'category_required', reason: 'no_categories', message: 'Открой «Категории»…' }, { status: 422 }));
  expect(await parseChatMessage('кофе 20', context)).toEqual({ kind: 'needs_categories' });
});
it('keeps an ordinary category_required refusal as a clarification', async () => {
  fetchMock.mockResolvedValue(Response.json({ error: 'category_required', message: 'Нет категории «Кофе»' }, { status: 422 }));
  expect(await parseChatMessage('кофе 20', context)).toEqual({ kind: 'clarification', message: 'Нет категории «Кофе»' });
});
it('tells the service-wide AI ceiling apart from the personal limit', async () => {
  fetchMock.mockResolvedValue(Response.json({ error: 'ai_capacity', retryAfter: 30 }, { status: 429 }));
  const capacity = await parseChatMessage('кофе 20', context);
  expect(capacity).toMatchObject({ kind: 'clarification', message: expect.stringContaining('перегружен у всех') });
  expect(capacity).toMatchObject({ message: expect.stringContaining('не сохранён') });
  fetchMock.mockResolvedValue(Response.json({ error: 'rate_limited' }, { status: 429 }));
  expect(await parseChatMessage('кофе 20', context)).toMatchObject({ message: expect.stringContaining('Лимит ИИ') });
  fetchMock.mockResolvedValue(Response.json({ error: 'ai_capacity', retryAfter: 30 }, { status: 429 }));
  expect(await parseChatMessage('coffee 20', { ...context, language: 'en' }))
    .toMatchObject({ message: expect.stringContaining('busy for everyone') });
});
it('words the per-owner message pace neutrally, keeping «AI limit» for the AI quota only', async () => {
  fetchMock.mockImplementation(async () => Response.json({ ok: false, error: 'request_rate_limited', retryAfter: 20 }, { status: 429 }));
  const ru = await parseChatMessage('кофе 20', context);
  expect(ru).toEqual({ kind: 'clarification',
    message: 'Слишком много сообщений подряд. Расход не сохранён. Подожди немного или добавь вручную через «+».' });
  expect(await parseChatMessage('coffee 20', { ...context, language: 'en' })).toEqual({ kind: 'clarification',
    message: 'Too many messages in a row. Expense not saved. Wait a moment or add it manually using “+”.' });
  fetchMock.mockResolvedValue(Response.json({ ok: false, error: 'rate_limited' }, { status: 429 }));
  expect(await parseChatMessage('coffee 20', { ...context, language: 'en' }))
    .toMatchObject({ message: expect.stringContaining('AI request limit') });
});
it('sends the original writing day as referenceDate only when one is given', async () => {
  await parseChatMessage('вчера кофе 20', { ...context, referenceDate: '2026-10-08' });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body).toMatchObject({ text: 'вчера кофе 20', referenceDate: '2026-10-08' });
  await parseChatMessage('кофе 20', { ...context, referenceDate: undefined });
  expect(Object.keys(JSON.parse(fetchMock.mock.calls[1][1].body)).sort()).toEqual(['text', 'timeZone']);
});
