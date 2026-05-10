import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp, Timestamp,
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
    })),
    createdAt: toISO(data.createdAt),
  };
}

export async function fetchGoals(userId: string): Promise<SavingsGoal[]> {
  const snap = await getDocs(query(col(userId), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => toGoal(d.id, d.data()));
}

export interface AddGoalInput {
  userId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  currency: Currency;
  monthlyContribution?: number;
  deadline?: Date;
}

export async function addGoal(input: AddGoalInput): Promise<SavingsGoal> {
  const { userId, deadline, monthlyContribution, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      currentAmount: 0,
      contributions: [],
      monthlyContribution,
      deadline: deadline ? Timestamp.fromDate(deadline) : undefined,
      createdAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );
  const ref = await addDoc(col(userId), data);
  return toGoal(ref.id, { ...data, createdAt: Timestamp.fromDate(new Date()) });
}

export async function addContribution(
  userId: string,
  goal: SavingsGoal,
  contribution: { amount: number; note?: string }
): Promise<SavingsGoal> {
  const newContrib: SavingsContribution = {
    amount: contribution.amount,
    date: new Date().toISOString(),
    note: contribution.note,
  };
  const updatedContribs = [...goal.contributions, newContrib];
  const newCurrent = goal.currentAmount + contribution.amount;

  await updateDoc(doc(getDb(), 'savingsGoals', userId, 'goals', goal.id), {
    currentAmount: newCurrent,
    contributions: updatedContribs.map((c) => ({
      amount: c.amount,
      date: c.date,
      ...(c.note ? { note: c.note } : {}),
    })),
  });

  return { ...goal, currentAmount: newCurrent, contributions: updatedContribs };
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
