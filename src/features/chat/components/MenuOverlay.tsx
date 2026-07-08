'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { SHADOW, RAD } from '@/features/chat/styles/tokens';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useAppSelector } from '@/store/store';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { useT } from '@/shared/hooks/useT';
import { signOut } from '@/features/auth/services/authService';

interface NavItem {
  icon: string;
  color: string;
  labelKey: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: 'piggy',    color: '#E07A5F', labelKey: 'nav.chat',        href: '/home'       },
  { icon: 'receipt',  color: '#8AA9D6', labelKey: 'nav.expenses',    href: '/expenses'   },
  { icon: 'cash',     color: '#81B29A', labelKey: 'nav.income',      href: '/income'     },
  { icon: 'coin',     color: '#E8442A', labelKey: 'nav.budget',      href: '/budget'     },
  { icon: 'chart_up', color: '#E07A5F', labelKey: 'nav.statistics',  href: '/statistics' },
  { icon: 'chart_up', color: '#81B29A', labelKey: 'nav.analytics',   href: '/analytics'  },
  { icon: 'piggy',    color: '#A48BC9', labelKey: 'nav.savings',     href: '/savings'    },
  { icon: 'refund',   color: '#F2CC8F', labelKey: 'nav.recurring',   href: '/recurring'  },
  { icon: 'book',     color: '#D4A574', labelKey: 'nav.categories',  href: '/categories' },
  { icon: 'wrench',   color: '#8E7A66', labelKey: 'nav.settings',    href: '/account'    },
];

interface MenuOverlayProps {
  onClose: () => void;
}

function memberInitial(name?: string | null, email?: string | null): string {
  return name?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? '?';
}

export function MenuOverlay({ onClose }: MenuOverlayProps) {
  const C = useChatTokens();
  const MEMBER_COLORS = [C.primary, C.sage, C.lavender, C.caramel, C.blueSoft];
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const expenses = useAppSelector((s) => s.expenses.list);
  const familyMembers = useAppSelector((s) => s.family.members);
  const sym = getCurrencySymbol(currency);

  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const todaySpent = expenses
    .filter((e) => e.date.startsWith(todayStr))
    .reduce((s, e) => s + e.amount, 0);

  const initial = memberInitial(user?.name, user?.email);
  const displayMembers = familyMembers.slice(0, 4);
  const onlineCount = displayMembers.length || 1;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className="absolute inset-0 z-10"
        style={{ background: 'rgba(61,44,31,.42)', backdropFilter: 'blur(2px)' }}
      />

      <div
        className="absolute bottom-0 left-0 top-0 z-20 flex flex-col overflow-hidden"
        style={{
          width: '83%',
          maxWidth: 320,
          background: C.bg,
          boxShadow: SHADOW.card,
          paddingTop: 54,
          animation: 'slideInLeft 0.22s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {/* Profile hero */}
        <div className="mx-3.5 overflow-hidden" style={{ borderRadius: RAD.hero, boxShadow: SHADOW.pinned }}>
          <div
            className="relative p-4"
            style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 100%)`, color: 'white' }}
          >
            <svg
              style={{ position: 'absolute', top: -30, right: -30, opacity: 0.25, pointerEvents: 'none' }}
              width="140" height="140" viewBox="0 0 120 120"
            >
              <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none" />
            </svg>
            <div className="relative flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-[18px] font-[900]"
                style={{ background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)', color: 'white' }}
              >
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="m-0 truncate text-[16px] font-[800]" style={{ letterSpacing: -0.2 }}>
                  {user?.name || user?.email}
                </p>
                <p className="m-0 mt-0.5 text-[11.5px] font-[700] opacity-85">family.budget</p>
              </div>
            </div>
            <div className="relative mt-3 flex items-baseline gap-2">
              <span className="text-[26px] font-[900] tabular-nums" style={{ letterSpacing: -0.8 }}>
                {sym}{'\u202F'}{todaySpent.toLocaleString()}
              </span>
              <span className="text-[12px] font-[800] opacity-80">{t('chat.menu.todaySpent')}</span>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 mt-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-[14px] px-3 py-1.5 transition-colors hover:bg-black/5 active:bg-black/8"
              style={{ color: C.fg, textDecoration: 'none' }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                style={{ background: item.color + '18' }}
              >
                <StickerIcon icon={item.icon} color={item.color} className="h-5 w-5" />
              </div>
              <span className="flex-1 text-[14.5px] font-[800]">{t(item.labelKey)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 pt-3.5"
          style={{ borderTop: `1px solid ${C.hairline}`, paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex">
            {displayMembers.length > 0 ? (
              displayMembers.map((m, i) => (
                <div
                  key={m.id}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-[2.5px] text-[11px] font-[900] text-white"
                  style={{
                    background: MEMBER_COLORS[i % MEMBER_COLORS.length],
                    borderColor: C.bg,
                    marginLeft: i ? -8 : 0,
                    zIndex: displayMembers.length - i,
                  }}
                >
                  {memberInitial(m.name, m.email)}
                </div>
              ))
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full border-[2.5px] text-[11px] font-[900] text-white"
                style={{ background: C.primary, borderColor: C.bg }}
              >
                {initial}
              </div>
            )}
          </div>
          <p className="m-0 flex-1 text-[12px] font-[700]" style={{ color: C.sub }}>
            {familyMembers.length > 0
              ? t('chat.menu.online').replace('{n}', String(onlineCount))
              : t('chat.menu.onlyYou')}
          </p>
          <button
            onClick={() => signOut().catch(() => {})}
            className="flex items-center gap-1 rounded-lg p-1.5 transition-colors hover:bg-black/5"
            style={{ color: C.sub }}
            title={t('common.logout')}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1;   }
        }
      `}</style>
    </>
  );
}
