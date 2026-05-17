'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { C, SHADOW, RAD } from '@/features/chat/styles/tokens';
import { useAppSelector } from '@/store/store';
import { getCurrencySymbol } from '@/shared/utils/currency';

const NAV_ITEMS = [
  { icon: 'chart_up', color: '#E07A5F', label: 'Статистика',  href: '/statistics' },
  { icon: 'chart_up', color: '#81B29A', label: 'Аналитика',   href: '/analytics'  },
  { icon: 'piggy',    color: '#A48BC9', label: 'Копилки',      href: '/savings'    },
  { icon: 'refund',   color: '#F2CC8F', label: 'Регулярные',  href: '/recurring'  },
  { icon: 'tag',      color: '#D4A574', label: 'Категории',    href: '/categories' },
  { icon: 'receipt',  color: '#8AA9D6', label: 'Транзакции',  href: '/expenses'   },
  { icon: 'cog',      color: '#8E7A66', label: 'Настройки',   href: '/account'    },
] as const;

interface MenuOverlayProps {
  onClose: () => void;
}

export function MenuOverlay({ onClose }: MenuOverlayProps) {
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const expenses = useAppSelector((s) => s.expenses.list);
  const sym = getCurrencySymbol(currency);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySpent = expenses
    .filter((e) => e.date.startsWith(todayStr))
    .reduce((s, e) => s + e.amount, 0);

  const initial = user?.name?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 z-10"
        style={{ background: 'rgba(61,44,31,.42)', backdropFilter: 'blur(2px)' }}
      />

      {/* Panel */}
      <div
        className="absolute bottom-0 left-0 top-0 z-20 flex flex-col overflow-hidden"
        style={{
          width: '83%',
          background: C.bg,
          boxShadow: SHADOW.card,
          paddingTop: 54,
        }}
      >
        {/* Profile hero */}
        <div className="mx-3.5 overflow-hidden" style={{ borderRadius: RAD.hero, boxShadow: SHADOW.pinned }}>
          <div
            className="relative p-4"
            style={{ background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDeep} 100%)`, color: 'white' }}
          >
            <svg style={{ position: 'absolute', top: -30, right: -30, opacity: 0.25, pointerEvents: 'none' }} width="140" height="140" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="58" stroke="white" strokeWidth="1.5" fill="none" />
            </svg>
            <div className="relative flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl text-[18px] font-[900]"
                style={{ background: 'rgba(255,255,255,.22)', backdropFilter: 'blur(8px)', color: 'white' }}
              >
                {initial}
              </div>
              <div className="flex-1">
                <p className="m-0 text-[17px] font-[800]" style={{ letterSpacing: -0.2 }}>
                  {user?.name || user?.email}
                </p>
                <p className="m-0 mt-0.5 text-[12px] font-[700] opacity-85">family.budget</p>
              </div>
            </div>
            <div className="relative mt-3 flex items-baseline gap-2">
              <span className="text-[28px] font-[900] tabular-nums" style={{ letterSpacing: -0.8 }}>
                {sym}{todaySpent.toLocaleString()}
              </span>
              <span className="text-[12px] font-[800] opacity-80">сегодня потрачено</span>
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
              className="flex items-center gap-3 rounded-[14px] px-3 py-3 transition-colors hover:bg-black/5"
              style={{ color: C.fg, textDecoration: 'none' }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[11px]"
                style={{ background: item.color + '18' }}
              >
                <StickerIcon icon={item.icon} color={item.color} className="h-6 w-6" />
              </div>
              <span className="flex-1 text-[14.5px] font-[800]">{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2.4" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5"
          style={{ borderTop: `1px solid ${C.hairline}` }}
        >
          <div className="flex">
            {[C.primary, C.sage, C.lavender].map((bg, i) => (
              <div
                key={i}
                className="flex h-7 w-7 items-center justify-center rounded-full border-[2.5px] text-[11px] font-[900] text-white"
                style={{ background: bg, borderColor: C.bg, marginLeft: i ? -8 : 0 }}
              >
                {['И','А','М'][i]}
              </div>
            ))}
          </div>
          <p className="m-0 flex-1 text-[12px] font-[700]" style={{ color: C.sub }}>
            Семья онлайн · 3
          </p>
          <button className="flex items-center gap-1 text-[12px] font-[700]" style={{ color: C.sub }}>
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
