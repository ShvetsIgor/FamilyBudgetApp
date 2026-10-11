import { beforeEach, expect, test } from 'vitest';
import { parseExpenseItems } from '@/features/ai/expenseParser/parseExpenseText';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import type { Category } from '@/shared/types';

const todayKey = '2026-10-11';
// Keep this opt-in run below the provider's burst limits.
beforeEach(async () => { await new Promise((resolve) => setTimeout(resolve, 5_000)); });
const categories: Category[] = [
  ['groceries', 'Продукты'], ['fuel', 'Топливо'], ['coffee', 'Кофе'], ['bakery', 'Выпечка'],
].map(([id, name], order) => ({ id, name, order, userId: 'synthetic-eval', type: 'expense', icon: 'box', color: '#000000', isPrivate: false }));

const cases = [
  { text: 'хлеб 12, кофе 18', expected: [[12, 'ILS', 'bakery'], [18, 'ILS', 'coffee']] },
  { text: 'Кофе 20 шекелей и бензин 300 долларов', expected: [[20, 'ILS', 'coffee'], [300, 'USD', 'fuel']] },
  { text: 'Купила продукты в Шуферсале на 187 шекелей', expected: [[187, 'ILS', 'groceries']] },
] as const;

test.each(cases)('$text', async ({ text, expected }) => {
  const items = await parseExpenseItems({ text, categories, defaultCurrency: 'ILS', language: 'ru', todayKey });
  const valid = items.map((item) => validateParsedExpense(item, { categories, todayKey }));
  expect(valid.every((v) => v.valid), JSON.stringify(items)).toBe(true);
  expect(items.map((i) => [i.amount, i.currency, i.categoryId]), JSON.stringify(items)).toEqual(expected);
}, 30_000);
