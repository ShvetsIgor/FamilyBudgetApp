/**
 * Shared constants for the emulated (authenticated) E2E suite.
 * The `demo-` project prefix makes the Firebase SDK treat it as emulator-only —
 * it can never reach real GCP even if a host were misconfigured.
 */
export const E2E_PROJECT_ID = 'demo-family-budget';
export const AUTH_EMULATOR = 'http://127.0.0.1:9099';
export const FIRESTORE_EMULATOR_HOST = '127.0.0.1';
export const FIRESTORE_EMULATOR_PORT = 8090;

export const PASSWORD = 'e2e-password-123';

export const ALICE = { email: 'alice@e2e.test', name: 'Alice' };
export const BOB = { email: 'bob@e2e.test', name: 'Bob' };
