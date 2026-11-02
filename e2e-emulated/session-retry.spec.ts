import { test, expect } from '@playwright/test';
import { BOB, FIRESTORE_EMULATOR_HOST, FIRESTORE_EMULATOR_PORT } from './constants';
import { login } from './helpers';

// A signed-in user whose profile cannot be read (no network, nothing cached)
// used to land on the login form as if the session were gone.
test('a failed account load keeps the session and recovers by itself', async ({ page, context }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, BOB.email);

  const firestore = new RegExp(`${FIRESTORE_EMULATOR_HOST.replaceAll('.', '\\.')}:${FIRESTORE_EMULATOR_PORT}`);
  await context.route(firestore, (route) => route.abort());
  await page.goto('/budget');

  const notice = page.getByRole('alert').filter({ hasText: 'Can’t reach the server' });
  await expect(notice).toBeVisible({ timeout: 30_000 });
  expect(new URL(page.url()).pathname).toBe('/budget');
  await expect(page.locator('#login-email')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

  // No reload, no tap: the retry finds the network back
  await context.unroute(firestore);
  await expect(page.locator('main')).toHaveCount(1, { timeout: 60_000 });
  await expect(notice).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/budget');
});
