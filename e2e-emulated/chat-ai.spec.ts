import { test, expect, type Page } from '@playwright/test';
import { ALICE, E2E_PROJECT_ID, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT } from './constants';
import { login } from './helpers';
import { format } from 'date-fns';

// Real auth, chat persistence and expense writes against emulators; only Groq's
// HTTP response is stubbed, so this suite never spends provider quota.
const expense = { type: 'expense', amount: 25.5, currency: 'USD', categoryId: 'cat-groceries',
  date: format(new Date(), 'yyyy-MM-dd'), confidence: 0.95, needsClarification: false,
  clarificationQuestion: null, suggestedCategoryName: null, merchant: 'AI test market', description: 'Milk' };
async function send(page: Page, text: string) {
  const composer = page.getByPlaceholder('Add expense…').filter({ visible: true });
  await composer.fill(text);
  await composer.press('Enter');
}

test('AI draft stays unsaved until category confirmation, then survives reload with its currency', async ({ page, request }) => {
  let uid = '';
  await page.route('**/api/chat/parse-expense', async (route) => {
    const authorization = route.request().headers().authorization;
    expect(authorization).toMatch(/^Bearer /);
    uid = JSON.parse(Buffer.from(authorization.slice(7).split('.')[1], 'base64url').toString()).sub;
    expect(route.request().postDataJSON()).toMatchObject({ text: 'Milk twenty five dollars yesterday' });
    await route.fulfill({ json: { ok: true, expense } });
  });
  await login(page, ALICE.email);
  await send(page, 'Milk twenty five dollars yesterday');
  await expect(page.getByText('25.5 $', { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText(format(new Date(expense.date + 'T12:00:00'), 'd MMM yyyy'), { exact: true }).filter({ visible: true })).toBeVisible();
  const base = `http://${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`;
  const readExpenses = async () => (await (await request.get(`${base}/expenses/${uid}/items`, {
    headers: { Authorization: 'Bearer owner' }, // emulator-only admin token
  })).json()).documents ?? [];
  expect(await readExpenses()).toHaveLength(2); // only seeded expenses before confirmation
  await page.getByRole('button', { name: 'Groceries', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toHaveCount(0);
  const documents = await readExpenses();
  expect(documents).toHaveLength(3);
  const saved = documents.find((item: { fields: { store?: { stringValue: string } } }) => item.fields.store?.stringValue === expense.merchant);
  expect(saved.fields.currency.stringValue).toBe('USD');
  expect(saved.fields.amount.doubleValue).toBe(25.5);
  expect(saved.fields.comment.stringValue).toBe('Milk');
  const stats = await (await request.get(`${base}/monthlyStats/${uid}/months/${expense.date.slice(0, 7)}`, {
    headers: { Authorization: 'Bearer owner' },
  })).json();
  expect(stats.fields.totalsByCurrency.mapValue.fields.USD.doubleValue).toBe(25.5);
  expect(stats.fields.byCategoryByCurrency.mapValue.fields.USD.mapValue.fields['cat-groceries'].doubleValue).toBe(25.5);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await expect(page.getByText(/^\$\s*25.5$/).filter({ visible: true })).toBeVisible();
  await page.goto('/expenses');
  await expect(page.getByText(/\$\s*25\.5/).filter({ visible: true }).first()).toBeVisible();
});

test('Split carries the AI amount, currency and date into the entry form', async ({ page }) => {
  await page.route('**/api/chat/parse-expense', (route) => route.fulfill({ json: { ok: true, expense: { ...expense, merchant: 'Split test market' } } }));
  await login(page, ALICE.email);
  await send(page, 'Split groceries 25.5 dollars');
  await page.getByRole('button', { name: 'Split receipt', exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/expenses\/new\?/);
  expect(new URL(page.url()).searchParams.get('currency')).toBe('USD');
  expect(new URL(page.url()).searchParams.get('date')).toBe(expense.date);
  await expect(page.getByText('$25.5', { exact: true }).first()).toBeVisible();
  // Split opens its category picker immediately; dismiss it before the form.
  await page.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toHaveCount(0);
});

test('provider failure shows an actionable message instead of a guessed expense', async ({ page }) => {
  await page.route('**/api/chat/parse-expense', (route) => route.fulfill({ status: 503, json: { ok: false, error: 'parser_unavailable' } }));
  await login(page, ALICE.email);
  await send(page, 'Dinner 30 dollars');
  await expect(page.getByText('AI is temporarily unavailable. Expense not saved. Try later or add it manually using “+”.').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Groceries', exact: true })).toHaveCount(0);
});
