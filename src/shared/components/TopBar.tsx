'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, WifiOff, RefreshCw, Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setTheme } from '@/features/ui/store/uiSlice';
import { useT } from '@/shared/hooks/useT';

const PAGE_TITLES: Record<string, string> = {
  '/home': 'nav.add',
  '/expenses': 'nav.expenses',
  '/statistics': 'nav.statistics',
  '/analytics': 'nav.analytics',
  '/categories': 'nav.categories',
  '/savings': 'nav.savings',
  '/recurring': 'nav.recurring',
  '/account': 'nav.account',
};

function getPageTitleKey(pathname: string): string {
  for (const [prefix, key] of Object.entries(PAGE_TITLES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return key;
  }
  return 'nav.add';
}

export function TopBar() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { theme, isOffline, isSyncing } = useAppSelector((s) => s.ui);
  const t = useT();

  const titleKey = getPageTitleKey(pathname);

  return (
    <header className="hidden lg:flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-xl font-semibold text-foreground">{t(titleKey)}</h1>

      <div className="flex items-center gap-3">
        {isOffline && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1">
            <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t('common.offline')}</span>
          </div>
        )}
        {isSyncing && !isOffline && (
          <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
        )}

        <button
          onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
          className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <Link
          href="/home"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t('topbar.addTransaction')}
        </Link>
      </div>
    </header>
  );
}
