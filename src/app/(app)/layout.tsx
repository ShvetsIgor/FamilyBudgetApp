'use client';
import { useT } from '@/shared/hooks/useT';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch, useAppStore } from '@/store/store';
import { setUser } from '@/features/auth/store/authSlice';
import { setRecurring } from '@/features/recurring/store/recurringSlice';
import { fetchRecurring } from '@/features/recurring/services/recurringService';
import { setFamily, setMembers, setPendingInvite } from '@/features/family/store/familySlice';
import { setIncome } from '@/features/income/store/incomeSlice';
import { loadCurrentMonthIncomes } from '@/features/income/services/incomeStartupService';
import { setBudgets } from '@/features/budget/store/budgetSlice';
import { addNotification, hydrateNotifications } from '@/features/notifications/store/notificationsSlice';
import { fetchBudgets } from '@/features/budget/services/budgetService';
import { fetchFamily, fetchFamilyMembers, fetchPendingInvite } from '@/features/family/services/familyService';
import { checkFamilyActivity } from '@/features/family/services/familyActivityService';
import { AppShell } from '@/shared/components/AppShell';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { requestNotificationPermission } from '@/shared/hooks/useNotifications';
import { useRecurringNotifications } from '@/features/recurring/hooks/useRecurringNotifications';
import { VerifyEmailBanner } from '@/features/auth/components/VerifyEmailBanner';
import { OnboardingFlow } from '@/features/onboarding/components/OnboardingFlow';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const dispatch = useAppDispatch();
  const appStore = useAppStore();
  const { user, initialized, emailVerified } = useAppSelector((s) => s.auth);
  const currency = useAppSelector((s) => s.ui.currency);
  const recurringStatus = useAppSelector((s) => s.recurring.status);
  const family = useAppSelector((s) => s.family.family);
  const budgetStatus = useAppSelector((s) => s.budget.status);
  const incomeStatus = useAppSelector((s) => s.income.status);
  const router = useRouter();
  // Onboarding is a fact about the profile, not state to be synced into: only
  // finishing it is remembered locally, until the profile write comes back.
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (initialized && !user) {
      router.replace('/auth/login');
    }
  }, [initialized, user, router]);

  // Load recurring payments once on app start
  useEffect(() => {
    if (user && recurringStatus === 'idle') {
      fetchRecurring(user.id).then((data) => {
        if (appStore.getState().auth.user?.id === user.id) dispatch(setRecurring(data));
      }).catch(() => {});
    }
  }, [user, recurringStatus, dispatch, appStore]);

  // Per-user bell storage — must hydrate before anything adds notifications
  useEffect(() => {
    if (user?.id) dispatch(hydrateNotifications(user.id));
  }, [user?.id, dispatch]);

  // Load family data once on app start
  useEffect(() => {
    if (!user) return;
    if (user.familyId && !family) {
      const familyId = user.familyId;
      const isCurrent = () => appStore.getState().auth.user?.id === user.id;
      (async () => {
        let f;
        try {
          f = await fetchFamily(familyId);
        } catch (err) {
          if (!isCurrent()) return;
          // Only a PROVEN stale pointer self-heals. A missing family doc (or
          // being removed from it) denies the read → 'permission-denied':
          // clear the pointer so we don't error on every launch. Any other
          // error (network/'unavailable') is transient — keep state, retry.
          const code = (err as { code?: string }).code;
          if (code === 'permission-denied') {
            try {
              const { doc, updateDoc } = await import('firebase/firestore');
              const { getDb } = await import('@/shared/lib/firebase');
              await updateDoc(doc(getDb(), 'users', user.id), { familyId: null, accountType: 'personal' });
              dispatch(setUser({ ...user, familyId: undefined, accountType: 'personal' }));
            } catch { /* offline — retry next launch */ }
          }
          return;
        }
        if (!isCurrent()) return;
        // Read succeeded but the doc is absent (rules permitting): stale too.
        if (!f) {
          try {
            const { doc, updateDoc } = await import('firebase/firestore');
            const { getDb } = await import('@/shared/lib/firebase');
            await updateDoc(doc(getDb(), 'users', user.id), { familyId: null, accountType: 'personal' });
            dispatch(setUser({ ...user, familyId: undefined, accountType: 'personal' }));
          } catch { /* offline — retry next launch */ }
          return;
        }
        // Family is real — from here on, failures are NON-FATAL: a member
        // fetch or activity check that fails must never dissolve the family.
        dispatch(setFamily(f));
        try {
          const members = await fetchFamilyMembers(f.memberIds);
          if (!isCurrent()) return;
          dispatch(setMembers(members));
          checkFamilyActivity(user.id, members, t, currency).then((notes) => {
            if (!isCurrent()) return;
            notes.forEach((n) => dispatch(addNotification(n)));
          }).catch(() => {});
        } catch { /* member load is best-effort; family stays intact */ }
      })();
    }
    if (!user.familyId && emailVerified) {
      fetchPendingInvite(user.email).then((invite) => {
        if (appStore.getState().auth.user?.id !== user.id) return;
        dispatch(setPendingInvite(invite));
        if (invite) {
          dispatch(addNotification({
            kind: 'family_invite',
            title: t('notifications.familyInviteTitle'),
            text: t('notifications.familyInviteText'),
            createdAt: new Date().toISOString(),
            dedupeUnreadKind: true,
          }));
        }
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, emailVerified]);

  // Load budgets once on app start
  useEffect(() => {
    if (user && budgetStatus === 'idle') {
      fetchBudgets(user.id).then((limits) => {
        if (appStore.getState().auth.user?.id === user.id) dispatch(setBudgets(limits));
      }).catch(() => {});
    }
  }, [user, budgetStatus, dispatch, appStore]);

  // Load current-month incomes (and apply due recurring incomes) once on app
  // start — the chat auto budget needs month income before /income is visited.
  useEffect(() => {
    if (user && incomeStatus === 'idle') {
      loadCurrentMonthIncomes(user.id, () => dispatch(addNotification({
        kind: 'alert', title: t('income.recurringErrorTitle'), text: t('income.recurringError'),
        createdAt: new Date().toISOString(), dedupeUnreadKind: true,
      })))
        .then((list) => { if (appStore.getState().auth.user?.id === user.id) dispatch(setIncome(list)); })
        .catch(() => {});
    }
  }, [user, incomeStatus, dispatch, appStore, t]);

  // Request notification permission once after login
  useEffect(() => {
    if (user) requestNotificationPermission();
  }, [user]);

  // Fire notifications for upcoming recurring payments
  useRecurringNotifications();

  if (!initialized) return <LoadingScreen />;
  if (!user) return null;

  const showOnboarding = user?.onboarded === false && !onboardingDone;

  return (
    <>
      <AppShell key={user.id}><VerifyEmailBanner />{children}</AppShell>
      {showOnboarding && <OnboardingFlow onComplete={() => setOnboardingDone(true)} />}
    </>
  );
}
