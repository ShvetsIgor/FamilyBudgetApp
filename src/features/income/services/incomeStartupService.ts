import { addIncome, fetchMonthIncome } from './incomeService';
import { advanceRecurringIncomeNextDue, fetchRecurringIncome } from './recurringIncomeService';
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
    for (const item of recurring) {
      if (!item.isActive || item.nextDueDate > todayStr) continue;
      const [y, m, d] = item.nextDueDate.split('-').map(Number);
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
      generated.unshift(income);
      await advanceRecurringIncomeNextDue(userId, item);
    }
  } catch { /* recurring application is best-effort */ }

  return [...generated, ...list];
}
