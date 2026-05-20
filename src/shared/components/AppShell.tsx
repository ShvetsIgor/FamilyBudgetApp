'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { UpdateBanner } from './UpdateBanner';
import { AddDrawer } from '@/features/quickadd/components/AddDrawer';
import { ChatHeader } from '@/features/chat/components/ChatHeader';
import { MenuOverlay } from '@/features/chat/components/MenuOverlay';
import { NotificationsPanel } from '@/features/notifications/components/NotificationsPanel';
import { DesktopChatLayout } from '@/features/chat/desktop/DesktopChatLayout';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname === '/home';
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  return (
    <>
      {/* Mobile — unified chrome: ChatHeader + no BottomNav */}
      <div className="flex flex-col overflow-hidden lg:hidden" style={{ height: '100dvh' }}>
        <UpdateBanner />
        <ChatHeader onMenu={() => setMenuOpen(true)} onBell={() => setBellOpen((v) => !v)} />
        <main className={isChat ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-y-auto'}>
          {children}
        </main>
        {menuOpen && (
          <div className="fixed inset-0 z-50">
            <MenuOverlay onClose={() => setMenuOpen(false)} />
          </div>
        )}
        {bellOpen && <NotificationsPanel onClose={() => setBellOpen(false)} />}
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <UpdateBanner />
          <TopBar />
          <main className={isChat ? 'flex-1 overflow-hidden flex flex-col' : 'flex-1 overflow-y-auto'}>
            {isChat ? (
              <div className="mx-auto w-full max-w-[480px] flex-1 flex flex-col overflow-hidden h-full">
                {children}
              </div>
            ) : (
              <div className="mx-auto max-w-[1280px] p-6">{children}</div>
            )}
          </main>
        </div>
        <AddDrawer />
      </div>
    </>
  );
}
