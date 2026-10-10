import { parseISO } from 'date-fns';
import { doc, deleteField, Timestamp, type Transaction } from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { normalizeContributions } from '@/features/savings/services/savingsService';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import type { SavingsContribution, SerializableExpense, SerializableRecurringPayment } from '@/shared/types';

export interface ExpenseLinksUndo {
  contribution?: SavingsContribution;
  recurring?: { nextDueDate: string; isActive: boolean; deletedDueDate: string };
}
const iso = (v: unknown): string => v instanceof Timestamp ? v.toDate().toISOString() : String(v);

/**
 * Read every linked document before the caller queues any transaction writes.
 * `skipGoal` leaves a goal this account can no longer read (another member
 * made it private or deleted it, or we left the family) out of the deletion.
 */
export async function prepareExpenseLinks(tx: Transaction, userId: string, expense: SerializableExpense,
  restore?: ExpenseLinksUndo, { skipGoal = false } = {}) {
  // Undo touches the goal only when the deletion really removed a contribution.
  const goalId = restore ? restore.contribution && expense.goalId : !skipGoal && expense.goalId;
  const goalRef = goalId ? doc(getDb(), 'savingsGoals', expense.goalOwnerId ?? userId, 'goals', goalId) : null;
  const recurringRef = expense.recurringId && expense.isRecurring
    ? doc(getDb(), 'recurringPayments', userId, 'items', expense.recurringId) : null;
  const [goalSnap, recurringSnap] = await Promise.all([
    goalRef ? tx.get(goalRef) : null, recurringRef ? tx.get(recurringRef) : null,
  ]);
  const undo: ExpenseLinksUndo = {};
  let goalPatch: Record<string, unknown> | undefined;
  let recurringPatch: Record<string, unknown> | undefined;
  let recurring: SerializableRecurringPayment | null = null;

  if (goalSnap?.exists()) {
    const data = goalSnap.data();
    const entries = normalizeContributions(data.contributions);
    // Undo re-applies exactly what the deletion removed. A fresh lookup could
    // match an unrelated legacy entry of the same amount and add it twice.
    const match = restore ? restore.contribution : expense.contributionId
      ? entries.find(c => c.id === expense.contributionId)
      : (expense.goalOwnerId ?? userId) === userId
        ? entries.filter(c => c.amount === expense.amount && (!c.byId || c.byId === userId)).at(-1)
        : undefined;
    if (match) {
      const cid = match.id ?? expense.contributionId ?? `legacy-${expense.id}`;
      const exists = entries.some(c => c.id === cid);
      const legacy = Array.isArray(data.contributions);
      if (!restore || !exists) {
        const amount = match.amount;
        const currentAmount = Math.max(0, data.currentAmount + (restore ? amount : -amount));
        undo.contribution = { ...match, id: cid };
        const entry = Object.fromEntries(Object.entries({ ...match, byId: match.byId ?? userId }).filter(([,v]) => v !== undefined));
        if (legacy) {
          const remaining = restore ? entries : entries.filter(c => c !== match);
          const map = Object.fromEntries(remaining.map((c, i) => [c.id ?? `legacy-${i}`, Object.fromEntries(Object.entries(c).filter(([,v]) => v !== undefined))]));
          if (restore) map[cid] = entry;
          goalPatch = { contributions: map, currentAmount, lastContributionId: cid };
        } else {
          goalPatch = { [`contributions.${cid}`]: restore ? entry : deleteField(), currentAmount, lastContributionId: cid };
        }
      }
    }
  } else if (restore?.contribution) {
    throw new Error('linked-goal-no-longer-exists');
  }

  if (recurringSnap?.exists()) {
    const data = recurringSnap.data();
    const currentDue = iso(data.nextDueDate);
    const due = toLocalDateKey(expense.date);
    const autoCompleted = data.isActive === false && data.endDate && toLocalDateKey(currentDue) > toLocalDateKey(iso(data.endDate));
    if (restore?.recurring) {
      if (toLocalDateKey(currentDue) === restore.recurring.deletedDueDate) {
        recurringPatch = { nextDueDate: Timestamp.fromDate(parseISO(restore.recurring.nextDueDate)), isActive: restore.recurring.isActive };
      }
    } else if (!restore && (data.isActive !== false || autoCompleted) && due < toLocalDateKey(currentDue)) {
      undo.recurring = { nextDueDate: currentDue, isActive: data.isActive !== false, deletedDueDate: due };
      recurringPatch = { nextDueDate: Timestamp.fromDate(new Date(expense.date)), isActive: true };
    }
    if (recurringPatch) {
      recurring = { ...data, id: recurringSnap.id, startDate: iso(data.startDate),
        ...(data.endDate ? { endDate: iso(data.endDate) } : {}),
        nextDueDate: iso(recurringPatch.nextDueDate), isActive: recurringPatch.isActive,
      } as SerializableRecurringPayment;
    }
  }
  return { undo, recurring, apply() {
    if (goalRef && goalPatch) tx.update(goalRef, goalPatch);
    if (recurringRef && recurringPatch) tx.update(recurringRef, recurringPatch);
  } };
}
