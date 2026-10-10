import { doc, runTransaction } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { readEntryPrivacy } from '@/shared/services/entryPrivacy';
import { queueAddIncome, fetchMonthIncome } from './incomeService';
import { fetchRecurringIncome, nextIncomeDueDate } from './recurringIncomeService';
import { toLocalDateKey, toLocalMonthKey } from '@/shared/utils/dateKey';

/** Each occurrence and the schedule advance commit together, even across devices. */
export async function loadCurrentMonthIncomes(userId: string, onRecurringError: (error: unknown) => void = console.error) {
  const today = toLocalDateKey(new Date());
  const recurring = await fetchRecurringIncome(userId).catch(error => { onRecurringError(error); return []; });
  for (const item of recurring) {
    try {
      for (let n = 0; n < 120; n++) {
        const applied = await runTransaction(getDb(), async tx => {
          const ref = doc(getDb(), 'recurringIncome', userId, 'items', item.id);
          const snap = await tx.get(ref);
          if (!snap.exists()) return false;
          const current = snap.data();
          const due = current.nextDueDate as string;
          if (!current.isActive || !/^\d{4}-\d{2}-\d{2}$/.test(due) || due > today) return false;
          const next = nextIncomeDueDate(due, current.dayOfMonth);
          if (next <= due) throw new Error('invalid-recurring-schedule');
          const entryId = `recurring-${item.id}-${due}`;
          // Noon, not midnight: read in any timezone further west, a midnight
          // timestamp falls on the previous day — and on the 1st, the previous month.
          const [y, m, d] = due.split('-').map(Number);
          const saved = await tx.get(doc(getDb(), 'incomes', userId, 'items', entryId));
          const privacy = await readEntryPrivacy(tx, userId, 'income', [current.categoryId]);
          if (!saved.exists()) queueAddIncome(tx, {
            userId, amount: current.amount, currency: current.currency, categoryId: current.categoryId,
            date: new Date(y, m - 1, d, 12), method: 'bank', privacy, tags: ['recurring'], comment: current.name,
          }, entryId);
          tx.update(ref, { nextDueDate: next });
          return true;
        });
        if (!applied) break;
      }
    } catch (error) { onRecurringError(error); }
  }
  return fetchMonthIncome(userId, toLocalMonthKey(new Date()));
}
