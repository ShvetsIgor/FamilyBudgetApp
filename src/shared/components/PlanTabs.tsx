'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

/** Routes grouped under the bottom nav's «Plan» tab. */
export const PLAN_ROUTES = ['/budget', '/savings', '/recurring'] as const;

export function isPlanRoute(pathname: string): boolean {
  return PLAN_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Mobile sub-navigation for the Plan group: the bottom nav can only point at
 * one route, so without this Savings and Recurring are reachable only through
 * the More menu.
 */
export function PlanTabs() {
  const pathname = usePathname();
  const t = useT();
  const tabs = [
    { href: '/budget', label: t('nav.budget') },
    { href: '/savings', label: t('nav.savings') },
    { href: '/recurring', label: t('nav.recurring') },
  ];

  return (
    <nav
      aria-label={t('nav.plan')}
      className="flex gap-1.5 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'min-h-9 shrink-0 rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors',
              active
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
