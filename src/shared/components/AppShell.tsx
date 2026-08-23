'use client';
import { useT } from '@/shared/hooks/useT';

import { useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileBottomNav } from './MobileBottomNav';
import { PlanTabs, isPlanRoute } from './PlanTabs';
import { UpdateBanner } from './UpdateBanner';
import { AddDrawer } from '@/features/quickadd/components/AddDrawer';
import { ChatHeader } from '@/features/chat/components/ChatHeader';
import { MenuOverlay } from '@/features/chat/components/MenuOverlay';
import { NotificationsPanel } from '@/features/notifications/components/NotificationsPanel';
import { DesktopChatLayout } from '@/features/chat/desktop/DesktopChatLayout';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { clearAllMessages } from '@/features/chat/services/messagesService';
import { setMessages } from '@/features/chat/store/chatSlice';

export function AppShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const isChat = pathname === '/home';
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const userId = useAppSelector((s) => s.auth.user?.id);
  const dispatch = useAppDispatch();

  const handleClearChat = useCallback(async () => {
    if (!userId) return;
    if (!window.confirm(t('chat.confirmClearChat'))) return;
    try {
      await clearAllMessages(userId);
    } finally {
      dispatch(setMessages([]));
    }
  }, [userId, dispatch, t]);

  return (
    <>
      {/* Mobile/tablet — contextual header + persistent primary navigation. */}
      <div className="flex flex-col overflow-hidden lg:hidden" style={{ height: '100dvh' }}>
        <UpdateBanner />
        <ChatHeader
          onBell={() => setBellOpen((v) => !v)}
          onClearChat={isChat ? handleClearChat : undefined}
        />
        {isPlanRoute(pathname) && <PlanTabs />}
        <main className={isChat
          ? 'flex-1 flex flex-col overflow-hidden'
          : 'flex-1 overflow-y-auto md:px-6 md:*:mx-auto md:*:w-full md:*:max-w-[760px]'}>
          {/* No transition on tab switches — on iOS a tab bar swaps screens
              instantly; motion belongs to modal presentation (see the
              .fb-sheet-enter overlays), not to lateral navigation. An animated
              wrapper here also became a stacking/containing block and pushed
              the full-screen entry sheets under the header. */}
          {children}
        </main>
        <MobileBottomNav onMore={() => setMenuOpen(true)} />
        {menuOpen && (
          <div className="fixed inset-0 z-50">
            <MenuOverlay onClose={() => setMenuOpen(false)} />
          </div>
        )}
      </div>

      {/* Desktop (≥lg) */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        <Sidebar />
        <div className="relative flex flex-1 overflow-hidden">
          {isChat ? (
            <DesktopChatLayout>{children}</DesktopChatLayout>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <UpdateBanner />
              <TopBar onBell={() => setBellOpen((v) => !v)} />
              <main className="flex-1 overflow-y-auto">
                <div className="mx-auto max-w-[1280px] p-6">{children}</div>
              </main>
            </div>
          )}
        </div>
        <AddDrawer />
      </div>
      {bellOpen && <NotificationsPanel onClose={() => setBellOpen(false)} />}
    </>
  );
}
