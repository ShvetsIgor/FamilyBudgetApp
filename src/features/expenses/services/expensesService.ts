import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  where,
  setDoc,
  increment,
  serverTimestamp,
  Timestamp,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { getDb } from '@/shared/lib/firebase';
import type { Expense, SerializableExpense, SplitItem, Currency, Privacy, PaymentMethod } from '@/shared/types';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

function expCol(userId: string) {
  return collection(getDb(), 'expenses', userId, 'items');
}

function statsDoc(userId: string, month: string) {
  return doc(getDb(), 'monthlyStats', userId, 'months', month);
}

// ─── Converter: Firestore doc → Redux-safe object ─────────────────────────────

function toSerializable(id: string, data: Record<string, unknown>): SerializableExpense {
  const toISO = (v: unknown) =>
    v instanceof Timestamp ? v.toDate().toISOString() : (v as string) ?? new Date().toISOString();

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
    isRecurring: (data.isRecurring as boolean) ?? false,
    recurringId: data.recurringId as string | undefined,
    goalId: data.goalId as string | undefined,
    createdAt: toISO(data.createdAt),
    updatedAt: toISO(data.updatedAt),
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchExpenses(
  userId: string,
  cursor?: DocumentSnapshot
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
    query(expCol(userId), where('date', '>=', from), where('date', '<', to), orderBy('date', 'desc'))
  );
  return snap.docs.map((d) => toSerializable(d.id, d.data()));
}

// ─── Write ────────────────────────────────────────────────────────────────────

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
  goalId?: string;
}

export async function addExpense(input: AddExpenseInput): Promise<SerializableExpense> {
  const { userId, date, store, storeId, storeGroup, comment, ...rest } = input;

  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      store,
      storeId,
      storeGroup,
      comment,
      date: Timestamp.fromDate(date),
      isRecurring: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );

  const ref = await addDoc(expCol(userId), data);

  const month = format(date, 'yyyy-MM');
  await updateMonthlyStats(userId, month, input.categoryId, input.amount, input.splits, 1);

  return toSerializable(ref.id, {
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export interface UpdateExpenseInput extends AddExpenseInput {
  id: string;
}

export async function updateExpense(input: UpdateExpenseInput): Promise<SerializableExpense> {
  const { userId, id, date, store, storeId, storeGroup, comment, goalId, ...rest } = input;

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
      updatedAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );

  await updateDoc(doc(getDb(), 'expenses', userId, 'items', id), data);

  return toSerializable(id, {
    ...data,
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.fromDate(new Date()),
    updatedAt: Timestamp.fromDate(new Date()),
  });
}

export async function deleteExpense(userId: string, expense: SerializableExpense): Promise<void> {
  await deleteDoc(doc(getDb(), 'expenses', userId, 'items', expense.id));
  const month = format(new Date(expense.date), 'yyyy-MM');
  await updateMonthlyStats(userId, month, expense.categoryId, expense.amount, expense.splits, -1);
}

// ─── Stats aggregation ────────────────────────────────────────────────────────

async function updateMonthlyStats(
  userId: string,
  month: string,
  categoryId: string,
  amount: number,
  splits: SplitItem[],
  sign: 1 | -1
) {
  const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
  const mainAmount = amount - splitTotal;
  const ref = statsDoc(userId, month);

  // updateDoc supports dot notation → creates proper nested map byCategory.{id}
  // setDoc with merge:true does NOT support dot notation (creates flat fields)
  const updates: Record<string, unknown> = {
    totalExpenses: increment(sign * amount),
    updatedAt: serverTimestamp(),
    [`byCategory.${categoryId}`]: increment(sign * mainAmount),
  };
  for (const sp of splits) {
    if (sp.categoryId && sp.amount > 0) {
      updates[`byCategory.${sp.categoryId}`] = increment(sign * sp.amount);
    }
  }

  try {
    await updateDoc(ref, updates);
  } catch (e: unknown) {
    // Document doesn't exist yet — create it with proper nested structure
    if ((e as { code?: string }).code === 'not-found') {
      const byCategory: Record<string, number> = { [categoryId]: sign * mainAmount };
      for (const sp of splits) {
        if (sp.categoryId && sp.amount > 0) {
          byCategory[sp.categoryId] = (byCategory[sp.categoryId] ?? 0) + sign * sp.amount;
        }
      }
      await setDoc(ref, {
        userId,
        month,
        totalExpenses: sign * amount,
        byCategory,
        updatedAt: serverTimestamp(),
      });
    } else {
      throw e;
    }
  }
}
