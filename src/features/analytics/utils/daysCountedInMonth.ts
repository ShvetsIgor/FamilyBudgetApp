import { toLocalMonthKey } from '@/shared/utils/dateKey';

/**
 * Days a month's spend is averaged over: the days so far in the current month,
 * all of them otherwise. Compares keys: `new Date('2026-11-01')` is UTC, which
 * west of Greenwich is still October, and the current month then counted as full.
 */
export function daysCountedInMonth(month: string, now: Date): number {
  if (month === toLocalMonthKey(now)) return now.getDate();
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(year, monthNumber, 0).getDate();
}
