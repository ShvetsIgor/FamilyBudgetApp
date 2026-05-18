const SAVED_PHRASES = [
  'Записал',
  'Добавил',
  'Готово',
];

export function savedPhrase(): string {
  return SAVED_PHRASES[Math.floor(Math.random() * SAVED_PHRASES.length)];
}

export function clarifyPhrase(amount: number, currency: string): string {
  return `Не понял, ${currency}${amount} куда? 🤔`;
}

export function clarifyStorePhrase(storeName: string, amount: number, currency: string): string {
  return `${currency}${amount} в ${storeName} — что брал? 🛒`;
}

export const UNKNOWN_PHRASE =
  'Не понял 🤔 Попробуй: «кофе 65» или «☕ 30»';

export const DUPLICATE_PHRASE =
  'Это тот же чек или ещё один?';
