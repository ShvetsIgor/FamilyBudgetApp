/**
 * /api/chat/parse-receipt reads a photo into a draft and saves nothing. It is
 * metered like the text route — before any account read — and its answers
 * never expose provider details.
 */
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), vision: vi.fn(), context: vi.fn(), quota: vi.fn(), requests: vi.fn(),
  report: vi.fn(), capacity: vi.fn(), cooldown: vi.fn(), save: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/features/ai/chatAuth', () => ({ resolveChatAuthorization: mocks.auth }));
vi.mock('@/features/ai/receiptParser/parseReceiptImage', () => ({ parseReceiptImage: mocks.vision }));
vi.mock('@/features/ai/siriContext', () => ({ loadSiriContext: mocks.context, SiriProfileError: class extends Error {} }));
vi.mock('@/features/ai/siriRateLimit', () => ({ consumeAiQuota: mocks.quota, consumeChatRequestQuota: mocks.requests,
  recordAiCooldown: mocks.cooldown }));
vi.mock('@/shared/lib/serverMonitoring', () => ({ reportServerFailure: mocks.report, reportProviderCapacity: mocks.capacity }));
vi.mock('@/features/expenses/services/siriExpensesService', () => ({ addSiriExpense: mocks.save }));

import { POST } from '@/app/api/chat/parse-receipt/route';
import { ExpenseParserCapacityError, ExpenseParserError } from '@/features/ai/expenseParser/parseExpenseText';

const IMAGE = `data:image/jpeg;base64,${'A'.repeat(4000)}`;
const request = (body: unknown = { image: IMAGE, timeZone: 'Asia/Jerusalem' }) =>
  new Request('https://app.test/api/chat/parse-receipt', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: JSON.stringify(body) });
const readable = { merchant: 'Shufersal', date: '2026-10-09', currency: 'ILS', total: 30,
  items: [{ name: 'Milk', amount: 10, categoryId: 'groceries' }, { name: '?', amount: 20, categoryId: 'savings' }] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ now: Date.parse('2026-10-11T09:00:00Z'), toFake: ['Date'] });
  mocks.auth.mockResolvedValue('alice');
  mocks.requests.mockResolvedValue({ allowed: true });
  mocks.quota.mockResolvedValue({ allowed: true });
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [
    { id: 'groceries', name: 'Продукты', type: 'expense' }, { id: 'savings', name: 'Savings', type: 'expense' },
  ] });
  mocks.vision.mockResolvedValue(readable);
});

it('returns a categorized draft and saves nothing', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ ok: true, receipt: {
    merchant: 'Shufersal', date: '2026-10-09', currency: 'ILS', total: 30,
    groups: [{ categoryId: 'groceries', amount: 10, names: ['Milk'] }, { categoryId: null, amount: 20, names: ['?'] }],
  } });
  // The savings bucket is never offered to the model, so it cannot be chosen for a line
  expect(mocks.vision).toHaveBeenCalledWith(expect.objectContaining({ categories: [{ id: 'groceries', name: 'Продукты' }], todayKey: '2026-10-11' }));
  expect(mocks.save).not.toHaveBeenCalled();
});

it('rejects unauthenticated calls before reading the photo', async () => {
  mocks.auth.mockResolvedValue(null);
  const req = request();
  expect((await POST(req)).status).toBe(401);
  expect(req.bodyUsed).toBe(false);
  expect(mocks.requests).not.toHaveBeenCalled();
});

it.each([
  [{ image: 'data:image/gif;base64,AAAA', timeZone: 'UTC' }],
  [{ image: 'https://example.com/receipt.jpg', timeZone: 'UTC' }],
  [{ image: IMAGE, timeZone: 'Mars/Base' }],
  [{ image: IMAGE }],
])('rejects a bad request before any quota or account read', async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.requests).not.toHaveBeenCalled();
  expect(mocks.context).not.toHaveBeenCalled();
});

it('refuses an oversized photo by its streamed size', async () => {
  const response = await POST(request({ image: `data:image/jpeg;base64,${'A'.repeat(2_100_000)}`, timeZone: 'UTC' }));
  expect(response.status).toBe(413);
  expect(mocks.vision).not.toHaveBeenCalled();
});

it('meters requests and the AI quota before reading the account', async () => {
  mocks.quota.mockResolvedValue({ allowed: false, reason: 'owner', retryAfter: 30 });
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ ok: false, error: 'rate_limited', retryAfter: 30 });
  expect(mocks.context).not.toHaveBeenCalled();
  expect(mocks.vision).not.toHaveBeenCalled();
});

it('asks for categories on an account that has only the savings bucket', async () => {
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [{ id: 'x1', name: 'Savings', type: 'expense' }] });
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ error: 'category_required', reason: 'no_categories' });
  expect(mocks.vision).not.toHaveBeenCalled();
});

it('maps a Groq 429 to capacity and stores the cooldown', async () => {
  mocks.vision.mockRejectedValue(new ExpenseParserCapacityError(40));
  const response = await POST(request());
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ ok: false, error: 'ai_capacity', retryAfter: 40 });
  expect(mocks.cooldown).toHaveBeenCalledWith(40);
  expect(mocks.capacity).toHaveBeenCalledWith('receipt_parse');
});

it('reports provider failures without details', async () => {
  mocks.vision.mockRejectedValue(new ExpenseParserError('Groq vision request failed: HTTP 500', { status: 500 }));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false, error: 'parser_unavailable' });
  expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ route: 'receipt_parse', stage: 'parser' }));
});

it('explains an unreadable receipt in the user\'s language', async () => {
  mocks.vision.mockResolvedValue({ ...readable, total: null });
  const response = await POST(request());
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ error: 'receipt_unreadable', reason: 'no_total', message: expect.stringContaining('итоговую сумму') });
});
