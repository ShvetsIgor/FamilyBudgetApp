import { ru, enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';

/**
 * Maps the app UI language ('en' | 'ru') to a date-fns locale.
 * Use this instead of importing `ru` directly so month/day names
 * follow the active language.
 */
export function getDateFnsLocale(language: string): Locale {
  return language === 'ru' ? ru : enUS;
}
