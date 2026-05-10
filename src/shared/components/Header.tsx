'use client';

import Link from 'next/link';
import { Settings, UserCircle, Users, WifiOff, RefreshCw, Repeat2 } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { cn } from '@/shared/utils/cn';

export function Header() {
  const { isOffline, isSyncing } = useAppSelector((s) => s.ui);
  const { user } = useAppSelector((s) => s.auth);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4">
        {/* App name */}
        <Link href="/home" className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">Budget</span>
          {user?.accountType === 'family' && (
            <span className="text-xs text-muted-foreground font-medium">Family</span>
          )}
        </Link>

        {/* Status + Actions */}
        <div className="flex items-center gap-1">
          {/* Offline / Syncing indicator */}
          {isOffline && (
            <div className="flex items-center gap-1 rounded-full bg-muted px-2 py-1">
              <WifiOff className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Offline</span>
            </div>
          )}
          {isSyncing && !isOffline && (
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          )}

          {/* Family icon */}
          <Link
            href={user?.familyId ? '/family' : '/family'}
            className={cn(
              'rounded-full p-2 transition-colors hover:bg-muted',
              user?.familyId ? 'text-primary' : 'text-muted-foreground'
            )}
            aria-label="Family"
          >
            <Users className="h-5 w-5" />
          </Link>

          {/* Account */}
          <Link
            href="/account"
            className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground"
            aria-label="Account"
          >
            <UserCircle className="h-5 w-5" />
          </Link>

          {/* Recurring */}
          <Link
            href="/recurring"
            className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground"
            aria-label="Recurring payments"
          >
            <Repeat2 className="h-5 w-5" />
          </Link>

          {/* Categories */}
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
