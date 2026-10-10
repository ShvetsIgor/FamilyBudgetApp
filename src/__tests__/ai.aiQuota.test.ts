// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), doc: vi.fn(), runTransaction: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/firebaseAdmin', () => ({ getAdminDb: () => mock }));
import { aiGlobalLimits, consumeAiQuota, consumeChatRequestQuota, recordAiCooldown } from '@/features/ai/siriRateLimit';

const now = 1_000_000;
const OWNER = 'users/alice/shortcutUsage/rateLimit';
const GLOBAL = 'aiUsage/global';
const windows = (minute: number, day: number) => ({
  minute: { count: minute, resetAt: now + 30_000 }, day: { count: day, resetAt: now + 3_600_000 },
});
let stored: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks(); stored = {};
  mock.doc.mockImplementation((path: string) => path);
  mock.runTransaction.mockImplementation(async (fn) => fn(mock));
  mock.get.mockImplementation(async (path: string) => ({ data: () => stored[path] }));
});
afterEach(() => vi.unstubAllEnvs());

it('counts the owner and the global windows together', async () => {
  stored = { [OWNER]: windows(3, 30), [GLOBAL]: windows(12, 400) };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: true });
  expect(mock.set).toHaveBeenCalledWith(OWNER, windows(4, 31));
  expect(mock.set).toHaveBeenCalledWith(GLOBAL, windows(13, 401));
});
it('leaves the owner windows untouched when the global ceiling denies', async () => {
  stored = { [OWNER]: windows(3, 30), [GLOBAL]: windows(30, 400) };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: false, reason: 'global', retryAfter: 30 });
  expect(mock.set).not.toHaveBeenCalled();
});
it('leaves the global windows untouched when the owner limit denies', async () => {
  stored = { [OWNER]: windows(3, 100), [GLOBAL]: windows(1, 1) };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: false, reason: 'owner', retryAfter: 3600 });
  expect(mock.set).not.toHaveBeenCalled();
});
it('takes the global ceiling from the environment', async () => {
  vi.stubEnv('AI_GLOBAL_LIMIT_PER_MINUTE', '2');
  stored = { [GLOBAL]: windows(2, 2) };
  expect(await consumeAiQuota('alice', now)).toMatchObject({ allowed: false, reason: 'global' });
});
it('fails closed on a corrupt global document', async () => {
  stored = { [GLOBAL]: { minute: { count: -1, resetAt: now } } };
  await expect(consumeAiQuota('alice', now)).rejects.toThrow('Invalid quota state');
  expect(mock.set).not.toHaveBeenCalled();
});
it.each([
  [{}, 30, 1000],
  [{ AI_GLOBAL_LIMIT_PER_MINUTE: '45', AI_GLOBAL_LIMIT_PER_DAY: ' 2000 ' }, 45, 2000],
  [{ AI_GLOBAL_LIMIT_PER_MINUTE: '0', AI_GLOBAL_LIMIT_PER_DAY: '-5' }, 30, 1000],
  [{ AI_GLOBAL_LIMIT_PER_MINUTE: '1.5', AI_GLOBAL_LIMIT_PER_DAY: '1e3' }, 30, 1000],
  [{ AI_GLOBAL_LIMIT_PER_MINUTE: 'many', AI_GLOBAL_LIMIT_PER_DAY: '9007199254740993' }, 30, 1000],
  [{ AI_GLOBAL_LIMIT_PER_MINUTE: '', AI_GLOBAL_LIMIT_PER_DAY: '0x10' }, 30, 1000],
])('parses global limits defensively: %o', (env, perMinute, perDay) => {
  expect(aiGlobalLimits(env)).toEqual({ perMinute, perDay });
});

it('meters chat requests in their own server-only document', async () => {
  expect(await consumeChatRequestQuota('alice', now)).toEqual({ allowed: true });
  expect(mock.doc).toHaveBeenCalledExactlyOnceWith('users/alice/shortcutUsage/chatRequests');
  expect(mock.set).toHaveBeenCalledWith('users/alice/shortcutUsage/chatRequests', {
    minute: { count: 1, resetAt: now + 60_000 }, day: { count: 1, resetAt: now + 86_400_000 } });
});
it.each([[30, 10, 30], [5, 300, 3600]])('denies chat requests at 30/minute and 300/day', async (minute, day, retryAfter) => {
  stored = { 'users/alice/shortcutUsage/chatRequests': windows(minute, day) };
  expect(await consumeChatRequestQuota('alice', now)).toEqual({ allowed: false, retryAfter });
  expect(mock.set).not.toHaveBeenCalled();
});

it('reports the meter the caller waits longest for: owner minute full, global day full', async () => {
  stored = { [OWNER]: windows(10, 30), [GLOBAL]: windows(12, 1000) };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: false, reason: 'global', retryAfter: 3600 });
  expect(mock.set).not.toHaveBeenCalled();
});
it('keeps the owner as the reason on an equal wait', async () => {
  stored = { [OWNER]: windows(10, 30), [GLOBAL]: windows(30, 400) };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: false, reason: 'owner', retryAfter: 30 });
});
it('denies as global during a stored Groq cooldown without counting any window', async () => {
  stored = { [OWNER]: windows(3, 30), [GLOBAL]: { ...windows(12, 400), blockedUntil: now + 42_500 } };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: false, reason: 'global', retryAfter: 43 });
  expect(mock.set).not.toHaveBeenCalled();
});
it('denies on a cooldown stored before any global window exists', async () => {
  stored = { [GLOBAL]: { blockedUntil: now + 5_000 } };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: false, reason: 'global', retryAfter: 5 });
  expect(mock.set).not.toHaveBeenCalled();
});
it('counts again once the cooldown has passed', async () => {
  stored = { [OWNER]: windows(3, 30), [GLOBAL]: { ...windows(12, 400), blockedUntil: now } };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: true });
  expect(mock.set).toHaveBeenCalledWith(OWNER, windows(4, 31));
  expect(mock.set).toHaveBeenCalledWith(GLOBAL, windows(13, 401));
});
it.each([Number.POSITIVE_INFINITY, Number.NaN, String(now + 60_000), null])(
  'ignores a malformed cooldown %s', async (blockedUntil) => {
    stored = { [GLOBAL]: { ...windows(12, 400), blockedUntil } };
    expect(await consumeAiQuota('alice', now)).toEqual({ allowed: true });
  });
it('ignores a cooldown on the owner document: only the global meter honours one', async () => {
  stored = { [OWNER]: { ...windows(3, 30), blockedUntil: now + 60_000 } };
  expect(await consumeAiQuota('alice', now)).toEqual({ allowed: true });
});
it('stores a Groq cooldown as a merge write on the global document', async () => {
  const set = vi.fn().mockResolvedValue(undefined);
  mock.doc.mockReturnValue({ set });
  await recordAiCooldown(20, now);
  expect(mock.doc).toHaveBeenCalledExactlyOnceWith(GLOBAL);
  expect(set).toHaveBeenCalledExactlyOnceWith({ blockedUntil: now + 20_000 }, { merge: true });
  expect(mock.runTransaction).not.toHaveBeenCalled();
});
it('swallows cooldown write failures', async () => {
  mock.doc.mockReturnValue({ set: () => Promise.reject(new Error('offline')) });
  await expect(recordAiCooldown(20, now)).resolves.toBeUndefined();
  mock.doc.mockImplementation(() => { throw new Error('admin init'); });
  await expect(recordAiCooldown(20, now)).resolves.toBeUndefined();
});
