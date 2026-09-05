import withSerwistInit from '@serwist/next';

/**
 * The PWA layer is Serwist (`@serwist/next`), which compiles `src/app/sw.ts`
 * into `public/sw.js` at build time and registers it on the client.
 *
 * It is a webpack plugin, so `next build` still runs with `--webpack`;
 * Turbopack builds would need `@serwist/turbopack`, whose service worker is
 * served by a route handler — incompatible with the static export the mobile
 * roadmap needs for Capacitor.
 */
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // No service worker in dev: it caches aggressively and fights HMR
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { webpack }) => {
    // Sentry ships tracing, debug logging and the replay worker behind these
    // flags. This app reports errors only (see src/instrumentation-client.ts),
    // and defining them lets webpack drop the code instead of shipping it to
    // every phone: measured at −47 kB gzip on every single route.
    config.plugins.push(
      new webpack.DefinePlugin({
        __SENTRY_TRACING__: false,
        __SENTRY_DEBUG__: false,
        __RRWEB_EXCLUDE_IFRAME__: true,
        __RRWEB_EXCLUDE_SHADOW_DOM__: true,
        __SENTRY_EXCLUDE_REPLAY_WORKER__: true,
      }),
    );
    return config;
  },
};

export default withSerwist(nextConfig);
