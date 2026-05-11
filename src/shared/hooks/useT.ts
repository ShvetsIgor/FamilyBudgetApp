'use client';

import { useAppSelector } from '@/store/store';
import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

const messages = { en, ru } as Record<string, Record<string, unknown>>;

type TFunc = ((key: string) => string) & { cat: (name: string) => string };

export function useT(): TFunc {
  const language = useAppSelector((s) => s.ui.language);
  const msgs = messages[language] ?? messages.en;

  const t = function(key: string): string {
    const parts = key.split('.');
    let val: unknown = msgs;
    for (const p of parts) {
      if (val == null || typeof val !== 'object') return key;
      val = (val as Record<string, unknown>)[p];
    }
    return typeof val === 'string' ? val : key;
  } as TFunc;

  t.cat = function(name: string): string {
    const k = `cats.${name}`;
    const val = t(k);
    return val === k ? name : val;
  };

  return t;
}
