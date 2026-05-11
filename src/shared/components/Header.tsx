'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Settings, UserCircle, WifiOff, RefreshCw, Repeat2 } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { useT } from '@/shared/hooks/useT';

export function Header() {
  const { isOffline, isSyncing } = useAppSelector((s) => s.ui);
  const { user } = useAppSelector((s) => s.auth);
  const t = useT();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/home" className="flex items-center">
          <Image
            src="/logo-wordmark.svg"
            alt="Family Budget"
            width={140}
            height={36}
            priority
            className="h-9 w-auto"
          />
          {user?.accountType === 'family' && (
            <span className="ml-2 text-xs text-muted-foreground font-medium">
              {t('common.family')}
            </span>
          )}
        </Link>

        {/* Status + Actions */}
        <div className="flex items-center gap-1">
          {isOffline && (
            <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <WifiOff className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t('common.offline')}</span>
            </div>
          )}
          {isSyncing && !isOffline && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}

          <Link
            href="/account"
            className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground"
            aria-label="Account"
          >
            <UserCircle className="h-5 w-5" />
          </Link>

          <Link
            href="/recurring"
            className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground"
            aria-label="Recurring payments"
          >
            <Repeat2 className="h-5 w-5" />
          </Link>

          <Link
            href="/categories"
            className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground"
            aria-label="Categories"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
