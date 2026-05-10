'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { Header } from '@/shared/components/Header';
import { BottomNav } from '@/shared/components/BottomNav';
import { LoadingScreen } from '@/shared/components/LoadingScreen';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, initialized } = useAppSelector((s) => s.auth);
  const router = useRouter();

  useEffect(() => {
    if (initialized && !user) {
      router.replace('/auth/login');
    }
  }, [initialized, user, router]);

  if (!initialized) return <LoadingScreen />;
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
