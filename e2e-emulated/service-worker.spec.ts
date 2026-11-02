import { test, expect } from '@playwright/test';
import { ALICE, FIRESTORE_EMULATOR_PORT } from './constants';
import { login } from './helpers';

// Firestore responses are people's expenses, and its Listen channel is a
// long-lived stream: neither belongs in the service worker or its cache.
test('the worker leaves Firestore alone and clears what it cached before', async ({ page }) => {
  // What an already-installed app carries from the old rules, seeded before the worker activates
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    void caches.open('cross-origin').then((cache) => cache.put('https://firestore.example/stale', new Response('expenses')));
  });
  const viaWorker: string[] = [];
  page.on('response', (response) => {
    if (response.url().includes(`:${FIRESTORE_EMULATOR_PORT}`) && response.fromServiceWorker()) viaWorker.push(response.url());
  });

  await login(page, ALICE.email);
  await page.waitForFunction(() => navigator.serviceWorker?.controller?.state === 'activated', undefined, { timeout: 20_000 });

  // Controlled by the worker now: real Firestore traffic on a few full page loads
  for (const route of ['/expenses', '/budget', '/home']) {
    await page.goto(route);
    await expect(page.locator('main')).toHaveCount(1, { timeout: 20_000 });
  }
  await expect(page.getByPlaceholder('Add expense…').filter({ visible: true })).toBeVisible();

  expect(viaWorker).toEqual([]);
  await expect.poll(() => page.evaluate(() => caches.keys()), { timeout: 10_000 }).not.toContain('cross-origin');
});
