'use client';

import { useState, useEffect } from 'react';
import { useAppSelector } from '@/store/store';
import { fetchLearnedKeywords } from '@/features/chat/parser/learning';
import type { KeywordHit } from '@/features/chat/parser/dictionary';

export function useLearnedKeywords(): [Record<string, KeywordHit>, (kw: string, hit: KeywordHit) => void] {
  const userId = useAppSelector((s) => s.auth.user?.id);
  const [learned, setLearned] = useState<Record<string, KeywordHit>>({});

  useEffect(() => {
    if (!userId) return;
    fetchLearnedKeywords(userId).then(setLearned).catch(() => {});
  }, [userId]);

  function addLearned(kw: string, hit: KeywordHit) {
    setLearned((prev) => ({ ...prev, [kw.toLowerCase()]: hit }));
  }

  return [learned, addLearned];
}
