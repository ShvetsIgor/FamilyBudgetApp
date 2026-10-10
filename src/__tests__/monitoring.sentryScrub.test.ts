import { expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent } from '@/shared/lib/sentryScrub';

it('removes bodies, cookies, query strings, credentials and identity from events', () => {
  const event = scrubEvent({
    type: undefined,
    request: {
      url: 'https://app.test/api/chat/parse-expense?token=abc#frag', method: 'POST',
      data: '{"text":"Купил молоко 25"}', cookies: { session: 'x' }, query_string: 'token=abc', env: { REMOTE_ADDR: '1.2.3.4' },
      headers: {
        Authorization: 'Bearer secret', COOKIE: 'a=b', 'x-firebase-appcheck-token': 't', 'X-Api-Key': 'k',
        'x-forwarded-for': '1.2.3.4', 'x-vercel-ip-city': 'Haifa', referer: 'https://app.test/expenses?q=milk',
        'content-type': 'application/json', 'user-agent': 'Safari',
      },
    },
    user: { id: 'opaque', ip_address: '1.2.3.4', email: 'a@b.c', username: 'alice' },
    breadcrumbs: [{ category: 'fetch', data: { url: '/api?x=1', method: 'POST', status_code: 503, body: 'secret' } }],
  } as ErrorEvent);
  expect(event.request).toEqual({
    url: 'https://app.test/api/chat/parse-expense', method: 'POST',
    headers: { referer: 'https://app.test/expenses', 'content-type': 'application/json', 'user-agent': 'Safari' },
  });
  expect(event.user).toEqual({ id: 'opaque' });
  expect(event.breadcrumbs).toEqual([{ category: 'fetch', data: { url: '/api', method: 'POST', status_code: 503 } }]);
});
it('leaves events without request or user alone', () => {
  const event = { type: undefined, message: 'x' } as ErrorEvent;
  expect(scrubEvent(event)).toEqual({ type: undefined, message: 'x' });
});
it.each(['http', 'fetch', 'xhr'])('keeps only url, method and status for %s breadcrumbs', (category) => {
  expect(scrubBreadcrumb({ category, data: { url: 'https://api.test/a?key=1', method: 'GET', status_code: 200,
    request_body_size: 10, 'http.query': '?key=1', response: 'body' } }))
    .toEqual({ category, data: { url: 'https://api.test/a', method: 'GET', status_code: 200 } });
});
it('strips query strings from navigation breadcrumbs', () => {
  expect(scrubBreadcrumb({ category: 'navigation', data: { from: '/a?x=1', to: '/b?y=2' } }))
    .toEqual({ category: 'navigation', data: { from: '/a', to: '/b' } });
});
it('passes other breadcrumbs through', () => {
  const crumb = { category: 'ui.click', message: 'button' };
  expect(scrubBreadcrumb(crumb)).toBe(crumb);
});
it('drops console text that the SDK copies into message as well as arguments', () => {
  const error = 'FirebaseError: Missing permissions at users/uid-secret-123/expenses Купил молоко 25';
  // Shape built by @sentry/browser integrations/breadcrumbs.js: message = safeJoin(args, ' ').
  const crumb = { category: 'console', level: 'error' as const, timestamp: 1_700_000_000,
    message: `Save failed ${error}`, data: { arguments: ['Save failed', error], logger: 'console' } };
  const scrubbed = scrubBreadcrumb(crumb);
  expect(scrubbed).toEqual({ category: 'console', level: 'error', timestamp: 1_700_000_000, data: { logger: 'console' } });
  for (const fragment of ['Save failed', 'uid-secret-123', 'молоко', 'Missing permissions']) {
    expect(JSON.stringify(scrubbed)).not.toContain(fragment);
  }
  expect(scrubBreadcrumb(scrubbed)).toEqual(scrubbed);
});
it('drops console text even when the breadcrumb carries no data', () => {
  expect(scrubBreadcrumb({ category: 'console', level: 'log', message: 'users/uid-1/x' }))
    .toEqual({ category: 'console', level: 'log' });
});
it('scrubs console breadcrumbs attached to events', () => {
  const event = scrubEvent({ type: undefined, breadcrumbs: [
    { category: 'console', level: 'warning', message: 'token abc', data: { arguments: ['token abc'], logger: 'console' } }],
  } as ErrorEvent);
  expect(JSON.stringify(event)).not.toContain('abc');
});
it('strips the query and hash from the Next.js request path context', () => {
  const event = scrubEvent({ type: undefined, contexts: { nextjs: {
    request_path: '/expenses/new?fromChat=true&amount=50&storeName=X#top', router_kind: 'App Router' } },
  } as ErrorEvent);
  expect(event.contexts?.nextjs).toEqual({ request_path: '/expenses/new', router_kind: 'App Router' });
  expect(scrubEvent({ type: undefined, contexts: { nextjs: { request_path: '/expenses/new?fromChat=true&amount=50&storeName=X' } } } as ErrorEvent)
    .contexts?.nextjs?.request_path).toBe('/expenses/new');
});
