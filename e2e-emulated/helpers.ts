import { expect, type Page } from '@playwright/test';
import { PASSWORD } from './constants';

/** Drives the login form and waits for the app to land on /home. */
export async function login(page: Page, email: string) {
  await page.goto('/auth/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/home', { timeout: 20_000 });
}

/**
 * Signs out through the real UI (the account page's Sign Out button), which
 * calls Firebase signOut and lets the app's auth listener redirect to
 * /auth/login. Used to prove two accounts in one browser stay isolated.
 */
export async function logout(page: Page) {
  await page.goto('/account');
  // Sign Out asks for confirmation via window.confirm — accept it.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.waitForURL('**/auth/login', { timeout: 20_000 });
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 15_000 });
}

/**
 * The visible clarify card for one amount. Chat specs share Alice's chat, so a
 * page-wide «Groceries» can belong to another spec's card — scope to the card.
 */
export function cardFor(page: Page, amount: string) {
  return page.locator('div')
    .filter({ has: page.getByText(amount, { exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Split receipt', exact: true }) })
    .filter({ visible: true }).last();
}
