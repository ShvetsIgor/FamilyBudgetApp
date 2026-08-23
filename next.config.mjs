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
};

export default withSerwist(nextConfig);
