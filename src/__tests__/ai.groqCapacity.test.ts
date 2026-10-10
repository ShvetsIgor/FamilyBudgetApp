import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  ExpenseParserCapacityError, ExpenseParserError, parseExpenseText, retryAfterSeconds,
} from '@/features/ai/expenseParser/parseExpenseText';

const input = { text: 'Coffee 10', categories: [{ id: 'food', name: 'Food' }], defaultCurrency: 'ILS' as const, language: 'en' as const };
beforeEach(() => vi.stubEnv('GROQ_API_KEY', 'test-key'));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('throws a typed capacity error with the provider retry delay on HTTP 429', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{"error":"rate limit"}', { status: 429, headers: { 'retry-after': '17' } }));
  const error = await parseExpenseText(input).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ExpenseParserCapacityError);
  expect(error).toBeInstanceOf(ExpenseParserError);
  expect(error).toMatchObject({ retryAfter: 17, status: 429 });
});
it('keeps other HTTP failures as plain parser errors carrying only the status', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue(new Response('boom', { status: 500 }));
  const error = await parseExpenseText(input).catch((caught: unknown) => caught);
  expect(error).not.toBeInstanceOf(ExpenseParserCapacityError);
  expect(error).toMatchObject({ status: 500 });
});
it.each([
  [null, 60], ['', 60], ['soon', 60], ['17', 17], ['2.2', 3], ['0', 1], ['99999', 3600],
  [new Date(1_000_000 + 42_000).toUTCString(), 42], [new Date(0).toUTCString(), 1],
])('reads retry-after %s as %i seconds', (header, seconds) => {
  expect(retryAfterSeconds(header, 1_000_000)).toBe(seconds);
});
