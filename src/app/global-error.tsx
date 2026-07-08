'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Root error boundary: replaces the whole document when the root layout
// itself crashes, so it must render <html>/<body> and use inline styles
// only (global CSS may not have loaded).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          textAlign: 'center',
          background: '#F7F4EE',
          color: '#1a1a1a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <p style={{ fontSize: 40, margin: 0 }}>😕</p>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
          Что-то пошло не так
        </h1>
        <p style={{ fontSize: 14, color: '#6b6b6b', margin: 0 }}>
          Something went wrong. Перезагрузите страницу — данные не потеряны.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            border: 0,
            borderRadius: 16,
            padding: '12px 24px',
            fontSize: 15,
            fontWeight: 700,
            color: '#fff',
            background: '#E8442A',
            cursor: 'pointer',
          }}
        >
          Повторить · Retry
        </button>
      </body>
    </html>
  );
}
