'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Route-level error boundary. Deliberately self-contained: no Redux, no
// i18n hooks — those providers may be the thing that crashed.
export default function ErrorBoundary({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p style={{ fontSize: 40 }}>😕</p>
      <h1 className="text-lg font-extrabold text-foreground">
        Что-то пошло не так
      </h1>
      <p className="text-sm text-muted-foreground">
        Something went wrong. Попробуйте ещё раз — данные не потеряны.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-2xl px-6 py-3 text-[15px] font-bold text-white"
        style={{ background: 'hsl(var(--primary))' }}
      >
        Повторить · Retry
      </button>
    </div>
  );
}
