import { test, expect } from '@playwright/test';
import { ERIN } from './constants';
import { login } from './helpers';

// Erin spends in ten categories, ₪10…₪100, ₪550 in total.
test('the month lists every category, not just the largest eight', async ({ page }) => {
  await login(page, ERIN.email);
  await page.goto('/statistics');
  for (let i = 1; i <= 10; i += 1) {
    await expect(page.getByText(`Erin ${i}`, { exact: true }).filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
  }
});

test('the analytics total covers the whole period, not its top six', async ({ page }) => {
  await login(page, ERIN.email);
  await page.goto('/analytics');
  // The top six alone would read ₪450
  const card = page.locator('div', { has: page.getByText(/^Total spend/) }).filter({ visible: true }).last();
  await expect(card).toContainText(/₪\s*550/, { timeout: 20_000 });
});
