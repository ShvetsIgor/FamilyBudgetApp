import type { Currency } from '@/shared/types';
import {
  Timestamp, collection, doc, getDoc, getDocs, query, where, orderBy, setDoc,
  serverTimestamp, type DocumentData,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { format, subMonths } from 'date-fns';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
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

/**
 * A month's stats, from the stored aggregate when it can be trusted.
 *
 * The `monthlyStats` collection has been written by every expense and income
 * path for a long time — batched, per currency — while this reader ignored it
 * and re-queried the raw collections instead. For `/analytics` over six months
 * that is twelve range queries reading every expense and income document the
 * user owns, on every visit; the stored aggregate is six document reads.
 *
 * Trust rule: only a document explicitly marked `currencyBreakdownComplete` is
 * used. Incremental deltas alone never set that flag, so a document built
 * purely from `increment()` calls on top of nothing is treated as absent —
 * exactly right, because it has no baseline to be complete against.
 *
 * Caching rule: only CLOSED months are written back. The current month is
 * still moving, and a snapshot taken from a query is stale the instant an
 * expense lands; past months only change through the delta writers, which
 * `increment()` the cached document and keep it correct. Even for a closed
 * month the write is skipped if the document changed while we were computing.
 */
export async function fetchMonthStats(userId: string, month: string): Promise<MonthStats> {
  const ref = statsDoc(userId, month);

  let before: DocumentData | undefined;
  try {
    const snap = await getDoc(ref);
    before = snap.data();
    if (before?.currencyBreakdownComplete === true) return fromStoredStats(month, before);
  } catch { /* offline or denied: fall through to computing it */ }

  const computed = await computeMonthStats(userId, month);

  if (isClosedMonth(month)) {
    try {
      const now = await getDoc(ref);
      const unchanged =
        (now.data()?.updatedAt?.toMillis?.() ?? null) === (before?.updatedAt?.toMillis?.() ?? null);
      // A delta that landed mid-computation would be overwritten by our
      // pre-edit snapshot; leave the document alone and cache on a later visit.
      if (unchanged) {
        await setDoc(ref, {
          ...computed,
          userId,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
    } catch { /* caching is an optimisation, never a failure */ }
  }

  return computed;
}

function statsDoc(userId: string, month: string) {
  return doc(getDb(), 'monthlyStats', userId, 'months', month);
}

/** True once the month is over, so nothing new can be dated into it. */
function isClosedMonth(month: string): boolean {
  return month < toLocalMonthKey(new Date());
}

function fromStoredStats(month: string, data: DocumentData): MonthStats {
  return {
    month,
    totalExpenses: (data.totalExpenses as number) ?? 0,
    totalIncome: (data.totalIncome as number) ?? 0,
    byCategory: (data.byCategory as Record<string, number>) ?? {},
    totalsByCurrency: (data.totalsByCurrency as Partial<Record<Currency, number>>) ?? {},
    incomeByCurrency: (data.incomeByCurrency as Partial<Record<Currency, number>>) ?? {},
    byCategoryByCurrency:
      (data.byCategoryByCurrency as Partial<Record<Currency, Record<string, number>>>) ?? {},
    currencyBreakdownComplete: true,
  };
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
