'use client';

import Link from 'next/link';
import { useT } from '@/shared/hooks/useT';

export default function NotFound() {
  const t = useT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-6xl">🐷</p>
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-muted-foreground">{t('common.pageNotFound')}</p>
      <Link
        href="/home"
        className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        {t('common.goHome')}
      </Link>
    </div>
  );
}
