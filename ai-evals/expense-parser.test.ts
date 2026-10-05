import { beforeEach, expect, test } from 'vitest';
import { parseExpenseText } from '@/features/ai/expenseParser/parseExpenseText';
import { validateParsedExpense } from '@/features/ai/validateParsedExpense';
import type { Category } from '@/shared/types';

const todayKey = '2026-10-05';
// Keep this opt-in run below the provider's burst limits.
beforeEach(async () => { await new Promise((resolve) => setTimeout(resolve, 10_000)); });
const categories: Category[] = [
  ['groceries', 'Продукты'], ['fuel', 'Топливо'], ['coffee', 'Кофе'], ['utilities', 'Коммунальные'],
].map(([id, name], order) => ({ id, name, order, userId: 'synthetic-eval', type: 'expense', icon: 'box', color: '#000000', isPrivate: false }));

const cases = [
  { text: 'Купила продукты в Шуферсале на 187 шекелей', expected: { amount: 187, currency: 'ILS', categoryId: 'groceries', date: todayKey } },
  { text: 'Бензин на Паз 300 шекелей', expected: { amount: 300, currency: 'ILS', categoryId: 'fuel' } },
  { text: 'Кофе 18,50 шекелей', expected: { amount: 18.5, currency: 'ILS', categoryId: 'coffee' } },
  { text: 'Вчера заплатила за электричество 420 шекелей', expected: { amount: 420, currency: 'ILS', categoryId: 'utilities', date: '2026-10-04' } },
  { text: 'Coffee 5 US dollars', expected: { amount: 5, currency: 'USD', categoryId: 'coffee' } },
  { text: 'Groceries 42 Canadian dollars', expected: { amount: 42, currency: 'CAD', categoryId: 'groceries' } },
  { text: 'Кофе 350 рублей', expected: { amount: 350, currency: 'RUB', categoryId: 'coffee' } },
  { text: 'Ветеринар 250 шекелей', limitedCategories: true, expected: null },
  { text: 'Запиши 250 шекелей в категорию Ветеринар', limitedCategories: true, expected: null },
  { text: 'Ветеринар 250 шекелей, категория Ветеринар', activatedCategory: true, expected: { amount: 250, currency: 'ILS', categoryId: 'vet' } },
  { text: 'Купила продукты', expected: null },
  { text: 'Кофе 5 евро', expected: null },
  { text: 'Получила зарплату 10000 шекелей', expected: null },
  { text: 'Кофе 20 шекелей и бензин 300 шекелей', expected: null },
] as const;

test.each(cases)('$text', async (entry) => {
  const activeCategories = 'limitedCategories' in entry ? categories.slice(0, 1)
    : 'activatedCategory' in entry ? [...categories, { ...categories[0], id: 'vet', name: 'Ветеринар' }] : categories;
  const parsed = await parseExpenseText({
    text: entry.text, categories: activeCategories, defaultCurrency: 'ILS', language: 'ru', todayKey,
  });
  const result = validateParsedExpense(parsed, { categories: activeCategories, todayKey });
  if (entry.expected === null) {
    expect(result, JSON.stringify(parsed)).toMatchObject({ valid: false });
    if ('limitedCategories' in entry) {
      expect(parsed).toMatchObject({ categoryId: null, suggestedCategoryName: expect.any(String), needsClarification: true });
      expect(parsed.suggestedCategoryName?.length).toBeGreaterThan(0);
    }
  } else {
    expect(result, JSON.stringify(parsed)).toMatchObject({ valid: true, expense: entry.expected });
  }
});
