import en from '@/messages/en.json';
import ru from '@/messages/ru.json';

// Only the active locales are bundled. Hebrew is paused by the runtime
// contract, so src/messages/he.json stays on disk for whenever RTL is picked
// up again, but shipping it to every user costs bytes for a catalog no
// language setting can select (`Language` is 'en' | 'ru').
const messages = { en, ru } as Record<string, Record<string, unknown>>;

export type TFunc = ((key: string, params?: Record<string, string | number>) => string) & {
  cat: (name: string) => string;
};

/**
 * Non-hook translator for a given language ('en' | 'ru' | 'he').
 * Use in non-React code (bot replies, services) where useT() is unavailable;
 * components should keep using useT().
 */
export function makeT(language: string): TFunc {
  const msgs = messages[language] ?? messages.en;

  function lookup(source: Record<string, unknown>, parts: string[]): unknown {
    let value: unknown = source;
    for (const part of parts) {
      if (value == null || typeof value !== 'object') return undefined;
      value = (value as Record<string, unknown>)[part];
    }
    return value;
  }

  const t = function (key: string, params?: Record<string, string | number>): string {
    const parts = key.split('.');
    const localized = lookup(msgs, parts);
    const val = typeof localized === 'string' ? localized : lookup(messages.en, parts);
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
