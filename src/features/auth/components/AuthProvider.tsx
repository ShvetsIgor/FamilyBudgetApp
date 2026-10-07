'use client';

import { useEffect } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getFirebaseAuth, getDb, isFirebaseConfigured } from '@/shared/lib/firebase';
import { useDispatch, useStore } from 'react-redux';
import type { RootState, AppDispatch } from '@/store/store';
import { beginSession, setUser, setLoading, setEmailVerified } from '@/features/auth/store/authSlice';
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
    async function syncUser(firebaseUser: User | null) {
      stopWaitingForProfile?.();
      stopWaitingForProfile = undefined;
      const current = ++generation;
      const isCurrent = () => current === generation && auth.currentUser === firebaseUser;
      if (!firebaseUser) {
        dispatch(setUser(null));
        return;
      }

      if (appStore.getState().auth.user?.id !== firebaseUser.uid) {
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
          }, () => { if (isCurrent()) dispatch(setUser(null)); });
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

      } catch (err) {
        if (!isCurrent()) return;
        console.error('[AuthProvider] error:', err);
        if (!appStore.getState().auth.user) dispatch(setUser(null));
        else dispatch(setLoading(false));
      }
    }
    const unsubscribe = onIdTokenChanged(auth, syncUser);
    return () => { generation++; stopWaitingForProfile?.(); unsubscribe(); };
  }, [dispatch, appStore]);

  return <>{children}</>;
}
