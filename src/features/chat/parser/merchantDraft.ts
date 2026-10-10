import { STORES } from './dictionaries/stores';
import type { ParserCurrency } from '@/features/ai/expenseParser/schema';

export interface ChatExpenseDraft {
  amount: number;
  currency: ParserCurrency;
  date: string;
  merchant: string | null;
  description: string | null;
  categoryId: string | null;
  /** Exact supermarket + amount shorthand. Still requires category confirmation. */
  merchantOnly?: true;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export function exactMerchant(name: string) {
  const key = normalize(name);
  return STORES.find((store) => [store.name, ...store.aliases].some((alias) => normalize(alias) === key));
}

/** No fallback for free text: extra words, currencies, dates and signs go to AI. */
function matchMerchantDraft(text: string) {
  const input = text.trim();
  const trailing = /^(.+?)\s+(\d+(?:[.,]\d{1,2})?)$/.exec(input);
  const leading = /^(\d+(?:[.,]\d{1,2})?)\s+(.+)$/.exec(input);
  const name = trailing?.[1] ?? leading?.[2];
  const rawAmount = trailing?.[2] ?? leading?.[1];
  if (!name || !rawAmount) return null;
  const store = exactMerchant(name);
  const amount = Number(rawAmount.replace(',', '.'));
  if (store?.storeGroup !== 'supermarket' || !Number.isFinite(amount) || amount <= 0) return null;
  return { store, amount };
}

/** Text-only answer to «would parseMerchantDraft draft this?», for gating before profile reads. */
export function isMerchantDraftText(text: string): boolean {
  return matchMerchantDraft(text) !== null;
}

export function parseMerchantDraft(text: string, currency: ParserCurrency, date: string): ChatExpenseDraft | null {
  const match = matchMerchantDraft(text);
  if (!match) return null;
  return { amount: match.amount, currency, date, merchant: match.store.name, description: null, categoryId: null, merchantOnly: true };
}
