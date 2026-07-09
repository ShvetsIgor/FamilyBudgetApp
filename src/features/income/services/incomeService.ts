import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
  updateDoc,
  setDoc,
  increment,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import { queueLinkedChatMessageDeletes } from '@/features/expenses/services/expensesService';
import type { SerializableIncome, Currency, Privacy } from '@/shared/types';
import { format } from 'date-fns';

type IncomeMethod = 'cash' | 'card' | 'bank' | 'other';

function incCol(userId: string) {
  return collection(getDb(), 'incomes', userId, 'items');
}

function statsDoc(userId: string, month: string) {
  return doc(getDb(), 'monthlyStats', userId, 'months', month);
}

function toSerializable(id: string, data: Record<string, unknown>): SerializableIncome {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? new Date().toISOString();

  return {
    id,
    userId: data.userId as string,
    amount: data.amount as number,
    currency: data.currency as Currency,
    categoryId: data.categoryId as string,
    date: toISO(data.date),
    method: data.method as IncomeMethod,
    comment: data.comment as string | undefined,
    tags: (data.tags as string[]) ?? [],
    privacy: data.privacy as Privacy,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

export async function fetchMonthIncome(userId: string, month: string): Promise<SerializableIncome[]> {
  const [year, m] = month.split('-').map(Number);
  const from = Timestamp.fromDate(new Date(year, m - 1, 1));
  const to = Timestamp.fromDate(new Date(year, m, 1));

  const snap = await getDocs(
    query(incCol(userId), where('date', '>=', from), where('date', '<', to), orderBy('date', 'desc'))
  );
  return snap.docs.map((d) => toSerializable(d.id, d.data()));
}

/**
 * Month incomes as visible to OTHER family members: only privacy ==
 * 'regular'. The equality filter is mandatory — security rules prove
 * family list queries against it.
 */
export async function fetchSharedMonthIncome(userId: string, month: string): Promise<SerializableIncome[]> {
  const [year, m] = month.split('-').map(Number);
  const from = Timestamp.fromDate(new Date(year, m - 1, 1));
  const to = Timestamp.fromDate(new Date(year, m, 1));

  const snap = await getDocs(
    query(
      incCol(userId),
      where('privacy', '==', 'regular'),
      where('date', '>=', from), where('date', '<', to),
      orderBy('date', 'desc'),
    )
  );
  return snap.docs.map((d) => toSerializable(d.id, d.data()));
}

export interface AddIncomeInput {
  userId: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  date: Date;
  method: IncomeMethod;
  comment?: string;
  tags?: string[];
  privacy: Privacy;
}

export async function addIncome(input: AddIncomeInput): Promise<SerializableIncome> {
  const { userId, date, comment, ...rest } = input;

  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      comment,
      tags: input.tags ?? [],
      date: Timestamp.fromDate(date),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );

  const ref = await addDoc(incCol(userId), data);

  const month = format(date, 'yyyy-MM');
  await updateMonthlyIncome(userId, month, input.amount, 1);

  return toSerializable(ref.id, {
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function updateIncome(input: AddIncomeInput & { id: string }): Promise<SerializableIncome> {
  const { userId, id, date, comment, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      comment,
      date: Timestamp.fromDate(date),
      updatedAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(getDb(), 'incomes', userId, 'items', id), data);
  return toSerializable(id, {
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function deleteIncome(userId: string, income: SerializableIncome): Promise<void> {
  const batch = writeBatch(getDb());
  batch.delete(doc(getDb(), 'incomes', userId, 'items', income.id));
  await queueLinkedChatMessageDeletes(batch, userId, 'incomeId', income.id);
  await batch.commit();
  const month = format(new Date(income.date), 'yyyy-MM');
  await updateMonthlyIncome(userId, month, income.amount, -1);
}

async function updateMonthlyIncome(userId: string, month: string, amount: number, sign: 1 | -1) {
  const ref = statsDoc(userId, month);
  try {
    await updateDoc(ref, {
      totalIncome: increment(sign * amount),
      updatedAt: serverTimestamp(),
    });
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'not-found') {
      await setDoc(ref, {
        userId,
        month,
        totalExpenses: 0,
        totalIncome: sign * amount,
        byCategory: {},
        updatedAt: serverTimestamp(),
      });
    } else {
      throw e;
    }
  }
}
