import { seedEmulators } from './seed';

/**
 * Playwright globalSetup — runs once before the emulated suite. The emulators
 * are started fresh by `firebase emulators:exec`, so we just seed them.
 */
export default async function globalSetup() {
  await seedEmulators();
}
