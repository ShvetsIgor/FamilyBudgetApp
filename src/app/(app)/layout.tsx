'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setRecurring } from '@/features/recurring/store/recurringSlice';
import { fetchRecurring } from '@/features/recurring/services/recurringService';
import { Header } from '@/shared/components/Header';
import { BottomNav } from '@/shared/components/BottomNav';
import { LoadingScreen } from '@/shared/components/LoadingScreen';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { user, initialized } = useAppSelector((s) => s.auth);
  const recurringStatus = useAppSelector((s) => s.recurring.status);
  const router = useRouter();

  useEffect(() => {
    if (initialized && !user) {
      router.replace('/auth/login');
    }
  }, [initialized, user, router]);

  // Load recurring payments once on app start
  useEffect(() => {
    if (user && recurringStatus === 'idle') {
      fetchRecurring(user.id).then((data) => dispatch(setRecurring(data)));
    }
  }, [user, recurringStatus, dispatch]);

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
