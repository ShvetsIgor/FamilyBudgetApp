'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, List, BarChart2, Tag,
  PiggyBank, Repeat2, Target, Users, Settings,
  LogOut, UserCircle,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAppSelector } from '@/store/store';
import { useT } from '@/shared/hooks/useT';
import { cn } from '@/shared/utils/cn';
import { getFirebaseAuth } from '@/shared/lib/firebase';

const NAV_SECTIONS = [
  {
    labelKey: 'sidebar.budget',
    items: [
      { href: '/home', icon: LayoutDashboard, labelKey: 'nav.overview' },
      { href: '/expenses', icon: List, labelKey: 'nav.transactions' },
      { href: '/analytics', icon: BarChart2, labelKey: 'nav.analytics' },
      { href: '/categories', icon: Tag, labelKey: 'nav.categories' },
    ],
  },
  {
    labelKey: 'sidebar.planning',
    items: [
      { href: '/savings', icon: PiggyBank, labelKey: 'nav.savings' },
      { href: '/recurring', icon: Repeat2, labelKey: 'nav.recurring' },
    ],
  },
  {
    labelKey: 'sidebar.family',
    items: [
      { href: '/account', icon: Settings, labelKey: 'nav.settings' },
    ],
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAppSelector((s) => s.auth);
  const t = useT();

  async function handleLogout() {
    const auth = await getFirebaseAuth();
    await signOut(auth);
    router.replace('/auth/login');
  }

  // Track which href was activated first to avoid double-highlight
  const activatedHrefs = new Set<string>();

  return (
    <aside className="hidden lg:flex w-[260px] flex-shrink-0 flex-col h-screen border-r border-border bg-background overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center h-16 px-5 border-b border-border flex-shrink-0">
        <Link href="/home" className="flex items-center gap-2.5">
          <Image src="/logo-mark.svg" alt="" width={32} height={32} priority className="h-8 w-8" />
          <span className="text-[15px] font-bold tracking-tight leading-none">
            <span className="text-primary">family</span>
            <span className="text-foreground/40">.</span>
            <span className="text-foreground">budget</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.labelKey}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
              {t(section.labelKey)}
            </p>
            <div className="flex flex-col gap-0.5">
              {section.items.map(({ href, icon: Icon, labelKey }) => {
                const isActive = (pathname === href || pathname.startsWith(href + '/')) && !activatedHrefs.has(href);
                if (isActive) activatedHrefs.add(href);
                return (
                  <Link
                    key={labelKey}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {t(labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile card */}
      <div className="flex-shrink-0 border-t border-border p-3">
        <Link
          href="/account"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted transition-colors"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
            {user?.name ? (
              <span className="text-sm font-bold">{user.name[0].toUpperCase()}</span>
            ) : (
              <UserCircle className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name || user?.email}</p>
            {user?.accountType === 'family' && (
              <p className="text-xs text-muted-foreground truncate">{t('common.family')}</p>
            )}
          </div>
        </Link>
        <button
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {t('account.signOut')}
        </button>
      </div>
    </aside>
  );
}
