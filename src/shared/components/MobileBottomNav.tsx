'use client';

import { MessageCircle, ReceiptText, PlusCircle, WalletCards, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import { PLAN_ROUTES } from './PlanTabs';

interface MobileBottomNavProps {
  onMore: () => void;
}

/**
 * iOS-style tab bar: five equal, flat items — no raised centre button (that
 * is a Material FAB pattern and made the bar look busy), no per-item nudging.
 * Translucent surface + hairline top border, 44pt targets, safe-area inset.
 */
export function MobileBottomNav({ onMore }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  const isExpenses = pathname.startsWith('/expenses') && pathname !== '/expenses/new';
  const isPlan = PLAN_ROUTES.some((route) => pathname.startsWith(route));

  const items = [
    { key: 'chat', icon: MessageCircle, label: t('nav.chat'), href: '/home', active: pathname === '/home' },
    { key: 'expenses', icon: ReceiptText, label: t('nav.transactions'), href: '/expenses', active: isExpenses },
    { key: 'add', icon: PlusCircle, label: t('nav.add'), href: '/expenses/new', active: false },
    { key: 'plan', icon: WalletCards, label: t('nav.plan'), href: '/budget', active: isPlan },
  ];

  const itemClass = (active: boolean) => cn(
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-xl pb-1 pt-1.5',
    'text-[10px] font-semibold leading-none tracking-[-0.01em] transition-colors duration-150',
    'active:opacity-60',
    active ? 'text-primary' : 'text-muted-foreground',
  );

  return (
    <nav
      aria-label={t('nav.mobileNavigation')}
      className="relative z-40 flex shrink-0 items-stretch gap-0.5 px-1 backdrop-blur-xl"
      style={{
        background: 'hsl(var(--background) / 0.88)',
        borderTop: '0.5px solid hsl(var(--border))',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 6px)',
        minHeight: 52,
      }}
    >
      {items.map(({ key, icon: Icon, label, href, active }) =>
        key === 'add' ? (
          <button
            key={key}
            type="button"
            onClick={() => router.push(href)}
            className={itemClass(false)}
            aria-label={t('topbar.addTransaction')}
          >
            <Icon className="h-[25px] w-[25px]" strokeWidth={1.9} />
            <span className="truncate">{label}</span>
          </button>
        ) : (
          <Link
            key={key}
            href={href}
            className={itemClass(active)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="h-[25px] w-[25px]" strokeWidth={active ? 2.3 : 1.9} />
            <span className="truncate">{label}</span>
          </Link>
        ),
      )}
      <button type="button" onClick={onMore} className={itemClass(false)} aria-label={t('nav.more')}>
        <Menu className="h-[25px] w-[25px]" strokeWidth={1.9} />
        <span className="truncate">{t('nav.more')}</span>
      </button>
    </nav>
  );
}
