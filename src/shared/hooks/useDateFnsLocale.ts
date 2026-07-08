'use client';

import { useAppSelector } from '@/store/store';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';

/** date-fns locale matching the active UI language. */
export function useDateFnsLocale() {
  const language = useAppSelector((s) => s.ui.language);
  return getDateFnsLocale(language);
}
