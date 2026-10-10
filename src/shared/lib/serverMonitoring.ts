import 'server-only';
import * as Sentry from '@sentry/nextjs';

export type MonitoredRoute = 'chat_parse' | 'siri_expense';
export type FailureStage = 'auth' | 'request_check' | 'rate_limit' | 'context' | 'parser' | 'save';

const SAFE_TOKEN = /^[A-Za-z0-9_-]{1,64}$/;
const CAPACITY_REPORT_INTERVAL = 600_000;
let lastCapacityReport = -Infinity;

const token = (value: unknown) =>
  (typeof value === 'string' || typeof value === 'number') && SAFE_TOKEN.test(String(value)) ? String(value) : undefined;

function describe(error: unknown) {
  if (typeof error !== 'object' || error === null) return { name: error === null ? 'null' : typeof error, code: undefined, stack: '' };
  const record = error as Record<string, unknown>;
  const stack = typeof record.stack === 'string' ? record.stack : '';
  // V8 opens the stack with "Name: message", and a message may span lines.
  const header = `${String(record.name)}${record.message ? `: ${String(record.message)}` : ''}`;
  return {
    name: token((record.constructor as { name?: unknown } | undefined)?.name) ?? 'UnknownError',
    code: token(record.code) ?? token(record.status),
    stack: (stack.startsWith(header) ? stack.slice(header.length) : stack)
      .split('\n').filter((line) => /^\s+at\s/.test(line)).join('\n'),
  };
}

/**
 * Routes answer these failures with 503, so onRequestError never sees them.
 * Only route, stage, error class and a short code leave the server: messages
 * can hold Firestore paths with the uid, provider bodies or the user's text.
 */
export function reportServerFailure({ route, stage, error }: {
  route: MonitoredRoute; stage: FailureStage; error: unknown;
}): void {
  try {
    const { name, code, stack } = describe(error);
    const sanitized = new Error(`${route} ${stage} failed${code ? ` (${code})` : ''}`);
    sanitized.name = name;
    sanitized.stack = `${name}: ${sanitized.message}${stack ? `\n${stack}` : ''}`;
    Sentry.captureException(sanitized, {
      level: 'error', tags: { route, stage }, fingerprint: [route, stage, name, code ?? 'none'],
    });
  } catch { /* monitoring must never change the response */ }
}

/**
 * A Groq 429 is expected on the free tier: its token caps (~8K/minute,
 * ~200K/day) usually bind before the request-based global ceiling, and the
 * routes then store Groq's Retry-After as a cooldown so nobody calls it again
 * until it ends. Still worth watching how often that happens — one warning per
 * instance every 10 minutes, not one per request in the middle of a spike.
 */
export function reportProviderCapacity(route: MonitoredRoute, now = Date.now()): void {
  try {
    if (now - lastCapacityReport < CAPACITY_REPORT_INTERVAL) return;
    lastCapacityReport = now;
    Sentry.captureMessage('AI provider capacity reached', {
      level: 'warning', tags: { route, stage: 'parser' }, fingerprint: ['ai_provider_capacity'],
    });
  } catch { /* see reportServerFailure */ }
}
