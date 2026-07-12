'use client';

import { Bell, Trash2 } from 'lucide-react';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { useChatTokens } from '@/features/chat/styles/useChatTokens';
import { useT } from '@/shared/hooks/useT';
import { useAppSelector } from '@/store/store';
import { usePathname } from 'next/navigation';

const MOBILE_PAGE_TITLES: Array<[string, string]> = [
  ['/expenses', 'nav.transactions'],
  ['/income', 'nav.income'],
  ['/budget', 'nav.budget'],
  ['/statistics', 'nav.statistics'],
  ['/analytics', 'nav.analytics'],
  ['/savings', 'nav.savings'],
  ['/recurring', 'nav.recurring'],
  ['/categories', 'nav.categories'],
  ['/account', 'nav.settings'],
];

interface ChatHeaderProps {
  onBell?: () => void;
  onClearChat?: () => void;
}

export function ChatHeader({ onBell, onClearChat }: ChatHeaderProps) {
  const C = useChatTokens();
  const t = useT();
  const pathname = usePathname();
  const isChat = pathname === '/home';
  const unread = useAppSelector((s) => s.notifications.items.filter((n) => !n.read).length);
  const pageTitleKey = MOBILE_PAGE_TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? 'nav.overview';

  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-2.5 border-b px-3 pb-2.5 pt-2.5"
      style={{ background: C.bg, borderColor: C.hairline }}
    >
      {isChat && <div className="relative flex-shrink-0">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${C.primaryTint}, ${C.primary}22)`,
            boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.7)',
          }}
        >
          <StickerIcon icon="piggy" color={C.primary} className="h-7 w-7" />
        </div>
        <span
          className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-[2.5px]"
          style={{ background: C.sage, borderColor: C.bg }}
        />
      </div>}

      <div className="flex-1 min-w-0">
        {isChat ? (
          <>
            <p className="m-0 text-base font-[800] leading-tight" style={{ letterSpacing: -0.3, color: C.fg }}>
              <span style={{ color: C.primary }}>family</span>
              <span style={{ color: C.sub, fontWeight: 700 }}>.</span>
              budget
            </p>
            <p className="m-0 mt-px text-[11px] font-[700]" style={{ color: C.sage }}>
              {t('chat.header.online')}
            </p>
          </>
        ) : (
          <p className="m-0 text-[17px] font-[800] leading-tight" style={{ letterSpacing: -0.25, color: C.fg }}>
            {t(pageTitleKey)}
          </p>
        )}
      </div>

      {onClearChat && (
        <button
          onClick={onClearChat}
          className="fb-touch-target flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
          style={{ color: C.sub }}
          aria-label={t('chat.clearChat')}
          title={t('chat.clearChat')}
        >
          <Trash2 size={17} strokeWidth={2} />
        </button>
      )}

      <button
        onClick={onBell}
        className="fb-touch-target relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
        style={{ color: C.fg }}
        aria-label={t('notifications.title')}
      >
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && (
          <span
            className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-[900] text-white"
            style={{ background: C.rose, lineHeight: 1 }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
