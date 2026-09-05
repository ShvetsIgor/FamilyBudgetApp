'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getDb, isFirebaseConfigured } from '@/shared/lib/firebase';
import { useAppDispatch } from '@/store/store';
import { setUser, setLoading } from '@/features/auth/store/authSlice';
import { setCurrency, setDarkMode, setLanguage, setTheme, setWeekStart, hydrateBudgetPreferences } from '@/features/ui/store/uiSlice';
import { setCategories, setFolders } from '@/features/categories/store/categoriesSlice';
import { hydrateSuggestionMemory } from '@/features/expenses/store/suggestionMemorySlice';
import { fetchCategories, seedDefaultCategories } from '@/features/categories/services/categoriesService';
import { fetchFolders } from '@/features/categories/services/categoryFoldersService';
import type { UserProfile } from '@/shared/types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      dispatch(setUser(null));
      return;
    }

    const auth = getFirebaseAuth();
    const db = getDb();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        dispatch(setUser(null));
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDoc.exists()) {
          dispatch(setLoading(false));
          return;
        }

        const profile = userDoc.data() as UserProfile;
        dispatch(setUser(profile));
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
        dispatch(setCategories({ type: 'expense', categories: seeded.expense }));
        dispatch(setCategories({ type: 'income', categories: seeded.income }));
        dispatch(setFolders({ type: 'expense', folders: seeded.expenseFolders }));
        dispatch(setFolders({ type: 'income', folders: seeded.incomeFolders }));

      } catch (err) {
        console.error('[AuthProvider] error:', err);
        dispatch(setLoading(false));
      }
    });

    return unsubscribe;
  }, [dispatch]);

  return <>{children}</>;
}
