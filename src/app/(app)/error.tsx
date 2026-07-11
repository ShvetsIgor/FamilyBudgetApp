'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as Sentry from '@sentry/nextjs';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // This nested boundary swallows the error before the root one — report
    // here or authenticated-area crashes never reach Sentry. The Error
    // object itself carries no expense/PII payload.
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="text-xl font-bold">Что-то пошло не так</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Произошла неожиданная ошибка. Попробуйте обновить страницу.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Попробовать снова
        </button>
        <button
          onClick={() => router.push('/home')}
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground"
        >
          На главную
        </button>
      </div>
    </div>
  );
}
