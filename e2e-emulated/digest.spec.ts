import { test, expect } from '@playwright/test';
import { FRANK } from './constants';
import { login } from './helpers';

// Sent at mount, before anything had loaded, this read «free today» with no
// mention of yesterday's ₪137 — and it could not be sent again until tomorrow.
test('the morning digest counts yesterday on a cold start', async ({ page }) => {
  await login(page, FRANK.email);
  await page.getByRole('button', { name: 'Notifications' }).filter({ visible: true }).first().click();
  await expect(page.getByText(/Spent ₪\s*137 yesterday/).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
});
