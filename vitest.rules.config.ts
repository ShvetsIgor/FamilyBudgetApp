import { defineConfig } from 'vitest/config';
import path from 'path';

// Firestore security rules tests — run via `npm run test:rules`
// (firebase emulators:exec boots the emulator around this config).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['rules-tests/**/*.test.ts'],
    // Emulator round-trips are slow; rules assertions are many per test
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
