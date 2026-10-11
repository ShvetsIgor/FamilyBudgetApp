import path from 'node:path';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { format } from 'date-fns';
import { ALICE, AUTH_EMULATOR, E2E_PROJECT_ID, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT, PASSWORD } from './constants';
import { cardFor, login } from './helpers';

// Real auth, chat and Firestore writes; only the Groq-backed parse responses are stubbed.
const base = `http://${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`;
const owner = { Authorization: 'Bearer owner' };
const today = format(new Date(), 'yyyy-MM-dd');
const draft = (over: Record<string, unknown>) => ({
  type: 'expense', currency: 'ILS', date: today, confidence: 0.95, needsClarification: false,
  clarificationQuestion: null, suggestedCategoryName: null, merchant: null, ...over,
});

async function send(page: Page, text: string) {
  const composer = page.getByPlaceholder('Add expense…').filter({ visible: true });
  await composer.fill(text);
  await composer.press('Enter');
}
async function aliceUid(request: APIRequestContext) {
  const res = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    { data: { email: ALICE.email, password: PASSWORD, returnSecureToken: true } });
  return (await res.json()).localId as string;
}
async function expenses(request: APIRequestContext, uid: string) {
  return ((await (await request.get(`${base}/expenses/${uid}/items?pageSize=200`, { headers: owner })).json()).documents ?? []) as
    { fields: Record<string, { stringValue?: string; integerValue?: string; doubleValue?: number; arrayValue?: { values?: { mapValue: { fields: Record<string, { stringValue?: string; doubleValue?: number; integerValue?: string }> } }[] } }> }[];
}
const amountOf = (field?: { integerValue?: string; doubleValue?: number }) => Number(field?.integerValue ?? field?.doubleValue);

test('one message with two purchases becomes two confirmable expenses', async ({ page, request }) => {
  const uid = await aliceUid(request);
  const before = (await expenses(request, uid)).length;
  let calls = 0;
  await page.route('**/api/chat/parse-expense', async (route) => {
    calls += 1;
    await route.fulfill({ json: { ok: true, expenses: [
      draft({ amount: 12, description: 'Bread', categoryId: 'cat-groceries' }),
      draft({ amount: 18, description: 'Massage', categoryId: 'cat-therapy' }),
    ] } });
  });
  await login(page, ALICE.email);
  await send(page, 'bread 12, massage 18');
  await expect(page.getByText('Expenses in this message: 2 — confirm each one.').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Bread · 12 ₪').filter({ visible: true })).toBeVisible();
  await expect(page.getByText('Massage · 18 ₪').filter({ visible: true })).toBeVisible();
  expect(calls).toBe(1);
  expect((await expenses(request, uid)).length).toBe(before); // nothing saved before confirmation

  // Both cards first: while the chat is still writing the second, a tap is ignored by design
  await expect(cardFor(page, '18 ₪')).toBeVisible();
  // Each purchase is confirmed on its own card
  await cardFor(page, '12 ₪').getByRole('button', { name: 'Groceries', exact: true }).click();
  await expect.poll(async () => (await expenses(request, uid)).length).toBe(before + 1);
  await cardFor(page, '18 ₪').getByRole('button', { name: 'Therapy', exact: true }).click();
  await expect.poll(async () => (await expenses(request, uid)).length).toBe(before + 2);
  const recorded = (await expenses(request, uid)).map((e) => [amountOf(e.fields.amount), e.fields.categoryId.stringValue]);
  expect(recorded).toEqual(expect.arrayContaining([[12, 'cat-groceries'], [18, 'cat-therapy']]));
});

test('choosing a category teaches the word, and the next message offers it first', async ({ page, request }) => {
  const uid = await aliceUid(request);
  await page.route('**/api/chat/parse-expense', (route) => route.fulfill({ json: { ok: true, expense:
    draft({ amount: Number(route.request().postDataJSON().text.match(/\d+/)[0]), description: 'Shmulik', categoryId: 'cat-groceries' }) } }));
  await login(page, ALICE.email);
  await send(page, 'Шмулик 50');
  await expect(page.getByText('I’ll remember “шмулик” for next time').filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Category', exact: true }).filter({ visible: true }).last().click();
  await page.getByRole('button', { name: 'Without folder' }).filter({ visible: true }).click();
  await page.getByText('Therapy', { exact: true }).filter({ visible: true }).last().click();
  await expect.poll(async () => (await (await request.get(`${base}/users/${uid}/learnedKeywords/шмулик`, { headers: owner })).json())
    .fields?.categoryId?.stringValue).toBe('cat-therapy');

  await send(page, 'шмулик 70');
  await expect(page.getByText('70 ₪', { exact: true }).filter({ visible: true })).toBeVisible();
  const chips = cardFor(page, '70 ₪').getByRole('button', { name: /^(Therapy|Groceries)$/ });
  await expect(chips).toHaveText(['Therapy', 'Groceries']); // the taught category leads the model's guess
  await chips.first().click();
  await expect(page.getByText('70 ₪', { exact: true }).filter({ visible: true })).toHaveCount(0);
});

test('a receipt photo becomes one expense split across confirmed categories', async ({ page, request }) => {
  const uid = await aliceUid(request);
  let received = '';
  await page.route('**/api/chat/parse-receipt', async (route) => {
    received = route.request().postDataJSON().image;
    await route.fulfill({ json: { ok: true, receipt: {
      merchant: 'Shufersal Deal', date: today, currency: 'ILS', total: 76.1,
      groups: [
        { categoryId: 'cat-groceries', amount: 29.2, names: ['Milk', 'Bread', 'Bananas'] },
        { categoryId: null, amount: 46.9, names: ['Dish soap', 'Coffee'] },
      ],
    } } });
  });
  await login(page, ALICE.email);
  await page.getByTestId('receipt-photo-input').first().setInputFiles(path.join(__dirname, '../ai-evals/fixtures/receipt-shufersal.jpg'));

  await expect(page.getByText('Shufersal Deal').filter({ visible: true })).toBeVisible();
  expect(received).toMatch(/^data:image\/jpeg;base64,/); // compressed on the device, sent as JPEG
  const save = page.getByRole('button', { name: /^Save ₪/ }).filter({ visible: true });
  await expect(save).toBeDisabled();

  await page.getByRole('button', { name: 'Choose a category' }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Without folder' }).filter({ visible: true }).click();
  await page.getByText('Therapy', { exact: true }).filter({ visible: true }).last().click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Receipt · 2 categories').filter({ visible: true })).toBeVisible();

  const saved = (await expenses(request, uid)).find((e) => e.fields.store?.stringValue === 'Shufersal Deal');
  expect(saved).toBeTruthy();
  expect(amountOf(saved!.fields.amount)).toBe(76.1);
  expect(saved!.fields.categoryId.stringValue).toBe('cat-therapy'); // the largest group leads
  const splits = saved!.fields.splits.arrayValue?.values?.map((v) => [v.mapValue.fields.categoryId.stringValue, amountOf(v.mapValue.fields.amount)]);
  expect(splits).toEqual([['cat-groceries', 29.2]]);

  await page.reload();
  await expect(page.getByText('Receipt · 2 categories').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Save ₪/ })).toHaveCount(0);
});
