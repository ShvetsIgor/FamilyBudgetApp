'use client';

import { useEffect } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getDb, isFirebaseConfigured } from '@/shared/lib/firebase';
import { useDispatch, useStore } from 'react-redux';
import type { RootState, AppDispatch } from '@/store/store';
import { beginSession, setUser, setLoading, setEmailVerified, setSessionLoadFailed } from '@/features/auth/store/authSlice';
import { setCurrency, setDarkMode, setLanguage, setTheme, setWeekStart, hydrateBudgetPreferences } from '@/features/ui/store/uiSlice';
import { setCategories, setFolders } from '@/features/categories/store/categoriesSlice';
import { hydrateSuggestionMemory } from '@/features/expenses/store/suggestionMemorySlice';
import { seedDefaultCategories } from '@/features/categories/services/categoriesService';
import type { UserProfile } from '@/shared/types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const appStore = useStore<RootState>();

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      dispatch(setUser(null));
      return;
    }

    const auth = getFirebaseAuth();
    const db = getDb();

    let generation = 0;
    let stopWaitingForProfile: (() => void) | undefined;
    // The Firebase user whose profile is loaded or loading. The SDK keeps one
    // User object per sign-in, so the same object again is a token refresh.
    let sessionUser: User | null = null;
    // A signed-in user whose load failed: retried until it works, or until the
    // account changes. Firebase fires no token event for a network that came back.
    let retryUser: User | null = null;
    let retryAttempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function retryNow() {
      if (retryUser) void syncUser(retryUser);
    }

    // onIdTokenChanged also fires hourly and on every getIdToken(true). Those
    // change claims, not the profile: reloading it (and re-reading every
    // category and folder) each time cost a full cold start's worth of reads.
    async function onToken(firebaseUser: User | null) {
      if (firebaseUser && firebaseUser === sessionUser) {
        // A load still in flight reads emailVerified itself when it lands
        if (appStore.getState().auth.user?.id === firebaseUser.uid) {
          dispatch(setEmailVerified(firebaseUser.emailVerified));
        }
        return;
      }
      await syncUser(firebaseUser);
    }

    async function syncUser(firebaseUser: User | null) {
      clearTimeout(retryTimer);
      if (firebaseUser !== retryUser) { retryUser = null; retryAttempts = 0; }
      sessionUser = firebaseUser;
      stopWaitingForProfile?.();
      stopWaitingForProfile = undefined;
      const current = ++generation;
      const isCurrent = () => current === generation && auth.currentUser === firebaseUser;
      if (!firebaseUser) {
        dispatch(setUser(null));
        return;
      }

      // A retry keeps the failure screen up instead of flashing the loader
      if (appStore.getState().auth.user?.id !== firebaseUser.uid && firebaseUser !== retryUser) {
        dispatch(beginSession());
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!isCurrent()) return;
        if (!userDoc.exists()) {
          // Auth can arrive before registration creates its profile. A forced
          // token refresh can return the same token, so it is not a readiness signal.
          stopWaitingForProfile = onSnapshot(doc(db, 'users', firebaseUser.uid), snapshot => {
            if (isCurrent() && snapshot.exists()) void syncUser(firebaseUser);
          }, () => {
            if (!isCurrent()) return;
            sessionUser = null;
            dispatch(setUser(null));
          });
          return;
        }

        const profile = { ...userDoc.data(), id: firebaseUser.uid, email: firebaseUser.email ?? '' } as UserProfile;
        dispatch(setUser(profile));
        dispatch(setEmailVerified(firebaseUser.emailVerified));
        dispatch(setCurrency(profile.currency));
        dispatch(setLanguage(profile.language));
        const profileTheme = profile.theme as typeof profile.theme | 'light' | 'dark' | 'paper' | undefined;
        // Existing 'paper' profiles migrate to the new 'press' editorial theme.
        const resolvedTheme = profileTheme === 'press' || profileTheme === 'paper' ? 'press' : 'mist';
        dispatch(setTheme(resolvedTheme));
        dispatch(setDarkMode(profile.darkMode ?? profileTheme === 'dark'));
        if (profile.weekStart) dispatch(setWeekStart(profile.weekStart));
        // Budget settings follow the account across devices; the uid scopes
        // the localStorage cache so accounts on one browser stay isolated
        dispatch(hydrateBudgetPreferences({
          uid: firebaseUser.uid,
          budgetMode: profile.budgetMode,
          budgetDailyLimit: profile.budgetDailyLimit,
          budgetMonthlyLimit: profile.budgetMonthlyLimit,
          budgetByMonth: profile.budgetByMonth,
        }));
        // Merchant/split/recents memory is account-scoped as well
        dispatch(hydrateSuggestionMemory({ uid: firebaseUser.uid }));

        // Seeds first-login defaults and hands back the loaded state. This used
        // to be followed by the same four queries all over again — two full
        // reads of every category and folder before the first screen appeared.
        const seeded = await seedDefaultCategories(firebaseUser.uid, profile);
        if (!isCurrent()) return;
        dispatch(setCategories({ type: 'expense', categories: seeded.expense }));
        dispatch(setCategories({ type: 'income', categories: seeded.income }));
        dispatch(setFolders({ type: 'expense', folders: seeded.expenseFolders }));
        dispatch(setFolders({ type: 'income', folders: seeded.incomeFolders }));
        retryUser = null;
        retryAttempts = 0;

      } catch (err) {
        if (!isCurrent()) return;
        console.error('[AuthProvider] error:', err);
        // Let the next token change retry the load instead of passing as a refresh
        sessionUser = null;
        // A failed READ says nothing about the session. Reporting «no user» here
        // sent a signed-in person to the login screen on any network hiccup.
        if (!appStore.getState().auth.user) dispatch(setSessionLoadFailed());
        else dispatch(setLoading(false));
        retryUser = firebaseUser;
        retryTimer = setTimeout(retryNow, Math.min(3_000 * 2 ** retryAttempts, 30_000));
        retryAttempts += 1;
      }
    }
    const unsubscribe = onIdTokenChanged(auth, onToken);
    window.addEventListener('online', retryNow);
    return () => {
      generation++;
      clearTimeout(retryTimer);
      window.removeEventListener('online', retryNow);
      stopWaitingForProfile?.();
      unsubscribe();
    };
  }, [dispatch, appStore]);

  return <>{children}</>;
}
