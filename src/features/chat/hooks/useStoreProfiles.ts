'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { setProfiles } from '@/features/chat/store/storeProfilesSlice';
import { fetchStoreProfiles } from '@/features/chat/services/storeProfilesService';

export function useStoreProfiles() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const profiles = useAppSelector((s) => s.storeProfiles.profiles);

  useEffect(() => {
    if (!userId) return;
    fetchStoreProfiles(userId)
      .then((p) => dispatch(setProfiles(p)))
      .catch(() => {});
  }, [userId, dispatch]);

  return profiles;
}
