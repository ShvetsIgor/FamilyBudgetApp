'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { cachedLearnedKeywords, fetchLearnedKeywords } from '@/features/chat/parser/learning';
import type { KeywordHit } from '@/features/chat/parser/dictionary';

/**
 * Read-only. The chat used to teach the parser new words, but the writer was
 * dropped in the 2026-05-31 chat-page rewrite (c5440da) along with the
 * storeProfiles dispatches, so this collection can only hold documents from
 * before that. Reading them still matters — those users' words keep working —
 * and the reset path still clears them; teaching new ones does not exist any
 * more, so this hook no longer pretends to offer it.
 */
export function useLearnedKeywords(): Record<string, KeywordHit> {
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [learned, setLearned] = useState<Record<string, KeywordHit>>(
    () => (userId ? cachedLearnedKeywords(userId) ?? {} : {}),
  );

  useEffect(() => {
    if (!userId) return;
    // Served from the module cache after the first load of the session.
    fetchLearnedKeywords(userId).then(setLearned).catch(() => {});
  }, [userId]);

  return learned;
}
