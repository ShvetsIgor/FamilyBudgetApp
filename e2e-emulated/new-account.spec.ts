import { test, expect, type Page } from '@playwright/test';
import { format } from 'date-fns';
import { AUTH_EMULATOR, CAROL, DAVE, E2E_PROJECT_ID, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT, PASSWORD } from './constants';
import { login } from './helpers';

const base = `http://${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`;
const owner = { Authorization: 'Bearer owner' }; // emulator-only admin token

async function send(page: Page, text: string) {
  const composer = page.getByPlaceholder('Add expense…').filter({ visible: true });
  await composer.fill(text);
  await composer.press('Enter');
}

async function uidOf(request: import('@playwright/test').APIRequestContext, email: string) {
  const res = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    { data: { email, password: PASSWORD, returnSecureToken: true } });
  return res.ok() ? (await res.json()).localId as string : null;
}

test('a brand-new account sets up categories in chat and the ORIGINAL message is recorded', async ({ page, request }) => {
  const parsed: string[] = [];
  await page.route('**/api/chat/parse-expense', async (route) => {
    parsed.push(route.request().postDataJSON().text);
    await route.fulfill({ json: { ok: true, expense: {
      type: 'expense', amount: 20, currency: 'ILS', categoryId: 'coffee', date: format(new Date(), 'yyyy-MM-dd'),
      confidence: 0.95, needsClarification: false, clarificationQuestion: null, suggestedCategoryName: null,
      merchant: null, description: 'Coffee',
    } } });
  });
  const uid = await uidOf(request, CAROL.email);
  await login(page, CAROL.email);
  await send(page, 'coffee 20');

  const add = page.getByRole('button', { name: 'Add and record' }).filter({ visible: true });
  await expect(add).toBeVisible();
  expect(parsed).toEqual([]); // no AI round trip that could only refuse

  await add.click();
  await expect.poll(() => parsed).toEqual(['coffee 20']); // the ORIGINAL text, not retyped
  const categories = (await (await request.get(`${base}/categories/${uid}/expense`, { headers: owner })).json()).documents ?? [];
  expect(categories.map((d: { name: string }) => d.name.split('/').pop()).sort())
    .toEqual(['clothes', 'coffee', 'fuel', 'groceries', 'pharmacy', 'public_transport', 'restaurant', 'utilities']);

  await page.getByRole('button', { name: 'Coffee', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  const expenses = (await (await request.get(`${base}/expenses/${uid}/items`, { headers: owner })).json()).documents ?? [];
  expect(expenses).toHaveLength(1);
  expect(expenses[0].fields.categoryId.stringValue).toBe('coffee');
  expect(expenses[0].fields.amount.integerValue ?? expenses[0].fields.amount.doubleValue).toBe(expenses[0].fields.amount.integerValue ? '20' : 20);

  await page.reload();
  await expect(page.getByText('Categories added: 8').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add and record' })).toHaveCount(0);
  expect(parsed).toEqual(['coffee 20']); // reload re-runs nothing
});

test('a user deletes their account and everything they owned', async ({ page, request }) => {
  const uid = await uidOf(request, DAVE.email);
  expect(uid).toBeTruthy();
  await login(page, DAVE.email);
  await page.goto('/account');
  await page.getByRole('button', { name: 'Delete account' }).filter({ visible: true }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  const submit = dialog.getByRole('button', { name: 'Delete forever' });
  await expect(submit).toBeDisabled();
  await dialog.getByRole('textbox', { name: /Type/ }).fill('delete');
  await dialog.locator('input[type="password"]').fill(PASSWORD);
  await expect(submit).toBeEnabled();
  await submit.click();
  await page.waitForURL('**/auth/login', { timeout: 30_000 });

  for (const path of [`users/${uid}`, `budgets/${uid}`]) {
    expect((await request.get(`${base}/${path}`, { headers: owner })).status(), path).toBe(404);
  }
  for (const path of [`expenses/${uid}/items`, `categories/${uid}/expense`, `users/${uid}/shortcutTokens`]) {
    const docs = (await (await request.get(`${base}/${path}`, { headers: owner })).json()).documents ?? [];
    expect(docs, path).toHaveLength(0);
  }
  expect(await uidOf(request, DAVE.email)).toBeNull(); // the Auth user is gone too
});
