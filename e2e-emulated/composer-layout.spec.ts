import { test, expect } from '@playwright/test';
import { BOB } from './constants';
import { login } from './helpers';

// The composer row (+, input pill with camera and «?», mic/send) must fit a
// phone: an <input> refuses to shrink below its intrinsic width unless told,
// and the camera button added to the pill pushed the send button off-line.
for (const width of [375, 390]) {
  test(`composer fits a ${width}px phone, idle and while typing`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await login(page, BOB.email);
    const composer = page.getByPlaceholder('Add expense…').filter({ visible: true });
    await expect(composer).toBeVisible();

    const check = async (lastButton: string) => {
      const row = await composer.evaluate((input) => {
        const bar = input.closest('div.flex.items-center.gap-2')!.parentElement!.closest('div.flex.items-center')!;
        return [...bar.querySelectorAll('button')].filter((b) => b.offsetParent !== null).map((b) => {
          const r = b.getBoundingClientRect();
          return { label: b.getAttribute('aria-label') ?? b.textContent ?? '', left: r.left, right: r.right, top: r.top, bottom: r.bottom };
        });
      });
      const pill = await composer.evaluate((input) => input.parentElement!.getBoundingClientRect().toJSON());
      const last = row.at(-1)!;
      expect(last.label, JSON.stringify(row)).toBe(lastButton);
      for (const button of row) expect(button.right, JSON.stringify(button)).toBeLessThanOrEqual(width);
      // Vertically centred on the pill, not pushed below or above it
      expect(Math.abs((last.top + last.bottom) / 2 - (pill.top + pill.bottom) / 2), JSON.stringify({ last, pill })).toBeLessThan(3);
      expect(last.left).toBeGreaterThanOrEqual(pill.right);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    };
    await check('Voice input');
    await composer.fill('кофе 20');
    await check('Send');
  });
}
