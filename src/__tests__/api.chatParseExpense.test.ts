// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), parser: vi.fn(), context: vi.fn(), quota: vi.fn(), save: vi.fn() }));
vi.mock('@/features/ai/chatAuth', () => ({ resolveChatAuthorization: mocks.auth }));
vi.mock('@/features/ai/expenseParser/parseExpenseText', () => ({ parseExpenseText: mocks.parser }));
vi.mock('@/features/ai/siriContext', () => ({ loadSiriContext: mocks.context, SiriProfileError: class extends Error {} }));
vi.mock('@/features/ai/siriRateLimit', () => ({ consumeSiriQuota: mocks.quota }));
vi.mock('@/features/expenses/services/siriExpensesService', () => ({ addSiriExpense: mocks.save }));
import { POST } from '@/app/api/chat/parse-expense/route';
const expense = { type: 'expense', amount: 25.5, currency: 'USD', categoryId: 'food', date: '2026-10-05',
  confidence: 0.95, needsClarification: false, clarificationQuestion: null, suggestedCategoryName: null,
  merchant: 'Dabbah', description: 'Milk' };
const request = (body: unknown = { text: 'Вчера молоко 25.5 долларов', timeZone: 'Asia/Jerusalem' }) =>
  new Request('https://app.test/api/chat/parse-expense', { method: 'POST', headers: { Authorization: 'Bearer token' }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue('alice'); mocks.quota.mockResolvedValue({ allowed: true });
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [{ id: 'food', name: 'Продукты', type: 'expense' }] });
  mocks.parser.mockResolvedValue(expense);
});
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
});
it.each([{ text: '', timeZone: 'UTC' }, { text: 'a'.repeat(2100), timeZone: 'UTC' }, { text: '20', timeZone: 'invalid' }])(
  'rejects invalid input before Groq', async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.parser).not.toHaveBeenCalled();
  },
);
it('enforces the shared Siri/chat quota', async () => {
  mocks.quota.mockResolvedValue({ allowed: false, retryAfter: 45 });
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get('Retry-After')).toBe('45');
  expect(mocks.parser).not.toHaveBeenCalled();
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
it.each(['auth', 'quota', 'context', 'parser'] as const)('sanitizes %s failures', async (key) => {
  mocks[key].mockRejectedValue(new Error('secret token and internal details'));
  const response = await POST(request());
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
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
  expect(await response.json()).toMatchObject({ error: 'category_required', message: expect.stringContaining('Ветеринар') });
  expect(mocks.save).not.toHaveBeenCalled();
});
it('does not call Groq without active categories', async () => {
  mocks.context.mockResolvedValue({ currency: 'ILS', language: 'ru', categories: [] });
  expect((await POST(request())).status).toBe(422); expect(mocks.parser).not.toHaveBeenCalled();
});
