'use client';

import { useSyncExternalStore } from 'react';

/** Tailwind's `lg`: the point where the app switches to the desktop layout. */
const DESKTOP_QUERY = '(min-width: 64rem)';

function subscribe(onChange: () => void) {
  const query = window.matchMedia?.(DESKTOP_QUERY);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/** False on the server: the (app) shell only renders after auth, on the client. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(DESKTOP_QUERY).matches ?? false,
    () => false,
  );
}
