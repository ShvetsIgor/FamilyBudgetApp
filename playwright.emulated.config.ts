import { defineConfig, devices } from '@playwright/test';

/**
 * Authenticated E2E against the Firebase emulators. Booted by
 * `npm run test:e2e:emulated`, which builds the app with the emulator flag,
 * then wraps this run in `firebase emulators:exec` so Auth + Firestore
 * emulators are live. globalSetup seeds users and family data.
 *
 * Runs on a dedicated port so it never reuses a normal (non-emulated) build.
 */
export default defineConfig({
  testDir: './e2e-emulated',
  testMatch: '**/*.spec.ts',
  globalSetup: './e2e-emulated/global-setup.ts',
  timeout: 45_000,
  fullyParallel: false, // shared emulator state — keep specs sequential
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'on-first-retry',
    // The app is mobile-first (bottom nav, single-column lists); test at a
    // phone width so the primary layouts render.
    viewport: { width: 390, height: 844 },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: 'npm run start -- -p 3100',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
