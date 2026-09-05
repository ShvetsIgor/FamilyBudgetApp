import {
  collection,
  doc,
  getDocs,
  getDoc,
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
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import type { SerializableIncome, Currency, Privacy } from '@/shared/types';

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

export async function fetchIncomeById(userId: string, incomeId: string): Promise<SerializableIncome | null> {
  const snap = await getDoc(doc(getDb(), 'incomes', userId, 'items', incomeId));
  return snap.exists() ? toSerializable(snap.id, snap.data()) : null;
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

/** Shared (privacy == 'regular') incomes over an arbitrary date range — for family analytics. */
export async function fetchSharedIncomeInRange(userId: string, from: Date, to: Date): Promise<SerializableIncome[]> {
  const snap = await getDocs(
    query(
      incCol(userId),
      where('privacy', '==', 'regular'),
      where('date', '>=', Timestamp.fromDate(from)), where('date', '<', Timestamp.fromDate(to)),
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

export interface UpdateIncomeInput extends AddIncomeInput {
  id: string;
  previous: SerializableIncome;
}

export interface IncomeStatsDelta {
  month: string;
  amount: number;
  /** Currency of the income — totals are kept per currency, never summed across. */
  currency: Currency;
}

/**
 * Monthly income aggregates are delta-based. Moving an entry between months
 * must subtract it from the old month and add it to the new one; an edit
 * within one month only applies the amount difference.
 */
export function buildIncomeStatsDeltas(
  previous: Pick<SerializableIncome, 'amount' | 'date' | 'currency'>,
  next: Pick<AddIncomeInput, 'amount' | 'date' | 'currency'>,
): IncomeStatsDelta[] {
  const previousMonth = toLocalMonthKey(previous.date);
  const nextMonth = toLocalMonthKey(next.date);

  // A currency change is a move between buckets, exactly like a month change
  if (previousMonth === nextMonth && previous.currency === next.currency) {
    const amount = next.amount - previous.amount;
    return amount === 0 ? [] : [{ month: nextMonth, amount, currency: next.currency }];
  }

  return [
    { month: previousMonth, amount: -previous.amount, currency: previous.currency },
    { month: nextMonth, amount: next.amount, currency: next.currency },
  ];
}

function queueMonthlyIncomeUpdate(
  batch: ReturnType<typeof writeBatch>,
  userId: string,
  { month, amount, currency }: IncomeStatsDelta,
) {
  if (amount === 0) return;
  batch.set(statsDoc(userId, month), {
    userId,
    month,
    totalIncome: increment(amount),
    incomeByCurrency: { [currency]: increment(amount) },
    updatedAt: serverTimestamp(),
  }, { merge: true });
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

  // One batch, like the expense path: the income and its month aggregate are
  // now READ back by /statistics and /analytics, so a write that lands without
  // its stats update is a number the user sees and cannot explain.
  const ref = doc(incCol(userId));
  const batch = writeBatch(getDb());
  batch.set(ref, data);
  queueMonthlyIncomeUpdate(batch, userId, {
    month: toLocalMonthKey(date),
    amount: input.amount,
    currency: input.currency,
  });
  await batch.commit();

  return toSerializable(ref.id, {
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function updateIncome(input: UpdateIncomeInput): Promise<SerializableIncome> {
  const { userId, id, previous, date, comment, ...rest } = input;
  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      comment,
      date: Timestamp.fromDate(date),
      updatedAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );

  const batch = writeBatch(getDb());
  batch.update(doc(getDb(), 'incomes', userId, 'items', id), data);
  for (const delta of buildIncomeStatsDeltas(previous, input)) {
    queueMonthlyIncomeUpdate(batch, userId, delta);
  }
  await batch.commit();

  return toSerializable(id, {
    ...previous,
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: previous.createdAt,
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function deleteIncome(userId: string, income: SerializableIncome): Promise<void> {
  const batch = writeBatch(getDb());
  batch.delete(doc(getDb(), 'incomes', userId, 'items', income.id));
  await queueLinkedChatMessageDeletes(batch, userId, 'incomeId', income.id);
  queueMonthlyIncomeUpdate(batch, userId, {
    month: toLocalMonthKey(income.date),
    amount: -income.amount,
    currency: income.currency,
  });
  await batch.commit();
}
