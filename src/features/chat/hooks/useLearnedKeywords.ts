'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { cachedLearnedKeywords, fetchLearnedKeywords, subscribeLearnedKeywords } from '@/features/chat/parser/learning';
import type { KeywordHit } from '@/features/chat/parser/dictionary';

/**
 * The words this account taught the chat (see `keywordLearning.ts`). Choosing
 * a category in a clarify card teaches one; the hook re-reads the session
 * cache whenever that happens, so the next message already uses it.
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
    return subscribeLearnedKeywords((changed) => {
      if (changed !== userId) return;
      setLearned(cachedLearnedKeywords(userId) ?? {});
    });
  }, [userId]);

  return learned;
}
