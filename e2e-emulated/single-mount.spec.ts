import { test, expect } from '@playwright/test';
import { BOB } from './constants';
import { login } from './helpers';

// `display: none` stops painting, not React: AppShell used to mount every page
// twice, so each Firestore read, subscription and background job ran twice.
test('the page is mounted once per layout, and follows the width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, BOB.email);
  const composers = page.getByPlaceholder('Add expense…');
  await expect(composers).toHaveCount(1);
  await expect(composers).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(composers).toHaveCount(1);
  await expect(composers).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(composers).toHaveCount(1);
  await expect(composers).toBeVisible();
});
