'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, List, BarChart2, Lightbulb } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();

  const NAV_ITEMS = [
    { href: '/home', icon: Plus, label: t('nav.add'), activeOn: ['/home'] },
    { href: '/expenses', icon: List, label: t('nav.expenses'), activeOn: ['/expenses'] },
    { href: '/statistics', icon: BarChart2, label: t('nav.statistics'), activeOn: ['/statistics'] },
    { href: '/analytics', icon: Lightbulb, label: t('nav.analytics'), activeOn: ['/analytics'] },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-safe">
      <div className="flex h-16 items-center justify-around">
        {NAV_ITEMS.map(({ href, icon: Icon, label, activeOn }) => {
          const isActive = activeOn.some((path) => pathname.startsWith(path));

          if (href === '/home') {
            return (
              <Link key={href} href={href} aria-label={label}>
                <div
                  className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-full transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                      : 'bg-primary text-primary-foreground shadow-md'
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
              aria-label={label}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
