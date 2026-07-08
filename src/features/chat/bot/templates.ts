import { makeT } from '@/shared/utils/makeT';

export function savedPhrase(language: string = 'ru'): string {
  const t = makeT(language);
  const variants = [t('chat.bot.saved1'), t('chat.bot.saved2'), t('chat.bot.saved3')];
  return variants[Math.floor(Math.random() * variants.length)];
}

export function clarifyPhrase(amount: number, currency: string, language: string = 'ru'): string {
  return makeT(language)('chat.bot.clarifyWhere', { currency, amount });
}

export function clarifyStorePhrase(storeName: string, amount: number, currency: string, language: string = 'ru'): string {
  return makeT(language)('chat.bot.clarifyStore', { currency, amount, store: storeName });
}

export function unknownPhrase(language: string = 'ru'): string {
  return makeT(language)('chat.bot.unknown');
}

export function duplicatePhrase(language: string = 'ru'): string {
  return makeT(language)('chat.bot.duplicate');
}

// Legacy RU constants — prefer the language-aware functions above
export const UNKNOWN_PHRASE = 'Не понял 🤔 Попробуй: «кофе 65» или «☕ 30»';

export const DUPLICATE_PHRASE = 'Это тот же чек или ещё один?';
