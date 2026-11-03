import { startOfWeek, subDays } from 'date-fns';
import { store } from '@/store/store';
import { mergeExpenses } from '@/features/expenses/store/expensesSlice';
import { fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { collectDigestContext } from './context';
import { markMorningGreetingSent, sendMorningGreeting, shouldSendMorningGreeting } from './morning';
import { markWeeklySummarySent, sendWeeklySummary, shouldSendWeeklySummary } from './weekly';

/**
 * Months a digest adds up: «yesterday» and «this week» reach into the previous
 * month on the 1st and in about one week out of four, while the app only keeps
 * the current month loaded.
 */
export function digestMonths(now: Date): string[] {
  return [...new Set([now, subDays(now, 1), startOfWeek(now, { weekStartsOn: 1 })].map((day) => toLocalMonthKey(day)))];
}

/** Puts every month a digest reads into the store. A failed read rejects: no total beats a wrong one. */
export async function loadDigestMonths(userId: string, now: Date, alreadyLoaded?: string): Promise<boolean> {
  const months = digestMonths(now).filter((month) => month !== alreadyLoaded);
  const lists = await Promise.all(months.map((month) => fetchMonthExpenses(userId, month)));
  if (store.getState().auth.user?.id !== userId) return false;
  const expenses = lists.flat();
  if (expenses.length > 0) store.dispatch(mergeExpenses(expenses));
  return true;
}

/**
 * Sends the digests due today. The caller waits for the current month, income
 * and limits; a digest marked as sent cannot be sent again today, so a failed
 * read marks nothing and the next launch tries again.
 */
export async function sendDueDigests(userId: string, now: Date = new Date()): Promise<void> {
  const morning = shouldSendMorningGreeting();
  const weekly = shouldSendWeeklySummary();
  if (!morning && !weekly) return;
  if (!await loadDigestMonths(userId, now, toLocalMonthKey(now))) return;
  const ctx = collectDigestContext(store.getState(), now);
  if (!ctx) return;
  if (morning) {
    markMorningGreetingSent();
    await sendMorningGreeting(ctx, now);
  }
  if (weekly) {
    markWeeklySummarySent();
    await sendWeeklySummary(ctx, now);
  }
}
