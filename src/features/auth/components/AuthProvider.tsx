'use client';

import { useEffect } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, initializeFirestore, persistentLocalCache } from 'firebase/firestore';
import { getFirebaseApp } from '@/shared/lib/firebase';
import { useAppDispatch } from '@/store/store';
import { setUser, setLoading } from '@/features/auth/store/authSlice';
import { setCurrency, setLanguage, setTheme } from '@/features/ui/store/uiSlice';
import { setCategories } from '@/features/categories/store/categoriesSlice';
import { fetchCategories, seedDefaultCategories } from '@/features/categories/services/categoriesService';
import type { UserProfile } from '@/shared/types';

function getDb() {
  const app = getFirebaseApp();
  try {
    return initializeFirestore(app, { localCache: persistentLocalCache() });
  } catch {
    return getFirestore(app);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const app = getFirebaseApp();
    const auth = getAuth(app);
    const db = getDb();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        dispatch(setUser(null));
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data() as UserProfile;
          dispatch(setUser(profile));
          dispatch(setCurrency(profile.currency));
          dispatch(setLanguage(profile.language));
          dispatch(setTheme(profile.theme));

          // Seed + load categories
          await seedDefaultCategories(firebaseUser.uid);
          const [expenseCats, incomeCats] = await Promise.all([
            fetchCategories(firebaseUser.uid, 'expense'),
            fetchCategories(firebaseUser.uid, 'income'),
          ]);
          dispatch(setCategories({ type: 'expense', categories: expenseCats }));
          dispatch(setCategories({ type: 'income', categories: incomeCats }));
        } else {
          dispatch(setLoading(false));
        }
      } catch {
        dispatch(setUser(null));
      }
    });

    return unsubscribe;
  }, [dispatch]);

  return <>{children}</>;
}
