'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { UpdateBanner } from './UpdateBanner';
import { AddDrawer } from '@/features/quickadd/components/AddDrawer';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname === '/home';

  return (
    <>
      {/* Mobile */}
      <div className="flex min-h-screen flex-col lg:hidden">
        <UpdateBanner />
        {!isChat && <Header />}
        <main className={isChat ? 'flex-1 flex flex-col overflow-hidden h-screen' : 'flex-1 pb-28'}>
          {children}
        </main>
        {!isChat && <BottomNav />}
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
