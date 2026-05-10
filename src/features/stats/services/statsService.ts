import { doc, setDoc, serverTimestamp, Timestamp, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { format, subMonths } from 'date-fns';
import type { SplitItem } from '@/shared/types';

export interface MonthStats {
  month: string; // 'YYYY-MM'
  totalExpenses: number;
  totalIncome: number;
  byCategory: Record<string, number>;
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
