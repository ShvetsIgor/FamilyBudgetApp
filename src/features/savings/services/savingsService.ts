import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, where, orderBy, serverTimestamp, Timestamp,
  writeBatch, type WriteBatch,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { format } from 'date-fns';
import type { SavingsGoal, SavingsContribution, Currency } from '@/shared/types';

function col(userId: string) {
  return collection(getDb(), 'savingsGoals', userId, 'goals');
}

function toISO(v: unknown): string {
  return v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? new Date().toISOString();
}

function toGoal(id: string, data: Record<string, unknown>): SavingsGoal {
  const rawContribs = (data.contributions as Record<string, unknown>[]) ?? [];
  return {
    id,
    userId: data.userId as string,
    name: data.name as string,
    icon: (data.icon as string) ?? '🎯',
    color: (data.color as string) ?? '#6366f1',
    targetAmount: data.targetAmount as number,
    currentAmount: data.currentAmount as number,
    currency: data.currency as Currency,
    monthlyContribution: data.monthlyContribution as number | undefined,
    deadline: data.deadline ? toISO(data.deadline) : undefined,
    contributions: rawContribs.map((c) => ({
      amount: c.amount as number,
      date: toISO(c.date),
      note: c.note as string | undefined,
      byId: c.byId as string | undefined,
      byName: c.byName as string | undefined,
    })),
    isPrivate: data.isPrivate as boolean | undefined,
    createdAt: toISO(data.createdAt),
  };
}

export async function fetchGoals(userId: string): Promise<SavingsGoal[]> {
  const snap = await getDocs(query(col(userId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => toGoal(d.id, d.data()));
}

/**
 * Goals as visible to OTHER family members: only isPrivate == false.
 * The equality filter is mandatory — security rules prove family list
 * queries against it. No orderBy to avoid a composite index; sorted here.
 */
export async function fetchSharedGoals(userId: string): Promise<SavingsGoal[]> {
  const snap = await getDocs(query(col(userId), where('isPrivate', '==', false)));
  return snap.docs.map((d) => toGoal(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateGoalPrivacy(userId: string, goalId: string, isPrivate: boolean): Promise<void> {
  await updateDoc(doc(getDb(), 'savingsGoals', userId, 'goals', goalId), { isPrivate });
}

/**
 * Goals created before the privacy flag existed have no isPrivate field and
 * would silently drop out of the family view (equality filters skip missing
 * fields). Backfill them as shared once, on the owner's device.
 */
export async function backfillGoalPrivacy(userId: string, goals: SavingsGoal[]): Promise<void> {
  const missing = goals.filter((g) => (g as unknown as Record<string, unknown>).isPrivate === undefined);
  await Promise.all(missing.map((g) =>
    updateDoc(doc(getDb(), 'savingsGoals', userId, 'goals', g.id), { isPrivate: false }).catch(() => {})));
}

export interface AddGoalInput {
  userId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  initialAmount?: number;
  currency: Currency;
  monthlyContribution?: number;
  deadline?: Date;
  isPrivate?: boolean;
}

export async function addGoal(input: AddGoalInput): Promise<SavingsGoal> {
  const { userId, deadline, monthlyContribution, initialAmount, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      currentAmount: initialAmount ?? 0,
      isPrivate: input.isPrivate ?? false,
      contributions: [],
      monthlyContribution,
      deadline: deadline ? Timestamp.fromDate(deadline) : undefined,
      createdAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(col(userId), data);
  return toGoal(ref.id, { ...data, createdAt: Timestamp.fromDate(new Date()) });
}

/**
 * Queues the goal update (currentAmount + contributions) into the caller's
 * batch without committing — pair with queueAddExpense for an atomic
 * contribution-plus-expense write.
 */
export function queueContribution(
  batch: WriteBatch,
  ownerId: string,
  goal: SavingsGoal,
  contribution: { amount: number; note?: string; byId?: string; byName?: string }
): SavingsGoal {
  const newContrib: SavingsContribution = {
    amount: contribution.amount,
    date: new Date().toISOString(),
    note: contribution.note,
    byId: contribution.byId,
    byName: contribution.byName,
  };
  const updatedContribs = [...goal.contributions, newContrib];
  const newCurrent = goal.currentAmount + contribution.amount;

  batch.update(doc(getDb(), 'savingsGoals', ownerId, 'goals', goal.id), {
    currentAmount: newCurrent,
    contributions: updatedContribs.map((c) => ({
      amount: c.amount,
      date: c.date,
      ...(c.note ? { note: c.note } : {}),
      ...(c.byId ? { byId: c.byId } : {}),
      ...(c.byName ? { byName: c.byName } : {}),
    })),
  });

  return { ...goal, currentAmount: newCurrent, contributions: updatedContribs };
}

export async function addContribution(
  ownerId: string,
  goal: SavingsGoal,
  contribution: { amount: number; note?: string; byId?: string; byName?: string }
): Promise<SavingsGoal> {
  const batch = writeBatch(getDb());
  const updated = queueContribution(batch, ownerId, goal, contribution);
  await batch.commit();
  return updated;
}

export async function reverseContribution(
  userId: string,
  goal: SavingsGoal,
  amount: number,
): Promise<SavingsGoal> {
  const newCurrent = Math.max(0, goal.currentAmount - amount);
  // Remove the most recent contribution matching this amount
  const idx = [...goal.contributions].reverse().findIndex((c) => c.amount === amount);
  const updatedContribs = idx === -1
    ? goal.contributions
    : goal.contributions.filter((_, i) => i !== goal.contributions.length - 1 - idx);

  await updateDoc(doc(getDb(), 'savingsGoals', userId, 'goals', goal.id), {
    currentAmount: newCurrent,
    contributions: updatedContribs,
  });
  return { ...goal, currentAmount: newCurrent, contributions: updatedContribs };
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  await deleteDoc(doc(getDb(), 'savingsGoals', userId, 'goals', goalId));
}
