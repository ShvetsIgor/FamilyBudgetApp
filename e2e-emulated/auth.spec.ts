import { test, expect } from '@playwright/test';
import { login, logout } from './helpers';
import { ALICE, BOB } from './constants';

test.describe('authenticated flows (emulated)', () => {
  test('logs in and lands on /home', async ({ page }) => {
    await login(page, ALICE.email);
    await expect(page).toHaveURL(/\/home$/);
  });

  test('authenticated navigation renders the main screens', async ({ page }) => {
    await login(page, ALICE.email);

    for (const path of ['/expenses', '/budget', '/savings']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      // Must not bounce back to the login screen
      await expect(page.locator('#login-email')).toHaveCount(0);
    }
  });

  test('direct /budget refresh shows the budget controls without needing /home first', async ({ page }) => {
    await login(page, ALICE.email);
    // Navigate straight to /budget and hard-reload — the page must render its
    // own data without depending on having visited /home or /income (№12).
    await page.goto('/budget');
    await page.reload();
    await expect(page).toHaveURL(/\/budget$/);
    await expect(page.locator('#login-email')).toHaveCount(0);
    // The budget mode selector is always rendered on this page.
    await expect(page.getByText('Auto-calc').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Monthly limit').first()).toBeVisible();
  });

  test('two accounts in one browser stay isolated (no data leak)', async ({ page }) => {
    // Alice sees her shared expense
    await login(page, ALICE.email);
    await page.goto('/expenses');
    await expect(page.getByText('Shufersal').first()).toBeVisible({ timeout: 15_000 });

    // Switch to Bob — Alice's expense must be gone from his own list
    await logout(page);
    await login(page, BOB.email);
    await page.goto('/expenses');
    await expect(page.locator('#login-email')).toHaveCount(0);
    await expect(page.getByText('Shufersal')).toHaveCount(0);
  });
});

test('expense detail and editor load after a direct refresh', async ({ page }) => {
  await login(page, ALICE.email);
  await page.goto('/expenses/exp-shared');
  await page.reload();
  await expect(page.getByText('Shufersal').first()).toBeVisible({ timeout: 15_000 });
  await page.goto('/expenses/exp-shared/edit');
  await page.reload();
  await expect(page.locator('#login-email')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /save/i }).first()).toBeVisible({ timeout: 15_000 });
});

test('new registration reaches onboarding and survives a refresh', async ({ page }) => {
  await page.goto('/auth/register');
  await page.locator('#register-name').fill('New User');
  await page.locator('#register-email').fill(`new-${Date.now()}@example.test`);
  await page.locator('#register-password').fill('TestPassword123!');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
  await page.reload();
  await expect(page.locator('#login-email')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /начать|get started/i }).first()).toBeVisible({ timeout: 15_000 });
});
