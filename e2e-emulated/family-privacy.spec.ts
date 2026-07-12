import { test, expect } from '@playwright/test';
import { login } from './helpers';
import { BOB } from './constants';

/**
 * The security headline: a family member sees another member's SHARED
 * entries but never their secret expenses or private goals. Alice (seeded)
 * has one shared + one secret expense, and one shared + one private goal;
 * Bob is in her family and must see only the shared ones.
 */
test.describe('family privacy (emulated)', () => {
  test('family expenses view hides secret expenses', async ({ page }) => {
    await login(page, BOB.email);
    await page.goto('/expenses');

    // Switch to the Family view (visible because the family has 2 members)
    await page.getByRole('button', { name: 'Family', exact: true }).click();

    // Alice's shared expense is visible; her secret one never is
    await expect(page.getByText('Shufersal').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('PrivateClinic')).toHaveCount(0);
  });

  test('family savings view hides private goals', async ({ page }) => {
    await login(page, BOB.email);
    await page.goto('/savings');

    await page.getByRole('button', { name: 'Family', exact: true }).click();

    await expect(page.getByText('Family Trip').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Surprise Gift')).toHaveCount(0);
  });
});
