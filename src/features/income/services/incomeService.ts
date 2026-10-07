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
  runTransaction,
  deleteField,
  type Transaction,
  type WriteBatch,
} from 'firebase/firestore';
import { readEntryPrivacy } from '@/shared/services/entryPrivacy';
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
  operationId?: string;
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
  batch: WriteBatch | Transaction,
  userId: string,
  { month, amount, currency }: IncomeStatsDelta,
) {
  if (amount === 0) return;
  (batch as WriteBatch).set(statsDoc(userId, month), {
    userId,
    month,
    totalIncome: increment(amount),
    incomeByCurrency: { [currency]: increment(amount) },
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function queueAddIncome(batch: Transaction | WriteBatch, input: AddIncomeInput, id?: string): SerializableIncome {
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.categoryId || Number.isNaN(input.date.getTime())) throw new Error('invalid-income');
  const { userId, date, operationId: _operationId, ...rest } = input;
  const ref = id ? doc(getDb(), 'incomes', userId, 'items', id) : doc(incCol(userId));
  const data = Object.fromEntries(Object.entries({ ...rest, userId, tags: input.tags ?? [],
    date: Timestamp.fromDate(date), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }).filter(([,v]) => v !== undefined));
  (batch as WriteBatch).set(ref, data);
  queueMonthlyIncomeUpdate(batch, userId, { month: toLocalMonthKey(date), amount: input.amount, currency: input.currency });
  return toSerializable(ref.id, { ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
}

export async function addIncome(input: AddIncomeInput): Promise<SerializableIncome> {
  const ref = doc(incCol(input.userId));
  const receipt = input.operationId ? doc(getDb(), 'users', input.userId, 'entryOperations', input.operationId) : null;
  return runTransaction(getDb(), async tx => {
    if (receipt) {
      const prior = await tx.get(receipt);
      if (prior.exists()) {
        if (prior.data().kind !== 'income') throw new Error('operation-conflict');
        const saved = await tx.get(doc(getDb(), 'incomes', input.userId, 'items', prior.data().entryId));
        if (!saved.exists()) throw new Error('entry-already-deleted');
        return toSerializable(saved.id, saved.data());
      }
    }
    const privacy = await readEntryPrivacy(tx, input.userId, 'income', [input.categoryId], input.privacy);
    const income = queueAddIncome(tx, { ...input, privacy }, ref.id);
    if (receipt) tx.set(receipt, { kind: 'income', entryId: ref.id, createdAt: serverTimestamp() });
    return income;
  });
}

export async function updateIncome(input: UpdateIncomeInput): Promise<SerializableIncome> {
  if (!Number.isFinite(input.amount) || input.amount <= 0 || !input.categoryId || Number.isNaN(input.date.getTime())) throw new Error('invalid-income');
  const { userId, id, previous: _previous, operationId: _operationId, date, ...rest } = input;
  return runTransaction(getDb(), async tx => {
    const ref = doc(getDb(), 'incomes', userId, 'items', id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('income-not-found');
    const previous = toSerializable(snap.id, snap.data());
    const privacy = await readEntryPrivacy(tx, userId, 'income', [input.categoryId], previous.privacy === 'secret' ? 'secret' : input.privacy, true);
    const data = Object.fromEntries(Object.entries({ ...rest, userId, privacy,
      comment: input.comment ?? deleteField(), date: Timestamp.fromDate(date), updatedAt: serverTimestamp(),
    }).filter(([,v]) => v !== undefined));
    tx.update(ref, data);
    for (const delta of buildIncomeStatsDeltas(previous, input)) queueMonthlyIncomeUpdate(tx, userId, delta);
    return { ...previous, ...rest, userId, id, privacy, date: date.toISOString(), updatedAt: new Date().toISOString() };
  });
}

export async function deleteIncome(userId: string, income: SerializableIncome): Promise<void> {
  const messages = await getDocs(query(collection(getDb(), 'messages', userId, 'items'), where('incomeId', '==', income.id)));
  await runTransaction(getDb(), async tx => {
    const ref = doc(getDb(), 'incomes', userId, 'items', income.id);
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const current = toSerializable(snap.id, snap.data());
    tx.delete(ref);
    messages.docs.forEach(d => tx.delete(d.ref));
    queueMonthlyIncomeUpdate(tx, userId, { month: toLocalMonthKey(current.date), amount: -current.amount, currency: current.currency });
  });
}
