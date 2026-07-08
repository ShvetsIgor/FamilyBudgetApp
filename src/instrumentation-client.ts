import * as Sentry from '@sentry/nextjs';

// Client-side Sentry init. No-ops unless NEXT_PUBLIC_SENTRY_DSN is set
// and the build is production, so local dev stays quiet.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Keep quota usage low: errors always, performance traces sampled lightly
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
