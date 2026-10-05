// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const verify = vi.hoisted(() => vi.fn());
vi.mock('@/shared/lib/firebaseAdmin', () => ({ getAdminAuth: () => ({ verifyIdToken: verify }) }));
import { resolveChatAuthorization } from '@/features/ai/chatAuth';

beforeEach(() => vi.resetAllMocks());
it.each([null, '', 'Basic token', 'Bearer ', `Bearer ${'a'.repeat(8193)}`])('rejects missing/malformed authorization', async (header) => {
  expect(await resolveChatAuthorization(header)).toBeNull();
  expect(verify).not.toHaveBeenCalled();
});
it('uses the verified Firebase uid and checks revocation', async () => {
  verify.mockResolvedValue({ uid: 'alice' });
  expect(await resolveChatAuthorization('Bearer signed-id-token')).toBe('alice');
  expect(verify).toHaveBeenCalledWith('signed-id-token', true);
});
it.each(['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'])(
  'treats %s as unauthorized', async (code) => {
    verify.mockRejectedValue({ code });
    expect(await resolveChatAuthorization('Bearer token')).toBeNull();
  },
);
it('distinguishes infrastructure failure from invalid credentials', async () => {
  verify.mockRejectedValue(new Error('network unavailable'));
  await expect(resolveChatAuthorization('Bearer token')).rejects.toThrow();
});
