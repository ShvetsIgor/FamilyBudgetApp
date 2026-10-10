import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs';

// Shared by the browser, Node and edge SDKs: type-only import, no runtime dependency.
const SECRET_HEADER = /^(authorization|proxy-authorization|cookie|set-cookie|forwarded|x-forwarded-for|x-real-ip)$|^x-vercel-|^x-.*(auth|token|key|secret|session|signature|csrf)/i;
const HTTP_CATEGORIES = new Set(['http', 'fetch', 'xhr']);

const withoutQuery = (url: unknown) => typeof url === 'string' ? url.split(/[?#]/, 1)[0] : url;

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const data = breadcrumb.data;
  if (breadcrumb.category === 'console') {
    // The SDK joins every argument into `message` too, so error text (Firestore
    // paths with the uid, user input) would survive dropping `arguments`. Keep
    // only the shape; scrubEvent re-runs this, so it must stay idempotent.
    const kept: Breadcrumb = { category: 'console' };
    if (breadcrumb.level !== undefined) kept.level = breadcrumb.level;
    if (breadcrumb.timestamp !== undefined) kept.timestamp = breadcrumb.timestamp;
    if (data?.logger !== undefined) kept.data = { logger: data.logger };
    return kept;
  }
  if (!data) return breadcrumb;
  if (breadcrumb.category && HTTP_CATEGORIES.has(breadcrumb.category)) {
    const kept: Record<string, unknown> = {};
    if (data.url !== undefined) kept.url = withoutQuery(data.url);
    if (data.method !== undefined) kept.method = data.method;
    if (data.status_code !== undefined) kept.status_code = data.status_code;
    return { ...breadcrumb, data: kept };
  }
  if (breadcrumb.category === 'navigation') {
    return { ...breadcrumb, data: { ...data, from: withoutQuery(data.from), to: withoutQuery(data.to) } };
  }
  return breadcrumb;
}

/** Request bodies, cookies, query strings, credentials and user identity never leave the device or server. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const request = event.request;
  if (request) {
    delete request.data;
    delete request.cookies;
    delete request.query_string;
    delete request.env;
    if (request.url) request.url = withoutQuery(request.url) as string;
    if (request.headers) {
      request.headers = Object.fromEntries(Object.entries(request.headers)
        .filter(([name]) => !SECRET_HEADER.test(name))
        .map(([name, value]) => [name, name.toLowerCase() === 'referer' ? withoutQuery(value) as string : value]));
    }
  }
  // Sentry.captureRequestError copies Next's req.url, query included.
  const nextjs = event.contexts?.nextjs;
  if (nextjs && typeof nextjs.request_path === 'string') nextjs.request_path = withoutQuery(nextjs.request_path);
  if (event.user) {
    delete event.user.ip_address;
    delete event.user.email;
    delete event.user.username;
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb);
  return event;
}
