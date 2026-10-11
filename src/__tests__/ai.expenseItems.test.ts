/**
 * Chat may send «хлеб 12, кофе 18»: the list parser asks for an `expenses`
 * array and sanitizes every item like a single expense. Siri's single parser
 * is untouched.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseExpenseItems } from '@/features/ai/expenseParser/parseExpenseText';

const CATEGORIES = [{ id: 'bakery', name: 'Выпечка' }, { id: 'coffee', name: 'Кофе' }];
const item = (over: Record<string, unknown> = {}) => ({
  type: 'expense', amount: 12, currency: null, merchant: null, description: 'Хлеб', categoryId: 'bakery',
  suggestedCategoryName: null, date: null, confidence: 0.9, needsClarification: false, clarificationQuestion: null, ...over,
});
const groq = (content: unknown) => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }) }) as Response;
const input = { text: 'хлеб 12, кофе 18', categories: CATEGORIES, defaultCurrency: 'ILS' as const, language: 'ru' as const, todayKey: '2026-10-11' };

beforeEach(() => { vi.stubEnv('GROQ_API_KEY', 'test-key'); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('parseExpenseItems', () => {
  it('requests the list schema and sanitizes each purchase', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(groq({ expenses: [
      item(), item({ description: 'Кофе', amount: 18, categoryId: 'coffee', currency: 'USD' }),
    ] }));
    const items = await parseExpenseItems(input);
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.response_format.json_schema.schema.properties.expenses.items.properties.categoryId.enum)
      .toEqual(['bakery', 'coffee', null]);
    expect(body.messages[0].content).toContain('separate purchase as its own item');
    expect(items.map((i) => [i.description, i.amount, i.currency, i.categoryId])).toEqual([
      ['Хлеб', 12, 'ILS', 'bakery'], ['Кофе', 18, 'USD', 'coffee'],
    ]);
  });

  it('treats an unwrapped single object as one expense', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(groq(item()));
    expect((await parseExpenseItems(input)).map((i) => i.amount)).toEqual([12]);
  });

  it('never lets an invented category through on any item', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(groq({ expenses: [item(), item({ categoryId: 'invented' })] }));
    const items = await parseExpenseItems(input);
    expect(items[1].categoryId).toBeNull();
    expect(items[1].needsClarification).toBe(true);
  });

  it('turns an empty or oversized list into one clarification', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(groq({ expenses: [] }))
      .mockResolvedValueOnce(groq({ expenses: Array.from({ length: 6 }, () => item()) }));
    const empty = await parseExpenseItems(input);
    expect(empty).toHaveLength(1);
    expect(empty[0].needsClarification).toBe(true);
    const tooMany = await parseExpenseItems(input);
    expect(tooMany).toHaveLength(1);
    expect(tooMany[0].clarificationQuestion).toContain('до 5');
  });
});
