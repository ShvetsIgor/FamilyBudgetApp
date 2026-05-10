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
import type { Expense, SplitItem, Currency, Privacy, PaymentMethod } from '@/shared/types';
import { format } from 'date-fns';

const PAGE_SIZE = 20;

function expCol(userId: string) {
  return collection(getDb(), 'expenses', userId, 'items');
}

function statsDoc(userId: string, month: string) {
  return doc(getDb(), 'monthlyStats', userId, 'months', month);
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

export async function fetchExpenses(
  userId: string,
  cursor?: DocumentSnapshot
): Promise<{ expenses: Expense[]; cursor: DocumentSnapshot | null }> {
  const constraints = [orderBy('date', 'desc'), limit(PAGE_SIZE)];
  if (cursor) constraints.push(startAfter(cursor) as any);

  const snap = await getDocs(query(expCol(userId), ...constraints));
  const expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
  const nextCursor = snap.docs.length === PAGE_SIZE ? snap.docs[snap.docs.length - 1] : null;
  return { expenses, cursor: nextCursor };
}

export async function fetchMonthExpenses(userId: string, month: string): Promise<Expense[]> {
  const [year, m] = month.split('-').map(Number);
  const from = Timestamp.fromDate(new Date(year, m - 1, 1));
  const to = Timestamp.fromDate(new Date(year, m, 1));

  const snap = await getDocs(
    query(expCol(userId), where('date', '>=', from), where('date', '<', to), orderBy('date', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
}

// ─── Write ────────────────────────────────────────────────────────────────────

export interface AddExpenseInput {
  userId: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  subcategoryId?: string;
  date: Date;
  paymentMethod: PaymentMethod;
  store?: string;
  tags: string[];
  comment?: string;
  privacy: Privacy;
  splits: SplitItem[];
}

export async function addExpense(input: AddExpenseInput): Promise<Expense> {
  const { userId, date, ...rest } = input;

  const data = Object.fromEntries(
    Object.entries({
      ...rest,
      userId,
      date: Timestamp.fromDate(date),
      isRecurring: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }).filter(([, v]) => v !== undefined)
  );

  const ref = await addDoc(expCol(userId), data);

  // Update monthlyStats — pre-aggregate
  const month = format(date, 'yyyy-MM');
  await updateMonthlyStats(userId, month, input.categoryId, input.amount, input.splits, 1);

  return { id: ref.id, ...data } as unknown as Expense;
}

export async function updateExpense(userId: string, expense: Expense, oldExpense: Expense): Promise<void> {
  const { id, ...data } = expense;
  const clean = Object.fromEntries(
    Object.entries({ ...data, updatedAt: serverTimestamp() }).filter(([, v]) => v !== undefined)
  );
  await updateDoc(doc(getDb(), 'expenses', userId, 'items', id), clean);

  // Reverse old stats, apply new
  const oldMonth = format(oldExpense.date.toDate(), 'yyyy-MM');
  const newMonth = format(expense.date.toDate(), 'yyyy-MM');
  await updateMonthlyStats(userId, oldMonth, oldExpense.categoryId, oldExpense.amount, oldExpense.splits, -1);
  await updateMonthlyStats(userId, newMonth, expense.categoryId, expense.amount, expense.splits, 1);
}

export async function deleteExpense(userId: string, expense: Expense): Promise<void> {
  await deleteDoc(doc(getDb(), 'expenses', userId, 'items', expense.id));
  const month = format(expense.date.toDate(), 'yyyy-MM');
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
  const ref = statsDoc(userId, month);

  // Main category amount = total - splits
  const splitTotal = splits.reduce((s, sp) => s + sp.amount, 0);
  const mainAmount = amount - splitTotal;

  const byCategoryUpdate: Record<string, unknown> = {
    [`byCategory.${categoryId}`]: increment(sign * mainAmount),
  };
  for (const sp of splits) {
    byCategoryUpdate[`byCategory.${sp.categoryId}`] = increment(sign * sp.amount);
  }

  await setDoc(
    ref,
    {
      userId,
      month,
      totalExpenses: increment(sign * amount),
      ...byCategoryUpdate,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
