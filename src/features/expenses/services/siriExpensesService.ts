import 'server-only';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/shared/lib/firebaseAdmin';
import { readSiriReceipt, type SiriRequestIdentity } from '@/features/ai/siriIdempotency';
import type { Category, Currency, Language } from '@/shared/types';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { makeT } from '@/shared/utils/makeT';
import { toLocalMonthKey, zonedDateToDate } from '@/shared/utils/dateKey';
import { validateParsedExpense, type ValidatedParsedExpense } from '@/features/ai/validateParsedExpense';
import { resolveExpensePrivacy } from '../utils/expensePrivacy';
import { buildMonthlyStatsPatch, buildStatsDelta } from '../utils/expenseStats';

export interface SavedSiriExpense {
  id: string;
  amount: number;
  currency: Currency;
  date: string;
  categoryName: string;
}

export class SiriExpenseValidationError extends Error {}

/** Expense, aggregate and chat card commit together; retries recheck privacy. */
export async function addSiriExpense(uid: string, expense: ValidatedParsedExpense, timeZone: string, request?: SiriRequestIdentity, language: Language = request?.language ?? 'en'): Promise<SavedSiriExpense> {
  const db = getAdminDb();
  const ref = db.collection(`expenses/${uid}/items`).doc();
  const month = toLocalMonthKey(expense.date);
  const date = Timestamp.fromDate(zonedDateToDate(expense.date, timeZone));
  const receiptRef = request ? db.doc(`users/${uid}/shortcutRequests/${request.id}`) : null;
  return db.runTransaction(async (transaction) => {
    if (receiptRef && request) {
      const receipt = readSiriReceipt((await transaction.get(receiptRef)).data(), request.fingerprint);
      if (receipt) return receipt.expense;
    }
    const snapshot = await transaction.get(db.doc(`categories/${uid}/expense/${expense.categoryId}`));
    const categories: Category[] = snapshot.exists
      ? [{ ...snapshot.data(), id: snapshot.id, userId: uid } as Category] : [];
    if (!validateParsedExpense(expense, { categories, todayKey: expense.date }).valid) {
      throw new SiriExpenseValidationError('Expense or category is no longer valid.');
    }
    const privacy = resolveExpensePrivacy({ categories, categoryId: expense.categoryId });
    transaction.create(ref, {
      userId: uid, amount: expense.amount, currency: expense.currency,
      categoryId: expense.categoryId, date, paymentMethod: 'other',
      tags: [], splits: [], isRecurring: false, privacy,
      ...(expense.merchant ? { store: expense.merchant } : {}),
      ...(expense.description ? { comment: expense.description } : {}),
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    const patch = buildMonthlyStatsPatch(uid, month,
      buildStatsDelta(expense.categoryId, expense.amount, [], 1, expense.currency),
      (value) => FieldValue.increment(value), FieldValue.serverTimestamp());
    transaction.set(db.doc(`monthlyStats/${uid}/months/${month}`), patch!, { merge: true });
    const category = categories[0];
    const t = makeT(language);
    const title = expense.merchant ? `${expense.merchant} · ${t.cat(category.name)}` : t.cat(category.name);
    const hint = `${t('shortcuts.chatSource')} · ${expense.date}`;
    // Link at both levels to match existing saved cards and expense deletion cleanup.
    transaction.create(db.doc(`messages/${uid}/items/siri-${ref.id}`), {
      userId: uid, senderId: 'bot', kind: 'bot', status: 'saved',
      text: `${title} · ${expense.amount} ${expense.currency} · ${hint}`,
      expenseId: ref.id, createdAt: FieldValue.serverTimestamp(),
      card: { kind: 'saved', data: {
        icon: category.icon || 'box', color: category.color || '#10b981',
        title, catName: null, groupName: null, hint,
        amount: expense.amount, currency: getCurrencySymbol(expense.currency), expenseId: ref.id,
      } },
    });
    const saved = { id: ref.id, amount: expense.amount, currency: expense.currency,
      date: expense.date, categoryName: categories[0].name };
    if (receiptRef && request) transaction.create(receiptRef, {
      fingerprint: request.fingerprint, expense: saved, language: request.language,
      createdAt: FieldValue.serverTimestamp(),
    });
    return saved;
  });
}
