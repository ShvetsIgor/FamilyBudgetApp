'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nested boundary — report here or auth-route crashes never reach Sentry.
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-5xl">⚠️</p>
      <h1 className="text-xl font-bold">Ошибка</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Не удалось загрузить страницу. Проверьте соединение и попробуйте снова.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Повторить
        </button>
        <Link
          href="/auth/login"
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground"
        >
          Войти
        </Link>
      </div>
    </div>
  );
}
