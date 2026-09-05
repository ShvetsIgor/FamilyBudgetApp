import * as Sentry from '@sentry/nextjs';

// Client-side Sentry init. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set
// and the build is production, so local dev stays quiet.
//
// Errors only, no performance tracing. `tracesSampleRate` used to be 0.1,
// which pulled the whole browser-tracing bundle into every route — 149 kB
// gzip, 60% of the shared baseline — to sample page loads of an app that
// does no server work worth tracing. The default integrations stay, so the
// global error and unhandled-rejection handlers are untouched; the tracing
// code itself is tree-shaken out by the __SENTRY_TRACING__ flag defined in
// next.config.mjs.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
