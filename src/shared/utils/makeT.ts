import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

const messages = { en, ru } as Record<string, Record<string, unknown>>;

export type TFunc = ((key: string, params?: Record<string, string | number>) => string) & {
  cat: (name: string) => string;
};

/**
 * Non-hook translator for a given language ('en' | 'ru').
 * Use in non-React code (bot replies, services) where useT() is unavailable;
 * components should keep using useT().
 */
export function makeT(language: string): TFunc {
  const msgs = messages[language] ?? messages.en;

  const t = function (key: string, params?: Record<string, string | number>): string {
    const parts = key.split('.');
    let val: unknown = msgs;
    for (const p of parts) {
      if (val == null || typeof val !== 'object') return key;
      val = (val as Record<string, unknown>)[p];
    }
    let result = typeof val === 'string' ? val : key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replaceAll(`{${k}}`, String(v));
      }
    }
    return result;
  } as TFunc;

  t.cat = function (name: string): string {
    const k = `cats.${name}`;
    const val = t(k);
    return val === k ? name : val;
  };

  return t;
}
