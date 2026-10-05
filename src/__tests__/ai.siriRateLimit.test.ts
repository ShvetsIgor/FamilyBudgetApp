// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), doc: vi.fn(), runTransaction: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/firebaseAdmin', () => ({ getAdminDb: () => mock }));
import { consumeSiriQuota } from '@/features/ai/siriRateLimit';
const now = 1_000_000;
beforeEach(() => {
  vi.resetAllMocks(); mock.doc.mockReturnValue('ref');
  mock.runTransaction.mockImplementation(async (fn) => fn(mock));
  mock.get.mockResolvedValue({ data: () => undefined });
});
it('creates bounded account windows for the first attempt', async () => {
  expect(await consumeSiriQuota('alice', now)).toEqual({ allowed: true });
  expect(mock.doc).toHaveBeenCalledWith('users/alice/shortcutUsage/rateLimit');
  expect(mock.set).toHaveBeenCalledWith('ref', { minute: { count: 1, resetAt: now + 60_000 }, day: { count: 1, resetAt: now + 86_400_000 } });
});
it.each([
  [10, 20, 60], [2, 100, 3600], [10, 100, 3600],
])('denies exhausted windows without consuming additional quota', async (minuteCount, dayCount, retryAfter) => {
  mock.get.mockResolvedValue({ data: () => ({ minute: { count: minuteCount, resetAt: now + 60_000 }, day: { count: dayCount, resetAt: now + 3_600_000 } }) });
  expect(await consumeSiriQuota('alice', now)).toEqual({ allowed: false, retryAfter });
  expect(mock.set).not.toHaveBeenCalled();
});
it('resets an expired minute without resetting the daily total', async () => {
  mock.get.mockResolvedValue({ data: () => ({ minute: { count: 10, resetAt: now }, day: { count: 50, resetAt: now + 100_000 } }) });
  expect(await consumeSiriQuota('alice', now)).toEqual({ allowed: true });
  expect(mock.set).toHaveBeenCalledWith('ref', { minute: { count: 1, resetAt: now + 60_000 }, day: { count: 51, resetAt: now + 100_000 } });
});
it('resets both expired windows', async () => {
  mock.get.mockResolvedValue({ data: () => ({ minute: { count: 10, resetAt: now - 1 }, day: { count: 100, resetAt: now } }) });
  expect(await consumeSiriQuota('alice', now)).toEqual({ allowed: true });
});
it('propagates storage failure rather than allowing an unmetered call', async () => {
  mock.get.mockRejectedValue(new Error('offline'));
  await expect(consumeSiriQuota('alice', now)).rejects.toThrow('offline');
  expect(mock.set).not.toHaveBeenCalled();
});
