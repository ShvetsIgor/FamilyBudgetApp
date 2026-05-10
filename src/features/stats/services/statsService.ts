import { doc, getDoc } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { format, subMonths } from 'date-fns';

export interface MonthStats {
  month: string; // 'YYYY-MM'
  totalExpenses: number;
  totalIncome: number;
  byCategory: Record<string, number>;
}

export async function fetchMonthStats(userId: string, month: string): Promise<MonthStats> {
  const snap = await getDoc(doc(getDb(), 'monthlyStats', userId, 'months', month));
  if (!snap.exists()) {
    return { month, totalExpenses: 0, totalIncome: 0, byCategory: {} };
  }
  const data = snap.data();
  return {
    month,
    totalExpenses: data.totalExpenses ?? 0,
    totalIncome: data.totalIncome ?? 0,
    byCategory: data.byCategory ?? {},
  };
}

export async function fetchLastNMonths(userId: string, n: number): Promise<MonthStats[]> {
  const months = Array.from({ length: n }, (_, i) =>
    format(subMonths(new Date(), i), 'yyyy-MM')
  ).reverse();

  const results = await Promise.all(months.map((m) => fetchMonthStats(userId, m)));
  return results;
}
