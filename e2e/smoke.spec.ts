import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('login page renders the auth form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('register page renders', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('unauthenticated visit to /home redirects to login', async ({ page }) => {
    await page.goto('/home');
    await page.waitForURL('**/auth/login', { timeout: 15_000 });
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('unauthenticated visit to /expenses redirects to login', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForURL('**/auth/login', { timeout: 15_000 });
  });

  test('PWA manifest is served with shortcuts', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.name).toBe('Family Budget');
    expect(manifest.shortcuts?.length).toBeGreaterThanOrEqual(3);
  });

  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/definitely-not-a-page');
    await expect(page.getByText('404')).toBeVisible();
  });
});
