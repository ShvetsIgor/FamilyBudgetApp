// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const sentry = vi.hoisted(() => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@sentry/nextjs', () => sentry);
import { reportProviderCapacity, reportServerFailure } from '@/shared/lib/serverMonitoring';

const SECRETS = ['alice-uid-123', 'Bearer abcdef0123456789', 'Купил молоко 25', 'users/alice-uid-123'];
class FirestoreLikeError extends Error { code = 'unavailable'; }

beforeEach(() => vi.resetAllMocks());

function captured() {
  expect(sentry.captureException).toHaveBeenCalledOnce();
  const [error, context] = sentry.captureException.mock.calls[0];
  return { error: error as Error, context, serialized: JSON.stringify({ message: error.message, stack: error.stack, name: error.name, context }) };
}

it('sends a new error with route, stage, class and code only', () => {
  const original = new FirestoreLikeError(`14 UNAVAILABLE: users/alice-uid-123/categories for "Купил молоко 25" (Bearer abcdef0123456789)
    at fake (injected line alice-uid-123)`);
  reportServerFailure({ route: 'chat_parse', stage: 'context', error: original });
  const { error, context, serialized } = captured();
  expect(error).not.toBe(original);
  expect(error.message).toBe('chat_parse context failed (unavailable)');
  expect(error.name).toBe('FirestoreLikeError');
  expect(error.stack?.split('\n')[0]).toBe('FirestoreLikeError: chat_parse context failed (unavailable)');
  expect(error.stack).toContain('monitoring.serverFailure.test.ts');
  expect(error).not.toHaveProperty('cause');
  expect(context).toEqual({ level: 'error', tags: { route: 'chat_parse', stage: 'context' },
    fingerprint: ['chat_parse', 'context', 'FirestoreLikeError', 'unavailable'] });
  for (const secret of SECRETS) expect(serialized).not.toContain(secret);
});
it.each([
  [{ status: 500 }, '500'], [{ code: 14 }, '14'], [{ code: 'auth/internal-error' }, 'none'],
  [{ code: 'users/alice-uid-123' }, 'none'], [{ code: 'x'.repeat(65) }, 'none'],
])('keeps only short primitive codes: %o', (props, code) => {
  reportServerFailure({ route: 'siri_expense', stage: 'save', error: Object.assign(new Error('alice-uid-123'), props) });
  const { context, serialized } = captured();
  expect(context.fingerprint).toEqual(['siri_expense', 'save', 'Error', code]);
  for (const secret of SECRETS) expect(serialized).not.toContain(secret);
});
it.each([['Купил молоко 25', 'string'], [null, 'null'], [undefined, 'undefined'], [42, 'number']])(
  'handles a thrown non-error %s', (thrown, name) => {
    reportServerFailure({ route: 'chat_parse', stage: 'parser', error: thrown });
    const { error, serialized } = captured();
    expect(error.name).toBe(name);
    expect(serialized).not.toContain('Купил');
  },
);
it('never throws, even when the error or Sentry does', () => {
  const hostile = new Proxy({}, { get() { throw new Error('alice-uid-123'); } });
  expect(() => reportServerFailure({ route: 'chat_parse', stage: 'auth', error: hostile })).not.toThrow();
  sentry.captureException.mockImplementation(() => { throw new Error('transport'); });
  expect(() => reportServerFailure({ route: 'chat_parse', stage: 'auth', error: new Error('x') })).not.toThrow();
});
it('reports provider capacity as a throttled warning without data', () => {
  reportProviderCapacity('chat_parse', 10_000_000);
  reportProviderCapacity('siri_expense', 10_000_000 + 60_000);
  expect(sentry.captureMessage).toHaveBeenCalledExactlyOnceWith('AI provider capacity reached',
    { level: 'warning', tags: { route: 'chat_parse', stage: 'parser' }, fingerprint: ['ai_provider_capacity'] });
  reportProviderCapacity('siri_expense', 10_000_000 + 600_000);
  expect(sentry.captureMessage).toHaveBeenCalledTimes(2);
});
