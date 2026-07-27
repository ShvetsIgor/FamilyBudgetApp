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
}

/**
 * Re-reads stored stats in ONE currency, so charts never plot ₪ and $ added
 * together. Documents written before per-currency totals existed have no
 * breakdown; their blind sum is used as-is (it was single-currency in practice).
 *
 * Known limit: `byCategory` is still a blind sum, so a category that holds
 * foreign spend is overstated in the category breakdown. Totals — the numbers
 * people actually read — are exact.
 */
export function toOwnCurrency(stats: MonthStats, currency: Currency): MonthStats {
  // A breakdown that simply lacks this currency means ZERO in it — falling back
  // to the blind sum there would relabel someone else's money as yours.
  return {
    ...stats,
    totalExpenses: stats.totalsByCurrency
      ? (stats.totalsByCurrency[currency] ?? 0)
      : stats.totalExpenses,
    totalIncome: stats.incomeByCurrency
      ? (stats.incomeByCurrency[currency] ?? 0)
      : stats.totalIncome,
  };
}

/** Totals in every currency other than the account's own, summed over months. */
export function foreignTotals(
  months: MonthStats[],
  currency: Currency,
): { currency: Currency; total: number }[] {
  const acc = new Map<Currency, number>();
  for (const m of months) {
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
  const byCategory: Record<string, number> = {};

  for (const d of expSnap.docs) {
    const data = d.data();
    const amount = data.amount as number;
    const categoryId = data.categoryId as string;
    const splits = (data.splits as SplitItem[]) ?? [];
    const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);

    totalExpenses += amount;
    byCategory[categoryId] = (byCategory[categoryId] ?? 0) + (amount - splitTotal);
    for (const sp of splits) {
      if (sp.categoryId && sp.amount > 0) {
        byCategory[sp.categoryId] = (byCategory[sp.categoryId] ?? 0) + sp.amount;
      }
    }
  }

  const totalIncome = incSnap.docs.reduce((s, d) => s + (d.data().amount as number), 0);

  return { month, totalExpenses, totalIncome, byCategory };
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
  const byCategory: Record<string, number> = {};

  for (const d of expSnap.docs) {
    const data = d.data();
    const amount = data.amount as number;
    const categoryId = data.categoryId as string;
    const splits = (data.splits as SplitItem[]) ?? [];
    const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
    const mainAmount = amount - splitTotal;

    totalExpenses += amount;
    byCategory[categoryId] = (byCategory[categoryId] ?? 0) + mainAmount;
    for (const sp of splits) {
      if (sp.categoryId && sp.amount > 0) {
        byCategory[sp.categoryId] = (byCategory[sp.categoryId] ?? 0) + sp.amount;
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
  for (const d of incSnap.docs) {
    totalIncome += (d.data().amount as number);
  }

  const ref = doc(getDb(), 'monthlyStats', userId, 'months', month);
  await setDoc(ref, {
    userId,
    month,
    totalExpenses,
    totalIncome,
    byCategory,
    updatedAt: serverTimestamp(),
  });

  return { month, totalExpenses, totalIncome, byCategory };
}
