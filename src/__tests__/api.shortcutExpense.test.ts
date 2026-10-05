// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const quota = vi.hoisted(() => vi.fn());
vi.mock('@/features/ai/siriRateLimit', () => ({ consumeSiriQuota: quota }));
const receipt = vi.hoisted(() => vi.fn());
vi.mock('@/features/ai/siriIdempotency', () => ({ findSiriReceipt: receipt, siriRequestFingerprint: () => 'fingerprint', SiriRequestConflictError: class extends Error {} }));
const save = vi.hoisted(() => vi.fn());
vi.mock('@/features/expenses/services/siriExpensesService', () => ({ addSiriExpense: save, SiriExpenseValidationError: class extends Error {} }));
const parser = vi.hoisted(() => vi.fn());
vi.mock('@/features/ai/expenseParser/parseExpenseText', () => ({ parseExpenseText: parser }));
const auth = vi.hoisted(() => vi.fn());
const context = vi.hoisted(() => vi.fn());
vi.mock('@/features/ai/siriContext', () => ({ loadSiriContext: context, SiriProfileError: class extends Error {} }));
vi.mock('@/features/ai/siriAuth', () => ({ resolveShortcutAuthorization: auth }));
import { SiriRequestConflictError } from '@/features/ai/siriIdempotency';
import { POST, runtime } from '@/app/api/shortcut/expense/route';

beforeEach(() => { vi.resetAllMocks(); quota.mockResolvedValue({ allowed: true }); save.mockResolvedValue({ id: 'saved-id', amount: 10, currency: 'CAD', categoryName: 'Food', date: '2026-09-22' }); context.mockResolvedValue({ categories: [{ id: 'food', name: 'Food', type: 'expense' }], currency: 'CAD', language: 'ru' }); parser.mockResolvedValue({ amount: 10, currency: 'CAD', categoryId: 'food', date: null, confidence: 0.95, needsClarification: false, clarificationQuestion: null }); });
const request = (authorization?: string) => new Request('https://example.test/api/shortcut/expense', {
  method: 'POST', headers: authorization ? { authorization } : {}, body: JSON.stringify({ text: 'Coffee 10', timeZone: 'Asia/Jerusalem' }),
});

it('runs on Node for Firebase Admin', () => expect(runtime).toBe('nodejs'));
it.each([undefined, 'Bearer invalid', 'Bearer revoked'])('rejects unauthorized requests before reading their body: %s', async (header) => {
  auth.mockResolvedValue(null);
  const req = request(header);
  const response = await POST(req);
  expect(auth).toHaveBeenCalledWith(header ?? null);
  expect(response.status).toBe(401);
  expect(response.headers.get('WWW-Authenticate')).toBe('Bearer');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ ok: false, error: 'unauthorized', message: expect.any(String) });
  expect(context).not.toHaveBeenCalled();
  expect(req.bodyUsed).toBe(false);
});
it('returns a sanitized retryable error when authentication infrastructure fails', async () => {
  auth.mockRejectedValue(new Error('secret credentials and internal project details'));
  const response = await POST(request('Bearer private-token'));
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ ok: false, error: 'auth_unavailable', message: 'Authorization is temporarily unavailable. Try again later.' });
});
it('reports success only after persistence and uses the stored category name', async () => {
  auth.mockResolvedValue('private-owner-id');
  const req = request('Bearer private-token');
  const response = await POST(req);
  expect(response.status).toBe(201);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toMatchObject({ ok: true, saved: true, expense: { id: 'saved-id', amount: 10, currency: 'CAD', categoryName: 'Food' } });
  expect(parser).toHaveBeenCalledWith(expect.objectContaining({ defaultCurrency: 'CAD', language: 'ru', categories: [{ id: 'food', name: 'Food' }] }));
  expect(save).toHaveBeenCalledWith('private-owner-id', expect.any(Object), 'Asia/Jerusalem', undefined, 'ru');
});

it('loads context for the token owner, never a supplied request identity', async () => {
  auth.mockResolvedValue('alice');
  await POST(new Request('https://example.test/api/shortcut/expense', { method: 'POST', body: JSON.stringify({ uid: 'bob', text: 'Coffee 10', timeZone: 'Asia/Jerusalem' }) }));
  expect(context).toHaveBeenCalledWith('alice');
});
it('asks the user to activate a category when their list is empty', async () => {
  auth.mockResolvedValue('alice'); context.mockResolvedValue({ categories: [], language: 'ru' });
  const response = await POST(request());
  expect(response.status).toBe(409);
  expect((await response.json()).error).toBe('no_active_categories');
});
it('sanitizes context read failures', async () => {
  auth.mockResolvedValue('alice'); context.mockRejectedValue(new Error('private details'));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect((await response.json()).error).toBe('context_unavailable');
});

it('rejects malformed bodies before loading data or invoking Groq', async () => {
  auth.mockResolvedValue('alice');
  const response = await POST(new Request('https://example.test', { method: 'POST', body: 'broken JSON' }));
  expect(response.status).toBe(400); expect(context).not.toHaveBeenCalled(); expect(parser).not.toHaveBeenCalled();
});
it('returns the model clarification without a save', async () => {
  auth.mockResolvedValue('alice'); parser.mockResolvedValue({ needsClarification: true, clarificationQuestion: 'Сколько?' });
  const response = await POST(request());
  expect(response.status).toBe(422); expect((await response.json()).message).toBe('Сколько?');
});
it('independently rejects a category outside the user list', async () => {
  auth.mockResolvedValue('alice'); parser.mockResolvedValue({ amount: 10, currency: 'CAD', categoryId: 'foreign', confidence: 1, date: null, needsClarification: false });
  const response = await POST(request());
  expect(response.status).toBe(422); expect((await response.json()).error).toBe('clarification_required');
});
it('sanitizes parser failures', async () => {
  auth.mockResolvedValue('alice'); parser.mockRejectedValue(new Error('private provider information'));
  const response = await POST(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toBe('parser_unavailable');
});

it('does not claim success when persistence fails', async () => {
  auth.mockResolvedValue('alice'); save.mockRejectedValue(new Error('internal details'));
  const response = await POST(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toBe('save_unavailable');
});

it('replays a completed request before loading context or calling Groq', async () => {
  auth.mockResolvedValue('alice'); receipt.mockResolvedValue({ expense: { id: 'first', amount: 10, currency: 'CAD', categoryName: 'Food' }, language: 'ru' });
  const response = await POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ text: 'Coffee 10', timeZone: 'UTC', requestId: 'same-id' }) }));
  expect(response.status).toBe(200); expect((await response.json()).expense.id).toBe('first');
  expect(receipt).toHaveBeenCalledWith('alice', 'same-id', 'fingerprint');
  expect(quota).not.toHaveBeenCalled();
  expect(context).not.toHaveBeenCalled(); expect(parser).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});
it('rejects request ID reuse for a different payload', async () => {
  auth.mockResolvedValue('alice'); receipt.mockRejectedValue(new SiriRequestConflictError());
  const response = await POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ text: 'Coffee 10', timeZone: 'UTC', requestId: 'same-id' }) }));
  expect(response.status).toBe(409); expect(parser).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});
it('fails closed when the previous request cannot be checked', async () => {
  auth.mockResolvedValue('alice'); receipt.mockRejectedValue(new Error('offline'));
  const response = await POST(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ text: 'Coffee 10', timeZone: 'UTC', requestId: 'same-id' }) }));
  expect(response.status).toBe(503); expect(save).not.toHaveBeenCalled();
});

it('stops excess requests before context reads, Groq or expense writes', async () => {
  auth.mockResolvedValue('alice'); quota.mockResolvedValue({ allowed: false, retryAfter: 42 });
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('42');
  expect((await response.json()).error).toBe('rate_limited');
  expect(quota).toHaveBeenCalledWith('alice'); expect(context).not.toHaveBeenCalled();
  expect(parser).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});
it('fails closed when quota storage is unavailable', async () => {
  auth.mockResolvedValue('alice'); quota.mockRejectedValue(new Error('private details'));
  const response = await POST(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toBe('rate_limit_unavailable');
  expect(parser).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
});
