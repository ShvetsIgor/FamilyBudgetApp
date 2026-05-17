'use client';

import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { UpdateBanner } from './UpdateBanner';
import { AddDrawer } from '@/features/quickadd/components/AddDrawer';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mobile */}
      <div className="flex min-h-screen flex-col lg:hidden">
        <UpdateBanner />
        <Header />
        <main className="flex-1 pb-28">{children}</main>
        <BottomNav />
      </div>

      {/* Desktop */}
      <div className="hidden lg:flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <UpdateBanner />
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1280px] p-6">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}
