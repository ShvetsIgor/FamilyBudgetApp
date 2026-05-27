import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { getDb } from '@/shared/lib/firebase';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { restoreRecurringDueFromDeletedExpense } from '@/features/recurring/services/recurringExpenseSync';
import type {
  Currency,
  Expense,
  ExpenseItem,
  PaymentMethod,
  Privacy,
  SerializableExpense,
  SplitItem,
} from '@/shared/types';

const PAGE_SIZE = 20;

function expCol(userId: string) {
  return collection(getDb(), 'expenses', userId, 'items');
}

function expenseDoc(userId: string, expenseId?: string) {
  return expenseId
    ? doc(getDb(), 'expenses', userId, 'items', expenseId)
    : doc(expCol(userId));
}

function statsDoc(userId: string, month: string) {
  return doc(getDb(), 'monthlyStats', userId, 'months', month);
}

function toSerializable(id: string, data: Record<string, unknown>): SerializableExpense {
  const toISO = (value: unknown) =>
    value instanceof Timestamp ? value.toDate().toISOString() : (value as string) ?? new Date().toISOString();

  return {
    id,
    userId: data.userId as string,
    amount: data.amount as number,
    currency: data.currency as Currency,
    categoryId: data.categoryId as string,
    date: toISO(data.date),
    paymentMethod: data.paymentMethod as PaymentMethod,
    store: data.store as string | undefined,
    storeId: data.storeId as string | undefined,
    storeGroup: data.storeGroup as string | undefined,
    tags: (data.tags as string[]) ?? [],
    comment: data.comment as string | undefined,
    photoUrl: data.photoUrl as string | undefined,
    privacy: data.privacy as Privacy,
    splits: (data.splits as SplitItem[]) ?? [],
    items: (data.items as ExpenseItem[] | undefined) ?? undefined,
    isRecurring: (data.isRecurring as boolean) ?? false,
    recurringId: data.recurringId as string | undefined,
    goalId: data.goalId as string | undefined,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

export async function fetchExpenses(
  userId: string,
  cursor?: DocumentSnapshot,
): Promise<{ expenses: SerializableExpense[]; cursor: DocumentSnapshot | null }> {
  const q = cursor
    ? query(expCol(userId), orderBy('date', 'desc'), limit(PAGE_SIZE), startAfter(cursor))
    : query(expCol(userId), orderBy('date', 'desc'), limit(PAGE_SIZE));

  const snap = await getDocs(q);
  const expenses = snap.docs.map((d) => toSerializable(d.id, d.data()));
  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { expenses, cursor: nextCursor };
}

export async function fetchMonthExpenses(userId: string, month: string): Promise<SerializableExpense[]> {
  const [year, m] = month.split('-').map(Number);
  const from = Timestamp.fromDate(new Date(year, m - 1, 1));
  const to = Timestamp.fromDate(new Date(year, m, 1));

  const snap = await getDocs(
    query(expCol(userId), where('date', '>=', from), where('date', '<', to), orderBy('date', 'desc')),
  );
  return snap.docs.map((d) => toSerializable(d.id, d.data()));
}

export interface AddExpenseInput {
  userId: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  date: Date;
  paymentMethod: PaymentMethod;
  store?: string;
  storeId?: string;
  storeGroup?: string;
  tags: string[];
  comment?: string;
  privacy: Privacy;
  splits: SplitItem[];
  items?: ExpenseItem[];
  goalId?: string;
  recurringId?: string;
  isRecurring?: boolean;
}

export async function addExpense(input: AddExpenseInput): Promise<SerializableExpense> {
  const { userId, date, store, storeId, storeGroup, comment, ...rest } = input;
  const ref = expenseDoc(userId);
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      store,
      storeId,
      storeGroup,
      comment,
      date: Timestamp.fromDate(date),
      isRecurring: input.isRecurring ?? Boolean(input.recurringId),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).filter(([, value]) => value !== undefined),
  );

  const batch = writeBatch(getDb());
  batch.set(ref, data);
  queueMonthlyStatsUpdate(
    batch,
    userId,
    format(date, 'yyyy-MM'),
    buildStatsDelta(input.categoryId, input.amount, input.splits, 1),
  );
  await batch.commit();

  return toSerializable(ref.id, {
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export interface UpdateExpenseInput extends AddExpenseInput {
  id: string;
  previousExpense?: SerializableExpense;
}

export async function updateExpense(input: UpdateExpenseInput): Promise<SerializableExpense> {
  const {
    userId,
    id,
    date,
    store,
    storeId,
    storeGroup,
    comment,
    goalId,
    previousExpense,
    ...rest
  } = input;
  const existing = previousExpense ?? await fetchExpenseById(userId, id);
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      store,
      storeId,
      storeGroup,
      comment,
      goalId,
      date: Timestamp.fromDate(date),
      isRecurring: input.isRecurring ?? Boolean(input.recurringId),
      updatedAt: serverTimestamp(),
    }).filter(([, value]) => value !== undefined),
  );

  const batch = writeBatch(getDb());
  batch.update(expenseDoc(userId, id), data);

  const statsByMonth = new Map<string, StatsDelta>();
  mergeStatsDelta(
    statsByMonth,
    format(new Date(existing.date), 'yyyy-MM'),
    buildStatsDelta(existing.categoryId, existing.amount, existing.splits, -1),
  );
  mergeStatsDelta(
    statsByMonth,
    format(date, 'yyyy-MM'),
    buildStatsDelta(input.categoryId, input.amount, input.splits, 1),
  );

  for (const [month, delta] of statsByMonth) {
    queueMonthlyStatsUpdate(batch, userId, month, delta);
  }

  await batch.commit();

  return toSerializable(id, {
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: isoToTimestamp(existing.createdAt),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function deleteExpense(userId: string, expense: SerializableExpense) {
  const batch = writeBatch(getDb());
  batch.delete(expenseDoc(userId, expense.id));
  queueMonthlyStatsUpdate(
    batch,
    userId,
    format(new Date(expense.date), 'yyyy-MM'),
    buildStatsDelta(expense.categoryId, expense.amount, expense.splits, -1),
  );
  await batch.commit();
  return restoreRecurringDueFromDeletedExpense(userId, expense);
}

interface StatsDelta {
  totalExpenses: number;
  byCategory: Record<string, number>;
}

function buildStatsDelta(
  categoryId: string,
  amount: number,
  splits: SplitItem[],
  sign: 1 | -1,
): StatsDelta {
  const splitTotal = splits.reduce((sum, split) => sum + split.amount, 0);
  const mainAmount = amount - splitTotal;
  const byCategory: Record<string, number> = {
    [categoryId]: sign * mainAmount,
  };

  for (const split of splits) {
    if (split.categoryId && split.amount > 0) {
      byCategory[split.categoryId] = (byCategory[split.categoryId] ?? 0) + sign * split.amount;
    }
  }

  return {
    totalExpenses: sign * amount,
    byCategory,
  };
}

function mergeStatsDelta(
  target: Map<string, StatsDelta>,
  month: string,
  incoming: StatsDelta,
) {
  const current = target.get(month) ?? { totalExpenses: 0, byCategory: {} };
  current.totalExpenses += incoming.totalExpenses;

  for (const [categoryId, delta] of Object.entries(incoming.byCategory)) {
    current.byCategory[categoryId] = (current.byCategory[categoryId] ?? 0) + delta;
  }

  target.set(month, current);
}

function queueMonthlyStatsUpdate(
  batch: ReturnType<typeof writeBatch>,
  userId: string,
  month: string,
  delta: StatsDelta,
) {
  const byCategory = Object.fromEntries(
    Object.entries(delta.byCategory)
      .filter(([, value]) => value !== 0)
      .map(([categoryId, value]) => [categoryId, increment(value)]),
  );

  if (delta.totalExpenses === 0 && Object.keys(byCategory).length === 0) {
    return;
  }

  batch.set(
    statsDoc(userId, month),
    {
      userId,
      month,
      ...(delta.totalExpenses !== 0 ? { totalExpenses: increment(delta.totalExpenses) } : {}),
      ...(Object.keys(byCategory).length > 0 ? { byCategory } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function fetchExpenseById(userId: string, expenseId: string): Promise<SerializableExpense> {
  const snap = await getDoc(expenseDoc(userId, expenseId));
  if (!snap.exists()) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  return toSerializable(snap.id, snap.data());
}

function isoToTimestamp(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(iso));
}

export type { Expense };
