// @vitest-environment node
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteApp, getApps, initializeApp } from 'firebase-admin/app';

// Next.js enforces this marker at build time; this test runs directly in Node.
vi.mock('server-only', () => ({}));

import { getAdminDb } from '@/shared/lib/firebaseAdmin';

// Real SDK initialization with a disposable key; no live credentials or reads.
const { privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const encodedKey = Buffer.from(privateKey).toString('base64');

beforeEach(() => {
  vi.stubEnv('FIREBASE_ADMIN_PROJECT_ID', 'demo-family-budget');
  vi.stubEnv('FIREBASE_ADMIN_CLIENT_EMAIL', 'test@demo-family-budget.iam.gserviceaccount.com');
  vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY_BASE64', encodedKey);
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'demo-family-budget');
});

afterEach(async () => {
  await Promise.all(getApps().map(deleteApp));
  vi.unstubAllEnvs();
});

describe('getAdminDb', () => {
  it('initializes lazily and reuses the database across calls and module reloads', async () => {
    expect(getApps()).toHaveLength(0);
    const db = getAdminDb();
    expect(getApps()[0].options.projectId).toBe('demo-family-budget');
    expect(getAdminDb()).toBe(db);

    vi.resetModules();
    const reloaded = await import('@/shared/lib/firebaseAdmin');
    expect(reloaded.getAdminDb()).toBe(db);
    expect(getApps()).toHaveLength(1);
  });

  it('does not reuse a different app already in the SDK registry', () => {
    initializeApp({ projectId: 'unrelated-project' }, 'unrelated');
    getAdminDb();
    expect(getApps().find((app) => app.name === 'family-budget-admin')?.options.projectId)
      .toBe('demo-family-budget');
    expect(getApps()).toHaveLength(2);
  });

  it.each([
    'FIREBASE_ADMIN_PROJECT_ID', 'FIREBASE_ADMIN_CLIENT_EMAIL', 'FIREBASE_ADMIN_PRIVATE_KEY_BASE64',
  ])('fails clearly when %s is missing and allows retry after configuration is fixed', (key) => {
    const value = process.env[key]!;
    vi.stubEnv(key, '');
    expect(() => getAdminDb()).toThrow('Firebase Admin requires');
    expect(getApps()).toHaveLength(0);
    vi.stubEnv(key, value);
    getAdminDb();
    expect(getApps()[0].options.projectId).toBe('demo-family-budget');
  });

  it('rejects a project mismatch before initializing', () => {
    vi.stubEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'another-project');
    expect(() => getAdminDb()).toThrow('Firebase Admin project must match');
    expect(getApps()).toHaveLength(0);
  });

  it('rejects corrupted base64 rather than silently ignoring invalid characters', () => {
    vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY_BASE64', encodedKey + '!');
    expect(() => getAdminDb()).toThrow('must contain valid base64');
    expect(getApps()).toHaveLength(0);
  });

  it('reports invalid PEM without exposing the credential', () => {
    const invalidKey = 'not-a-private-key-test-marker';
    vi.stubEnv('FIREBASE_ADMIN_PRIVATE_KEY_BASE64', Buffer.from(invalidKey).toString('base64'));
    expect(() => getAdminDb()).toThrow('Firebase Admin credentials are invalid. Check the service account email and encoded private key.');
    expect(getApps()).toHaveLength(0);
  });
});
