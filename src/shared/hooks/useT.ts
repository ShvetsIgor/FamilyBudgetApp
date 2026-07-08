'use client';

import { useAppSelector } from '@/store/store';
import { makeT, type TFunc } from '@/shared/utils/makeT';

export function useT(): TFunc {
  const language = useAppSelector((s) => s.ui.language);
  return makeT(language);
}
