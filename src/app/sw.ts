/**
 * Service worker source, compiled to `public/sw.js` by `@serwist/next`.
 *
 * Not a route: the App Router only treats `page`/`layout`/`route`/… filenames
 * as routes, so this file is inert inside `app/`.
 *
 * `skipWaiting` + `clientsClaim` keep the behaviour the app already had under
 * next-pwa: a new worker takes over immediately, which fires `controllerchange`
 * — the signal `UpdateBanner` listens for to offer «Обновить».
 */
import { defaultCache } from '@serwist/next/worker';
import { Serwist, type PrecacheEntry, type SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * The worker serves this app's own shell. Nothing cross-origin passes through it.
 *
 * Serwist's default rules send every cross-origin GET through NetworkFirst with
 * a 10-second timeout and a cache. For Firestore that is doubly wrong: its Listen
 * channel is a long-lived streaming GET, which the handling broke into «could not
 * reach backend» on a healthy network; and the responses — people's expenses —
 * were written to Cache Storage, where they outlived signing out. Registered
 * before Serwist's listener, and without respondWith, so the browser handles
 * these requests as if there were no worker at all.
 */
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) event.stopImmediatePropagation();
});

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

/**
 * One-time migration off next-pwa.
 *
 * Anyone who already had the app installed still carries workbox's precache —
 * a full copy of a build that no longer exists on the server, several MB of it,
 * which nothing will ever read again. Serwist names its own caches under the
 * `serwist` prefix, so anything under `workbox-` is by construction dead and
 * safe to drop. The runtime caches (`others`, `static-js-assets`, …) keep their
 * names across both worlds and are simply reused.
 *
 * `cross-origin` is dropped too: it can hold Firestore responses (see above), and
 * nothing writes to it any more.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.filter((name) => name.startsWith('workbox-') || name === 'cross-origin').map((name) => caches.delete(name)),
    )),
  );
});
