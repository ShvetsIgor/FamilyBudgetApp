'use client';

import { MessageCircle, ReceiptText, Plus, WalletCards, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';

interface MobileBottomNavProps {
  onMore: () => void;
}

const PLAN_ROUTES = ['/budget', '/savings', '/recurring'];

export function MobileBottomNav({ onMore }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useT();

  const itemClass = (active: boolean) => cn(
    'fb-touch-target flex min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-xl text-[10px] font-bold transition-colors',
    active ? 'text-primary' : 'text-muted-foreground',
  );

  return (
    <nav
      aria-label={t('nav.mobileNavigation')}
      className="relative z-40 flex shrink-0 items-center gap-0.5 border-t border-border bg-background/95 px-2 pt-1 backdrop-blur"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 4px)' }}
    >
      <Link href="/home" className={itemClass(pathname === '/home')} aria-current={pathname === '/home' ? 'page' : undefined}>
        <MessageCircle className="h-[18px] w-[18px]" />
        <span className="truncate">{t('nav.chat')}</span>
      </Link>
      <Link
        href="/expenses"
        className={cn(itemClass(pathname.startsWith('/expenses') && pathname !== '/expenses/new'), '-translate-x-1')}
        aria-current={pathname.startsWith('/expenses') && pathname !== '/expenses/new' ? 'page' : undefined}
      >
        <ReceiptText className="h-[18px] w-[18px]" />
        <span className="truncate">{t('nav.transactions')}</span>
      </Link>
      <button
        type="button"
        onClick={() => router.push('/expenses/new')}
        className="fb-touch-target -mt-4 flex min-w-[56px] flex-col items-center justify-center gap-px text-[10px] font-black text-primary"
        aria-label={t('topbar.addTransaction')}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-primary text-primary-foreground transition-transform active:scale-95" style={{ boxShadow: 'var(--shadow-primary-sm)' }}>
          <Plus className="h-[22px] w-[22px]" strokeWidth={2.6} />
        </span>
        <span>{t('nav.add')}</span>
      </button>
      <Link
        href="/budget"
        className={cn(itemClass(PLAN_ROUTES.some((route) => pathname.startsWith(route))), 'translate-x-1')}
        aria-current={PLAN_ROUTES.some((route) => pathname.startsWith(route)) ? 'page' : undefined}
      >
        <WalletCards className="h-[18px] w-[18px]" />
        <span className="truncate">{t('nav.plan')}</span>
      </Link>
      <button type="button" onClick={onMore} className={itemClass(false)} aria-label={t('nav.more')}>
        <Menu className="h-[18px] w-[18px]" />
        <span className="truncate">{t('nav.more')}</span>
      </button>
    </nav>
  );
}
