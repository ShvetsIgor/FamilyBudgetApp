'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getDb, isFirebaseConfigured } from '@/shared/lib/firebase';
import { useAppDispatch } from '@/store/store';
import { setUser, setLoading } from '@/features/auth/store/authSlice';
import { setCurrency, setDarkMode, setLanguage, setTheme, setWeekStart } from '@/features/ui/store/uiSlice';
import { setCategories, setFolders } from '@/features/categories/store/categoriesSlice';
import { fetchCategories, seedDefaultCategories } from '@/features/categories/services/categoriesService';
import { fetchFolders } from '@/features/categories/services/categoryFoldersService';
import { fetchStoreProfiles } from '@/features/chat/services/storeProfilesService';
import { setProfiles } from '@/features/chat/store/storeProfilesSlice';
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

        // Seed categories/folders if first login, then load all
        await seedDefaultCategories(firebaseUser.uid);
        const [expenseCats, incomeCats, expenseFolders, incomeFolders] = await Promise.all([
          fetchCategories(firebaseUser.uid, 'expense'),
          fetchCategories(firebaseUser.uid, 'income'),
          fetchFolders(firebaseUser.uid, 'expense'),
          fetchFolders(firebaseUser.uid, 'income'),
        ]);
        dispatch(setCategories({ type: 'expense', categories: expenseCats }));
        dispatch(setCategories({ type: 'income', categories: incomeCats }));
        dispatch(setFolders({ type: 'expense', folders: expenseFolders }));
        dispatch(setFolders({ type: 'income', folders: incomeFolders }));

        // Load storeв†’category learning profiles
        try {
          const profiles = await fetchStoreProfiles(firebaseUser.uid);
          dispatch(setProfiles(profiles));
        } catch { /* non-critical */ }

      } catch (err) {
        console.error('[AuthProvider] error:', err);
        dispatch(setLoading(false));
      }
    });

    return unsubscribe;
  }, [dispatch]);

  return <>{children}</>;
}
