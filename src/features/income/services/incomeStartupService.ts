import { addIncome, fetchMonthIncome } from './incomeService';
import {
  dueIncomeOccurrences,
  fetchRecurringIncome,
  nextIncomeDueDate,
  setRecurringIncomeNextDue,
} from './recurringIncomeService';
import { toLocalDateKey, toLocalMonthKey } from '@/shared/utils/dateKey';
import type { SerializableIncome } from '@/shared/types';

/**
 * Current-month incomes for app start: fetches the month list and applies any
 * due recurring incomes (occurrence + schedule advance).
 *
 * This used to live only in the /income mount effect, so the chat's auto
 * budget saw zero income until that page was visited. Call it exactly once
 * per session (the app layout owns it, guarded by income status === 'idle');
 * concurrent callers would double-generate recurring occurrences.
 */
export async function loadCurrentMonthIncomes(userId: string): Promise<SerializableIncome[]> {
  const list = await fetchMonthIncome(userId, toLocalMonthKey(new Date()));

  const generated: SerializableIncome[] = [];
  try {
    const todayStr = toLocalDateKey(new Date());
    const recurring = await fetchRecurringIncome(userId);
    const thisMonth = toLocalMonthKey(new Date());
    for (const item of recurring) {
      if (!item.isActive) continue;
      // EVERY missed occurrence, not just the oldest one: booking one per
      // launch made a user who had been away for three months relaunch the app
      // three times before their salaries were all recorded.
      const owed = dueIncomeOccurrences(item.nextDueDate, item.dayOfMonth, todayStr);
      if (owed.length === 0) continue;

      for (const due of owed) {
        const [y, m, d] = due.split('-').map(Number);
        const income = await addIncome({
          userId,
          amount: item.amount,
          currency: item.currency,
          categoryId: item.categoryId,
          date: new Date(y, m - 1, d, 12, 0, 0),
          method: 'bank',
          tags: ['recurring'],
          privacy: 'regular',
          comment: item.name,
        });
        // Only this month's occurrences belong in the month list this returns;
        // a June salary booked in September must not land in September's list.
        if (toLocalMonthKey(income.date) === thisMonth) generated.unshift(income);
      }

      // One write for the whole catch-up instead of one per occurrence.
      await setRecurringIncomeNextDue(
        userId, item.id,
        nextIncomeDueDate(owed[owed.length - 1], item.dayOfMonth),
      );
    }
  } catch { /* recurring application is best-effort */ }

  return [...generated, ...list];
}
