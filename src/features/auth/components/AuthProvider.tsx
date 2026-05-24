'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseAuth, getDb } from '@/shared/lib/firebase';
import { useAppDispatch } from '@/store/store';
import { setUser, setLoading } from '@/features/auth/store/authSlice';
import { setCurrency, setLanguage, setTheme, setWeekStart } from '@/features/ui/store/uiSlice';
import { setCategories, setFolders } from '@/features/categories/store/categoriesSlice';
import { fetchCategories, seedDefaultCategories } from '@/features/categories/services/categoriesService';
import { fetchFolders } from '@/features/categories/services/categoryFoldersService';
import type { UserProfile } from '@/shared/types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
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
        dispatch(setTheme(profile.theme));
        if (profile.weekStart) dispatch(setWeekStart(profile.weekStart));

        // Seed categories if first login, then load
        await seedDefaultCategories(firebaseUser.uid);
        const [expenseCats, incomeCats] = await Promise.all([
          fetchCategories(firebaseUser.uid, 'expense'),
          fetchCategories(firebaseUser.uid, 'income'),
        ]);
        dispatch(setCategories({ type: 'expense', categories: expenseCats }));
        dispatch(setCategories({ type: 'income', categories: incomeCats }));

      } catch (err) {
        console.error('[AuthProvider] error:', err);
        dispatch(setLoading(false));
      }
    });

    return unsubscribe;
  }, [dispatch]);

  return <>{children}</>;
}
