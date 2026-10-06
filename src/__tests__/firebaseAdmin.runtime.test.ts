// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('loads Firebase Auth and resolves RSA signing keys without require(esm) support', () => {
  // Vercel's runtime loader rejects the jwks-rsa -> jose@6 synchronous ESM
  // require even with Node 24. Vitest/native Node alone misses that cold-start
  // failure. Use a real CJS child with require(esm) disabled and no credentials.
  const output = execFileSync(process.execPath, ['--no-experimental-require-module', '-e', `
    require('firebase-admin/auth');
    const { generateKeyPairSync } = require('node:crypto');
    const { retrieveSigningKeys } = require('jwks-rsa/src/utils');
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const expected = publicKey.export({ type: 'spki', format: 'pem' });
    retrieveSigningKeys([{ ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' }])
      .then(keys => {
        if (keys.length !== 1 || keys[0].getPublicKey() !== expected || keys[0].kid !== 'test-key') process.exit(1);
        console.log('auth and signing keys OK');
      }).catch(() => process.exit(1));
  `], { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 });
  expect(output.trim()).toBe('auth and signing keys OK');
});
