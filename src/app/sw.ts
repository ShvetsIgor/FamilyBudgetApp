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

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
