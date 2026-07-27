import type { Currency } from '@/shared/types';
import { doc, setDoc, serverTimestamp, Timestamp, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { format, subMonths } from 'date-fns';
import type { SplitItem } from '@/shared/types';

export interface MonthStats {
  month: string; // 'YYYY-MM'
  /**
   * Blind sum across currencies — kept for legacy documents only.
   * Prefer `totalsByCurrency`; adding ₪ and $ into one number is a lie.
   */
  totalExpenses: number;
  totalIncome: number;
  byCategory: Record<string, number>;
  /** Spend per currency, e.g. { ILS: 5950, USD: 12 }. Absent on old docs. */
  totalsByCurrency?: Partial<Record<Currency, number>>;
  /** Income per currency. Absent on old docs. */
  incomeByCurrency?: Partial<Record<Currency, number>>;
  /** Category totals per currency. Absent or partial on old documents. */
  byCategoryByCurrency?: Partial<Record<Currency, Record<string, number>>>;
  /**
   * True only when the currency maps cover the whole month. Incremental writes
   * to a legacy document can create partial maps, which must not be trusted.
   */
  currencyBreakdownComplete?: boolean;
}

/**
 * Re-reads stored stats in ONE currency, so charts never plot ₪ and $ added
 * together. Documents written before per-currency totals existed have no
 * breakdown; their blind sum is used as-is (it was single-currency in practice).
 * Complete documents also carry per-currency category maps, keeping pie charts
 * and totals on the same currency basis.
 */
export function toOwnCurrency(stats: MonthStats, currency: Currency): MonthStats {
  // A complete breakdown that lacks this currency means ZERO. Partial maps can
  // exist on legacy monthlyStats documents after their first post-upgrade
  // write, so only explicitly complete maps are authoritative.
  const hasCompleteBreakdown = stats.currencyBreakdownComplete === true;
  return {
    ...stats,
    totalExpenses: hasCompleteBreakdown && stats.totalsByCurrency
      ? (stats.totalsByCurrency[currency] ?? 0)
      : stats.totalExpenses,
    totalIncome: hasCompleteBreakdown && stats.incomeByCurrency
      ? (stats.incomeByCurrency[currency] ?? 0)
      : stats.totalIncome,
    byCategory: hasCompleteBreakdown && stats.byCategoryByCurrency
      ? (stats.byCategoryByCurrency[currency] ?? {})
      : stats.byCategory,
  };
}

/** Totals in every currency other than the account's own, summed over months. */
export function foreignTotals(
  months: MonthStats[],
  currency: Currency,
): { currency: Currency; total: number }[] {
  const acc = new Map<Currency, number>();
  for (const m of months) {
    if (m.currencyBreakdownComplete !== true) continue;
    for (const [code, value] of Object.entries(m.totalsByCurrency ?? {})) {
      if (code === currency || !value) continue;
      acc.set(code as Currency, (acc.get(code as Currency) ?? 0) + value);
    }
  }
  return [...acc.entries()]
    .map(([c, total]) => ({ currency: c, total }))
    .sort((a, b) => b.total - a.total);
}

export async function fetchMonthStats(userId: string, month: string): Promise<MonthStats> {
  return computeMonthStats(userId, month);
}

async function computeMonthStats(userId: string, month: string): Promise<MonthStats> {
  const [year, m] = month.split('-').map(Number);
  const from = Timestamp.fromDate(new Date(year, m - 1, 1));
  const to = Timestamp.fromDate(new Date(year, m, 1));

  const [expSnap, incSnap] = await Promise.all([
    getDocs(query(
      collection(getDb(), 'expenses', userId, 'items'),
      where('date', '>=', from),
      where('date', '<', to),
      orderBy('date', 'desc')
    )),
    getDocs(query(
      collection(getDb(), 'incomes', userId, 'items'),
      where('date', '>=', from),
      where('date', '<', to),
      orderBy('date', 'desc')
    )),
  ]);

  let totalExpenses = 0;
  const totalsByCurrency: Partial<Record<Currency, number>> = {};
  const byCategory: Record<string, number> = {};
  const byCategoryByCurrency: Partial<Record<Currency, Record<string, number>>> = {};

  for (const d of expSnap.docs) {
    const data = d.data();
    const amount = data.amount as number;
    const currency = data.currency as Currency;
    const categoryId = data.categoryId as string;
    const splits = (data.splits as SplitItem[]) ?? [];
    const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
    const currencyCategories = byCategoryByCurrency[currency] ?? {};
    byCategoryByCurrency[currency] = currencyCategories;

    totalExpenses += amount;
    totalsByCurrency[currency] = (totalsByCurrency[currency] ?? 0) + amount;
    byCategory[categoryId] = (byCategory[categoryId] ?? 0) + (amount - splitTotal);
    currencyCategories[categoryId] = (currencyCategories[categoryId] ?? 0) + (amount - splitTotal);
    for (const sp of splits) {
      if (sp.categoryId && sp.amount > 0) {
        byCategory[sp.categoryId] = (byCategory[sp.categoryId] ?? 0) + sp.amount;
        currencyCategories[sp.categoryId] = (currencyCategories[sp.categoryId] ?? 0) + sp.amount;
      }
    }
  }

  let totalIncome = 0;
  const incomeByCurrency: Partial<Record<Currency, number>> = {};
  for (const d of incSnap.docs) {
    const data = d.data();
    const amount = data.amount as number;
    const currency = data.currency as Currency;
    totalIncome += amount;
    incomeByCurrency[currency] = (incomeByCurrency[currency] ?? 0) + amount;
  }

  return {
    month,
    totalExpenses,
    totalIncome,
    byCategory,
    totalsByCurrency,
    incomeByCurrency,
    byCategoryByCurrency,
    currencyBreakdownComplete: true,
  };
}

export async function fetchLastNMonths(userId: string, n: number): Promise<MonthStats[]> {
  const months = Array.from({ length: n }, (_, i) =>
    format(subMonths(new Date(), i), 'yyyy-MM')
  ).reverse();

  const results = await Promise.all(months.map((m) => fetchMonthStats(userId, m)));
  return results;
}

export async function recalculateMonthStats(userId: string, month: string): Promise<MonthStats> {
  const [year, m] = month.split('-').map(Number);
  const from = Timestamp.fromDate(new Date(year, m - 1, 1));
  const to = Timestamp.fromDate(new Date(year, m, 1));

  // Read all expenses for the month
  const expSnap = await getDocs(
    query(
      collection(getDb(), 'expenses', userId, 'items'),
      where('date', '>=', from),
      where('date', '<', to),
      orderBy('date', 'desc')
    )
  );

  let totalExpenses = 0;
  const totalsByCurrency: Partial<Record<Currency, number>> = {};
  const byCategory: Record<string, number> = {};
  const byCategoryByCurrency: Partial<Record<Currency, Record<string, number>>> = {};

  for (const d of expSnap.docs) {
    const data = d.data();
    const amount = data.amount as number;
    const currency = data.currency as Currency;
    const categoryId = data.categoryId as string;
    const splits = (data.splits as SplitItem[]) ?? [];
    const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
    const mainAmount = amount - splitTotal;
    const currencyCategories = byCategoryByCurrency[currency] ?? {};
    byCategoryByCurrency[currency] = currencyCategories;

    totalExpenses += amount;
    totalsByCurrency[currency] = (totalsByCurrency[currency] ?? 0) + amount;
    byCategory[categoryId] = (byCategory[categoryId] ?? 0) + mainAmount;
    currencyCategories[categoryId] = (currencyCategories[categoryId] ?? 0) + mainAmount;
    for (const sp of splits) {
      if (sp.categoryId && sp.amount > 0) {
        byCategory[sp.categoryId] = (byCategory[sp.categoryId] ?? 0) + sp.amount;
        currencyCategories[sp.categoryId] = (currencyCategories[sp.categoryId] ?? 0) + sp.amount;
      }
    }
  }

  // Read all income for the month
  const incSnap = await getDocs(
    query(
      collection(getDb(), 'incomes', userId, 'items'),
      where('date', '>=', from),
      where('date', '<', to),
      orderBy('date', 'desc')
    )
  );

  let totalIncome = 0;
  const incomeByCurrency: Partial<Record<Currency, number>> = {};
  for (const d of incSnap.docs) {
    const data = d.data();
    const amount = data.amount as number;
    const currency = data.currency as Currency;
    totalIncome += amount;
    incomeByCurrency[currency] = (incomeByCurrency[currency] ?? 0) + amount;
  }

  const ref = doc(getDb(), 'monthlyStats', userId, 'months', month);
  await setDoc(ref, {
    userId,
    month,
    totalExpenses,
    totalIncome,
    totalsByCurrency,
    incomeByCurrency,
    byCategoryByCurrency,
    currencyBreakdownComplete: true,
    byCategory,
    updatedAt: serverTimestamp(),
  });

  return {
    month,
    totalExpenses,
    totalIncome,
    totalsByCurrency,
    incomeByCurrency,
    byCategoryByCurrency,
    currencyBreakdownComplete: true,
    byCategory,
  };
}
