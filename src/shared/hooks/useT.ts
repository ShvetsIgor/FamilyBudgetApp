'use client';

import { useAppSelector } from '@/store/store';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

const messages = { en, ru } as Record<string, Record<string, unknown>>;

export function useT() {
  const language = useAppSelector((s) => s.ui.language);
  const msgs = messages[language] ?? messages.en;

  return function t(key: string): string {
    const parts = key.split('.');
    let val: unknown = msgs;
    for (const p of parts) {
      if (val == null || typeof val !== 'object') return key;
      val = (val as Record<string, unknown>)[p];
    }
    return typeof val === 'string' ? val : key;
  };
}
