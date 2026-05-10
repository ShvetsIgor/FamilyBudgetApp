'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setRecurring } from '@/features/recurring/store/recurringSlice';
import { fetchRecurring } from '@/features/recurring/services/recurringService';
import { setFamily, setMembers, setPendingInvite } from '@/features/family/store/familySlice';
import { setBudgets } from '@/features/budget/store/budgetSlice';
import { fetchBudgets } from '@/features/budget/services/budgetService';
import { fetchFamily, fetchFamilyMembers, fetchPendingInvite } from '@/features/family/services/familyService';
import { Header } from '@/shared/components/Header';
import { BottomNav } from '@/shared/components/BottomNav';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { requestNotificationPermission } from '@/shared/hooks/useNotifications';
import { useRecurringNotifications } from '@/features/recurring/hooks/useRecurringNotifications';
import { OnboardingFlow } from '@/features/onboarding/components/OnboardingFlow';
import { UpdateBanner } from '@/shared/components/UpdateBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const { user, initialized } = useAppSelector((s) => s.auth);
  const recurringStatus = useAppSelector((s) => s.recurring.status);
  const family = useAppSelector((s) => s.family.family);
  const budgetStatus = useAppSelector((s) => s.budget.status);
  const router = useRouter();
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  // Load family data once on app start
  useEffect(() => {
    if (!user) return;
    if (user.familyId && !family) {
      fetchFamily(user.familyId).then(async (f) => {
        if (!f) return;
        dispatch(setFamily(f));
        const members = await fetchFamilyMembers(f.memberIds);
        dispatch(setMembers(members));
      });
    }
    if (!user.familyId) {
      fetchPendingInvite(user.email).then((invite) => dispatch(setPendingInvite(invite)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Load budgets once on app start
  useEffect(() => {
    if (user && budgetStatus === 'idle') {
      fetchBudgets(user.id).then((limits) => dispatch(setBudgets(limits)));
    }
  }, [user, budgetStatus, dispatch]);

  // Show onboarding for new users (only when explicitly onboarded === false)
  useEffect(() => {
    if (user && user.onboarded === false) setShowOnboarding(true);
  }, [user]);

  // Request notification permission once after login
  useEffect(() => {
    if (user) requestNotificationPermission();
  }, [user]);

  // Fire notifications for upcoming recurring payments
  useRecurringNotifications();

  if (!initialized) return <LoadingScreen />;
  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <UpdateBanner />
      <Header />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
      {showOnboarding && <OnboardingFlow onComplete={() => setShowOnboarding(false)} />}
    </div>
  );
}
