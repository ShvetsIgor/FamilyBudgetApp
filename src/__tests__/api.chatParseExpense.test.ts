// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), parser: vi.fn(), context: vi.fn(), quota: vi.fn(), requests: vi.fn(),
  save: vi.fn(), report: vi.fn(), capacity: vi.fn(), cooldown: vi.fn() }));
vi.mock('@/features/ai/chatAuth', () => ({ resolveChatAuthorization: mocks.auth }));
vi.mock('@/features/ai/expenseParser/parseExpenseText', async (original) => ({
  ...await original<typeof import('@/features/ai/expenseParser/parseExpenseText')>(), parseExpenseText: mocks.parser }));
vi.mock('@/features/ai/siriContext', () => ({ loadSiriContext: mocks.context, SiriProfileError: class extends Error {} }));
vi.mock('@/features/ai/siriRateLimit', () => ({ consumeAiQuota: mocks.quota, consumeChatRequestQuota: mocks.requests,
  recordAiCooldown: mocks.cooldown }));
vi.mock('@/features/expenses/services/siriExpensesService', () => ({ addSiriExpense: mocks.save }));
vi.mock('@/shared/lib/serverMonitoring', () => ({ reportServerFailure: mocks.report, reportProviderCapacity: mocks.capacity }));
import { POST } from '@/app/api/chat/parse-expense/route';
import { ExpenseParserCapacityError } from '@/features/ai/expenseParser/parseExpenseText';
import { SiriProfileError } from '@/features/ai/siriContext';
const expense = { type: 'expense', amount: 25.5, currency: 'USD', categoryId: 'food', date: '2026-10-05',
  confidence: 0.95, needsClarification: false, clarificationQuestion: null, suggestedCategoryName: null,
  merchant: 'Dabbah', description: 'Milk' };
const request = (body: unknown = { text: 'Вчера молоко 25.5 долларов', timeZone: 'Asia/Jerusalem' }) =>
  new Request('https://app.test/api/chat/parse-expense', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue('alice'); mocks.quota.mockResolvedValue({ allowed: true });
  mocks.requests.mockResolvedValue({ allowed: true });
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [{ id: 'food', name: 'Продукты', type: 'expense' }] });
  mocks.parser.mockResolvedValue(expense);
});
afterEach(() => vi.useRealTimers());
it('returns a validated draft and never saves a financial record', async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ ok: true, expense });
  expect(mocks.parser).toHaveBeenCalledWith(expect.objectContaining({ defaultCurrency: 'ILS', categories: [{ id: 'food', name: 'Продукты' }] }));
  expect(mocks.save).not.toHaveBeenCalled();
});
it('ignores supplied identities and categories', async () => {
  await POST(request({ uid: 'bob', categories: [{ id: 'foreign' }], text: 'Milk 20', timeZone: 'UTC' }));
  expect(mocks.context).toHaveBeenCalledWith('alice');
  expect(mocks.quota).toHaveBeenCalledWith('alice');
});
it('rejects unauthenticated calls before body/quota/provider work', async () => {
  mocks.auth.mockResolvedValue(null);
  const req = request(); const response = await POST(req);
  expect(response.status).toBe(401); expect(req.bodyUsed).toBe(false);
  expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.parser).not.toHaveBeenCalled();
  expect(mocks.requests).not.toHaveBeenCalled(); expect(mocks.report).not.toHaveBeenCalled();
});
it.each([{ text: '', timeZone: 'UTC' }, { text: 'a'.repeat(2100), timeZone: 'UTC' }, { text: '20', timeZone: 'invalid' }])(
  'rejects invalid input before Groq', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.parser).not.toHaveBeenCalled();
  },
);
it('enforces the shared Siri/chat quota before reading account data', async () => {
  mocks.quota.mockResolvedValue({ allowed: false, reason: 'owner', retryAfter: 45 });
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('45');
  expect(await response.json()).toEqual({ ok: false, error: 'rate_limited', retryAfter: 45 });
  expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.parser).not.toHaveBeenCalled();
  expect(mocks.report).not.toHaveBeenCalled();
});
it('reports the global AI ceiling as capacity, not as the owner limit', async () => {
  mocks.quota.mockResolvedValue({ allowed: false, reason: 'global', retryAfter: 12 });
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('12');
  expect(await response.json()).toEqual({ ok: false, error: 'ai_capacity', retryAfter: 12 });
  expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.parser).not.toHaveBeenCalled();
});
it('limits every request before context, quota or Groq work', async () => {
  mocks.requests.mockResolvedValue({ allowed: false, retryAfter: 30 });
  for (const text of ['Рами Леви 250', 'Вчера молоко 25.5 долларов']) {
    const response = await POST(request({ text, timeZone: 'UTC' }));
    expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('30');
    expect(await response.json()).toEqual({ ok: false, error: 'request_rate_limited', retryAfter: 30 });
  }
  expect(mocks.requests).toHaveBeenCalledWith('alice');
  expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled();
  expect(mocks.parser).not.toHaveBeenCalled(); expect(mocks.report).not.toHaveBeenCalled();
});
it('fails closed without reading context when the request limiter is unavailable', async () => {
  mocks.requests.mockRejectedValue(new Error('offline users/alice/shortcutUsage'));
  const response = await POST(request());
  expect(response.status).toBe(503); expect((await response.json()).error).toBe('rate_limit_unavailable');
  expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.parser).not.toHaveBeenCalled();
  expect(mocks.report).toHaveBeenCalledWith(expect.objectContaining({ route: 'chat_parse', stage: 'rate_limit' }));
});
it('meters dictionary drafts as requests without spending the AI quota', async () => {
  const response = await POST(request({ text: 'Rami Levy 100', timeZone: 'UTC' }));
  expect(response.status).toBe(200);
  expect(mocks.requests).toHaveBeenCalledWith('alice');
  expect(mocks.quota).not.toHaveBeenCalled(); expect(mocks.parser).not.toHaveBeenCalled();
});
it('reserves the request and AI quotas before reading account data', async () => {
  await POST(request());
  const [requests] = mocks.requests.mock.invocationCallOrder;
  const [quota] = mocks.quota.mock.invocationCallOrder;
  const [context] = mocks.context.mock.invocationCallOrder;
  expect(requests).toBeLessThan(quota); expect(quota).toBeLessThan(context);
});
it('maps a Groq 429 to capacity with its retry delay', async () => {
  mocks.parser.mockRejectedValue(new ExpenseParserCapacityError(20));
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('20');
  expect(await response.json()).toEqual({ ok: false, error: 'ai_capacity', retryAfter: 20 });
  expect(mocks.capacity).toHaveBeenCalledWith('chat_parse'); expect(mocks.report).not.toHaveBeenCalled();
  expect(mocks.cooldown).toHaveBeenCalledExactlyOnceWith(20);
});
it.each(['Рами Леви 250', 'Rami Levy 100'])('returns a category-choice draft for %s without asking Groq to guess', async (text) => {
  mocks.quota.mockResolvedValue({ allowed: false, retryAfter: 45 });
  mocks.parser.mockResolvedValue({ ...expense, categoryId: null, suggestedCategoryName: 'Одежда', needsClarification: true });
  const response = await POST(request({ text, timeZone: 'Asia/Jerusalem', currency: 'USD' }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, expense: {
    amount: text.endsWith('250') ? 250 : 100, currency: 'ILS',
    merchant: 'Рами Леви', categoryId: null, merchantOnly: true,
  } });
  expect(mocks.parser).not.toHaveBeenCalled();
  expect(mocks.quota).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it('keeps explicit categories and currencies on the validated AI path', async () => {
  await POST(request({ text: 'Рами Леви одежда 250 USD', timeZone: 'UTC' }));
  expect(mocks.parser).toHaveBeenCalled();
  expect(mocks.quota).toHaveBeenCalledWith('alice');
});
it.each([
  ['auth', 'auth'], ['requests', 'rate_limit'], ['quota', 'rate_limit'], ['context', 'context'], ['parser', 'parser'],
] as const)('sanitizes and reports %s failures', async (key, stage) => {
  const error = new Error('secret token and internal details');
  mocks[key].mockRejectedValue(error);
  const response = await POST(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
  expect(mocks.report).toHaveBeenCalledExactlyOnceWith({ route: 'chat_parse', stage, error });
});
it('does not report an incomplete profile as an outage', async () => {
  mocks.context.mockRejectedValue(new SiriProfileError());
  expect((await POST(request())).status).toBe(409);
  expect(mocks.report).not.toHaveBeenCalled();
});
it.each([
  { currency: 'EUR' }, { date: '2026-02-31' }, { amount: -1 }, { confidence: 0.3 }, { categoryId: 'foreign' },
  { needsClarification: true, clarificationQuestion: 'Сколько?' },
])('keeps invalid or ambiguous extraction out of confirmation cards', async (changes) => {
  mocks.parser.mockResolvedValue({ ...expense, ...changes });
  const response = await POST(request());
  expect(response.status).toBe(422); expect((await response.json()).ok).toBe(false);
});
it('rejects an archived category even if the parser names it', async () => {
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [{ id: 'food', type: 'expense', archived: true }] });
  expect((await POST(request())).status).toBe(422);
});
it('provides the suggested missing category without creating it', async () => {
  mocks.parser.mockResolvedValue({ ...expense, categoryId: null, suggestedCategoryName: 'Ветеринар', needsClarification: true });
  const response = await POST(request());
  expect(response.status).toBe(422);
  const body = await response.json();
  expect(body).toMatchObject({ error: 'category_required', message: expect.stringContaining('Ветеринар') });
  expect(body).not.toHaveProperty('reason');
  expect(mocks.save).not.toHaveBeenCalled();
});
it.each(['Вчера молоко 25.5 долларов', 'Рами Леви 250'])('marks an account without categories for %s', async (text) => {
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [] });
  const response = await POST(request({ text, timeZone: 'UTC' }));
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ ok: false, error: 'category_required', reason: 'no_categories',
    message: expect.any(String) });
  expect(mocks.parser).not.toHaveBeenCalled(); expect(mocks.report).not.toHaveBeenCalled();
});
it.each(['Вчера молоко 25.5 долларов', 'Рами Леви 250'])('treats an account holding only the Savings bucket as empty for %s', async (text) => {
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru',
    categories: [{ id: 'k3j9x2', name: 'Savings', type: 'expense' }] });
  const response = await POST(request({ text, timeZone: 'UTC' }));
  expect(response.status).toBe(422);
  expect(await response.json()).toMatchObject({ ok: false, error: 'category_required', reason: 'no_categories' });
  expect(mocks.parser).not.toHaveBeenCalled();
});
it('still parses when a real category sits next to the Savings bucket, offering both to Groq', async () => {
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [
    { id: 'k3j9x2', name: 'Savings', type: 'expense' }, { id: 'food', name: 'Продукты', type: 'expense' }] });
  expect((await POST(request())).status).toBe(200);
  expect(mocks.parser).toHaveBeenCalledWith(expect.objectContaining({
    categories: [{ id: 'k3j9x2', name: 'Savings' }, { id: 'food', name: 'Продукты' }] }));
});

const atLocalNoon = () => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T12:00:00Z')); };
it.each(['2026-10-10', '2026-10-08', '2026-10-03'])('uses referenceDate %s within the last week for Groq', async (referenceDate) => {
  atLocalNoon();
  await POST(request({ text: 'Вчера молоко 25.5 долларов', timeZone: 'UTC', referenceDate }));
  expect(mocks.parser).toHaveBeenCalledWith(expect.objectContaining({ todayKey: referenceDate }));
});
it('uses referenceDate as the dictionary draft date', async () => {
  atLocalNoon();
  const response = await POST(request({ text: 'Rami Levy 100', timeZone: 'UTC', referenceDate: '2026-10-08' }));
  expect(await response.json()).toMatchObject({ ok: true, expense: { date: '2026-10-08' } });
});
it('dates an undated AI expense on referenceDate, not the server today', async () => {
  atLocalNoon();
  mocks.parser.mockResolvedValue({ ...expense, date: null });
  const response = await POST(request({ text: 'Молоко 25.5 долларов', timeZone: 'UTC', referenceDate: '2026-10-08' }));
  expect(await response.json()).toMatchObject({ ok: true, expense: { date: '2026-10-08' } });
});
it.each([
  ['the future', '2026-10-11'], ['more than a week ago', '2026-10-02'], ['an impossible date', '2026-02-30'],
  ['a timestamp', '2026-10-08T00:00:00Z'], ['a short date', '2026-1-8'], ['a number', 20261008], ['null', null],
])('ignores a referenceDate in %s and uses today', async (_, referenceDate) => {
  atLocalNoon();
  const response = await POST(request({ text: 'Вчера молоко 25.5 долларов', timeZone: 'UTC', referenceDate }));
  expect(response.status).not.toBe(400);
  expect(mocks.parser).toHaveBeenCalledWith(expect.objectContaining({ todayKey: '2026-10-10' }));
});
it('bounds referenceDate by the request time zone', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T22:30:00Z'));
  await POST(request({ text: 'Вчера молоко 25.5 долларов', timeZone: 'Asia/Jerusalem', referenceDate: '2026-10-11' }));
  expect(mocks.parser).toHaveBeenCalledWith(expect.objectContaining({ todayKey: '2026-10-11' }));
  mocks.parser.mockClear();
  await POST(request({ text: 'Вчера молоко 25.5 долларов', timeZone: 'America/Toronto', referenceDate: '2026-10-11' }));
  expect(mocks.parser).toHaveBeenCalledWith(expect.objectContaining({ todayKey: '2026-10-10' }));
});
