'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
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
