'use client';

import { useEffect } from 'react';
import { useAppSelector } from '@/store/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppSelector((s) => s.ui.theme);
  const language = useAppSelector((s) => s.ui.language);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.setAttribute('lang', language);
    root.setAttribute('dir', 'ltr');
  }, [theme, language]);

  return <>{children}</>;
}
