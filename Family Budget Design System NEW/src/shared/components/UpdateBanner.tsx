'use client';

import { useEffect, useState } from 'react';

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const handleControllerChange = () => setShow(true);

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Also check if there's already a waiting SW
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) setShow(true);

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setShow(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 bg-primary px-4 py-3 text-primary-foreground shadow-lg">
      <p className="text-sm font-medium">🆕 Доступно обновление</p>
      <button
        onClick={() => window.location.reload()}
        className="shrink-0 rounded-lg bg-primary-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-primary-foreground/30 transition-colors"
      >
        Обновить
      </button>
    </div>
  );
}
