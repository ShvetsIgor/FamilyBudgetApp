'use client';

import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { hydrateDisplayPreferences } from '@/features/ui/store/uiSlice';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((s) => s.ui.theme);
  const isDarkMode = useAppSelector((s) => s.ui.isDarkMode);
  const language = useAppSelector((s) => s.ui.language);

  useEffect(() => {
    dispatch(hydrateDisplayPreferences());
  }, [dispatch]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', isDarkMode);
    root.setAttribute('lang', language);
    root.setAttribute('dir', 'ltr');
  }, [theme, isDarkMode, language]);

  return <>{children}</>;
}
