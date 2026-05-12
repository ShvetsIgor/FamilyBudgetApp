'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Moon, WifiOff, RefreshCw, Plus, Search, Bell } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setTheme } from '@/features/ui/store/uiSlice';
import { useT } from '@/shared/hooks/useT';

const PAGE_TITLE_KEYS: Record<string, string> = {
  '/home': 'nav.overview',
  '/expenses': 'nav.transactions',
  '/statistics': 'nav.statistics',
  '/analytics': 'nav.analytics',
  '/categories': 'nav.categories',
  '/savings': 'nav.savings',
  '/recurring': 'nav.recurring',
  '/account': 'nav.account',
};

function getPageTitleKey(pathname: string): string {
  for (const [prefix, key] of Object.entries(PAGE_TITLE_KEYS)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return key;
  }
  return 'nav.overview';
}

export function TopBar() {
  const dispatch = useAppDispatch();
  const pathname = usePathname();
  const { theme, isOffline, isSyncing } = useAppSelector((s) => s.ui);
  const user = useAppSelector((s) => s.auth.user);
  const t = useT();

  const isHome = pathname === '/home';
  const firstName = user?.name?.split(' ')[0] || '';

  const title = isHome && firstName
    ? `${t('topbar.greeting').replace('{name}', firstName)} ✨`
    : t(getPageTitleKey(pathname));

  return (
    <header className="hidden lg:flex h-16 flex-shrink-0 items-center gap-4 border-b border-border bg-background/95 backdrop-blur px-6">
      {/* Title */}
      <h1 className="text-lg font-bold text-foreground shrink-0 min-w-[160px]">{title}</h1>

      {/* Search */}
      <div className="flex-1 max-w-[360px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={t('topbar.search')}
            className="w-full rounded-xl border border-border bg-muted/50 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
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
          className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground relative"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        <button
          onClick={() => dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))}
          className="rounded-full p-2 transition-colors hover:bg-muted text-muted-foreground"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        <Link
          href="/expenses/new"
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm shadow-primary/30"
        >
          <Plus className="h-4 w-4" />
          {t('topbar.addTransaction')}
        </Link>
      </div>
    </header>
  );
}
