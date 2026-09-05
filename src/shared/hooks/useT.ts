'use client';

import { useMemo } from 'react';
import { useAppSelector } from '@/store/store';
import { makeT, type TFunc } from '@/shared/utils/makeT';

export function useT(): TFunc {
  const language = useAppSelector((s) => s.ui.language);
  // One translator per language, not one per render: this value is passed as
  // a prop all over the app, and a fresh closure each time defeats every
  // memoisation downstream of it.
  return useMemo(() => makeT(language), [language]);
}
