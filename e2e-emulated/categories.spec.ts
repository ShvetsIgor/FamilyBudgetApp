import { test, expect } from '@playwright/test';
import { AUTH_EMULATOR, BOB, E2E_PROJECT_ID, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT, PASSWORD } from './constants';
import { login } from './helpers';

const base = `http://${FIRESTORE_EMULATOR_HOST}:${FIRESTORE_EMULATOR_PORT}/v1/projects/${E2E_PROJECT_ID}/databases/(default)/documents`;

// Regression: Save in the category editor did nothing for a category without a
// folder — updateDoc rejected folderId: undefined and the error was swallowed.
test('editing a created category without a folder saves', async ({ page, request }) => {
  const uid = (await (await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key`,
    { data: { email: BOB.email, password: PASSWORD, returnSecureToken: true } })).json()).localId as string;
  await login(page, BOB.email);
  await page.goto('/categories');
  await page.getByRole('button', { name: 'Without folder' }).filter({ visible: true }).first().click();
  await page.getByText('Hobby', { exact: true }).filter({ visible: true }).first().click();

  const name = page.getByPlaceholder(/name/i).filter({ visible: true }).first();
  await expect(name).toHaveValue('Hobby');
  await name.fill('Hobby club');
  const save = page.getByRole('button', { name: 'Save', exact: true }).filter({ visible: true });
  await save.click();
  await expect(save).toHaveCount(0); // the sheet closed: the save went through

  const doc = await (await request.get(`${base}/categories/${uid}/expense/cat-hobby`, { headers: { Authorization: 'Bearer owner' } })).json();
  expect(doc.fields.name.stringValue).toBe('Hobby club');
  expect(doc.fields.folderId).toBeUndefined();
});
