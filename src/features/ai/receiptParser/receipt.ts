import { PARSER_CURRENCIES, type ParserCurrency } from '../expenseParser/schema';

/**
 * A photographed receipt, read by the vision model and cleaned here. Shared by
 * the server (sanitizing the model's answer) and the chat (the receipt card
 * and the save), so both sides agree on what a usable receipt is.
 *
 * Money rule, as for every chat entry: nothing is saved from a receipt until
 * each amount has a category the USER confirmed. The model's categories only
 * pre-fill the card; the part it could not read stays without a category.
 */

export interface ReceiptGroup {
  /** null: not recognized, or not attributable — the user must choose */
  categoryId: string | null;
  amount: number;
  /** Line names behind this amount, for the card only */
  names: string[];
}

export interface ReceiptDraft {
  merchant: string | null;
  date: string;
  currency: ParserCurrency;
  total: number;
  groups: ReceiptGroup[];
}

export type ReceiptRejection = 'unreadable' | 'no_total' | 'currency';

const MAX_TOTAL = 10_000_000;
const MAX_ITEMS = 60;
const MAX_AGE_DAYS = 366;

const cents = (value: number) => Math.round(value * 100) / 100;

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return text || null;
}

function dayNumber(key: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  const [y, m, d] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    ? date.getTime() / 86_400_000 : null;
}

/**
 * The model's JSON → a receipt the card can show, or why it cannot.
 * - no readable total → rejected: a receipt is recorded by its total;
 * - a printed currency the app does not support → rejected, never converted;
 *   an unreadable one falls back to the account currency, shown on the card;
 * - a missing, impossible, future or year-old date → today (shown on the card);
 * - line items that add up to MORE than the total are unreliable and are
 *   dropped, so the whole total is one group to classify;
 * - whatever the lines do not cover is its own uncategorized group.
 */
export function sanitizeReceipt(
  raw: unknown,
  { categoryIds, defaultCurrency, todayKey }: { categoryIds: readonly string[]; defaultCurrency: ParserCurrency; todayKey: string },
): { ok: true; receipt: ReceiptDraft } | { ok: false; reason: ReceiptRejection } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, reason: 'unreadable' };
  const r = raw as Record<string, unknown>;

  const total = typeof r.total === 'number' && Number.isFinite(r.total) && r.total > 0 && r.total <= MAX_TOTAL
    ? cents(r.total) : null;
  if (total === null) return { ok: false, reason: 'no_total' };

  let currency: ParserCurrency = defaultCurrency;
  if (r.currency !== null && r.currency !== undefined) {
    if (typeof r.currency !== 'string' || !(PARSER_CURRENCIES as readonly string[]).includes(r.currency)) {
      return { ok: false, reason: 'currency' };
    }
    currency = r.currency as ParserCurrency;
  }

  const today = dayNumber(todayKey);
  const day = typeof r.date === 'string' ? dayNumber(r.date) : null;
  const date = day !== null && today !== null && day <= today && today - day <= MAX_AGE_DAYS ? (r.date as string) : todayKey;

  const items = (Array.isArray(r.items) ? r.items : []).slice(0, MAX_ITEMS).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { name, amount, categoryId } = item as Record<string, unknown>;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) return [];
    return [{
      name: cleanText(name, 60) ?? '',
      amount: cents(amount),
      categoryId: typeof categoryId === 'string' && categoryIds.includes(categoryId) ? categoryId : null,
    }];
  });
  const itemSum = cents(items.reduce((sum, item) => sum + item.amount, 0));
  const reliable = itemSum <= total + 0.01;

  const byCategory = new Map<string | null, ReceiptGroup>();
  for (const item of reliable ? items : []) {
    const group = byCategory.get(item.categoryId) ?? { categoryId: item.categoryId, amount: 0, names: [] };
    group.amount = cents(group.amount + item.amount);
    if (item.name) group.names.push(item.name);
    byCategory.set(item.categoryId, group);
  }
  const covered = reliable ? itemSum : 0;
  const remainder = cents(total - covered);
  if (remainder > 0.009) {
    const unknown = byCategory.get(null) ?? { categoryId: null, amount: 0, names: [] };
    unknown.amount = cents(unknown.amount + remainder);
    byCategory.set(null, unknown);
  }

  return {
    ok: true,
    receipt: {
      merchant: cleanText(r.merchant, 60),
      date, currency, total,
      // Largest first; the uncategorized part last, where the card asks about it
      groups: [...byCategory.values()].sort((a, b) =>
        Number(a.categoryId === null) - Number(b.categoryId === null) || b.amount - a.amount),
    },
  };
}

/**
 * One expense with splits, the app's shape for a divided purchase: the largest
 * group is the main category (it also takes any rounding remainder), every
 * other group is a split. Refuses while any group lacks a category.
 */
export function receiptExpenseParts(groups: readonly ReceiptGroup[]): {
  categoryId: string;
  splits: { categoryId: string; amount: number }[];
} {
  if (groups.length === 0 || groups.some((group) => !group.categoryId)) {
    throw new Error('Every receipt amount needs a category before saving');
  }
  // Two groups the user moved into the same category become one
  const merged = new Map<string, number>();
  for (const group of groups) merged.set(group.categoryId!, cents((merged.get(group.categoryId!) ?? 0) + group.amount));
  const [main, ...rest] = [...merged.entries()].sort((a, b) => b[1] - a[1]);
  return { categoryId: main[0], splits: rest.map(([categoryId, amount]) => ({ categoryId, amount })) };
}
