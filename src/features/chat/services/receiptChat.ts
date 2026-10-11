import { getFirebaseAuth } from '@/shared/lib/firebase';
import type { Category, Language, SerializableExpense } from '@/shared/types';
import type { SerializableChatMessage } from '@/shared/types/message';
import { PARSER_CURRENCIES, type ParserCurrency } from '@/features/ai/expenseParser/schema';
import { receiptExpenseParts, type ReceiptDraft, type ReceiptGroup } from '@/features/ai/receiptParser/receipt';
import type { addExpense as addExpenseFn } from '@/features/expenses/services/expensesService';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { chatOperationId } from './chatSaveRecovery';
import { ChatSessionChangedError } from './parseChatMessage';

/** What the receipt card persists: the draft plus the message it answers. */
export interface ReceiptCardData extends ReceiptDraft {
  userMsgId: string;
}

export type ReceiptParseOutcome =
  | { kind: 'receipt'; receipt: ReceiptDraft }
  | { kind: 'needs_categories' }
  | { kind: 'clarification'; message: string };

const isGroup = (g: unknown): g is ReceiptGroup => !!g && typeof g === 'object'
  && (typeof (g as ReceiptGroup).categoryId === 'string' || (g as ReceiptGroup).categoryId === null)
  && typeof (g as ReceiptGroup).amount === 'number' && (g as ReceiptGroup).amount > 0
  && Array.isArray((g as ReceiptGroup).names);

function isDraft(value: unknown): value is ReceiptDraft {
  const r = value as ReceiptDraft;
  return !!r && typeof r === 'object' && typeof r.total === 'number' && r.total > 0
    && PARSER_CURRENCIES.includes(r.currency) && /^\d{4}-\d{2}-\d{2}$/.test(r.date ?? '')
    && Array.isArray(r.groups) && r.groups.length > 0 && r.groups.every(isGroup)
    && (r.merchant === null || typeof r.merchant === 'string');
}

/** Persisted card data is re-checked on render: a malformed card shows nothing. */
export function readReceiptCard(data: unknown): ReceiptCardData | null {
  return isDraft(data) && typeof (data as ReceiptCardData).userMsgId === 'string' ? data as ReceiptCardData : null;
}

/** Sends one compressed photo; same session checks and wording rules as text. */
export async function parseReceiptPhoto(imageDataUrl: string, context: { userId: string; language: Language }): Promise<ReceiptParseOutcome> {
  const ru = context.language === 'ru';
  const unavailable = ru
    ? 'Распознавание чеков временно недоступно. Расход не сохранён. Введи его текстом или через «+».'
    : 'Receipt reading is temporarily unavailable. Expense not saved. Type it or use “+”.';
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const assertSession = () => {
    if (!user || user.uid !== context.userId || auth.currentUser !== user) throw new ChatSessionChangedError();
  };
  assertSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const token = await user!.getIdToken();
    assertSession();
    const response = await fetch('/api/chat/parse-receipt', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image: imageDataUrl, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      signal: controller.signal, cache: 'no-store',
    });
    const body = await response.json();
    assertSession();
    if (response.ok && body.ok === true && isDraft(body.receipt)) return { kind: 'receipt', receipt: body.receipt };
    if (response.status === 422 && body.reason === 'no_categories') return { kind: 'needs_categories' };
    if (response.status === 422 && typeof body.message === 'string') return { kind: 'clarification', message: body.message };
    const message = response.status === 429
      ? body.error === 'ai_capacity'
        ? ru ? 'ИИ сейчас занят у всех. Расход не сохранён. Попробуй позже или введи его текстом.' : 'The AI is busy for everyone right now. Expense not saved. Try later or type it.'
        : ru ? 'Лимит распознавания временно исчерпан. Попробуй позже или введи расход текстом.' : 'Recognition limit reached for now. Try later or type the expense.'
      : response.status === 413 || response.status === 400
        ? ru ? 'Фото слишком большое или в неподходящем формате. Сфотографируй чек ещё раз.' : 'The photo is too large or in an unsupported format. Take the picture again.'
        : unavailable;
    return { kind: 'clarification', message };
  } catch (error) {
    assertSession();
    if (error instanceof ChatSessionChangedError) throw error;
    return { kind: 'clarification', message: unavailable };
  } finally { clearTimeout(timeout); }
}

export type ReceiptSaveResult =
  | { status: 'saved'; expense: SerializableExpense; card: Omit<SerializableChatMessage, 'id'> }
  | { status: 'unconfirmed' | 'deleted' };

/**
 * One expense with splits under the message's operation id: tapping Save
 * again after a lost acknowledgement finds the same entry, never a second one.
 */
export async function saveReceipt({ userId, card, groups, categories, language, addExpense }: {
  userId: string;
  card: ReceiptCardData;
  /** The card's groups with the categories the user confirmed */
  groups: readonly ReceiptGroup[];
  categories: readonly Category[];
  language: Language;
  addExpense: typeof addExpenseFn;
}): Promise<ReceiptSaveResult> {
  const parts = receiptExpenseParts(groups);
  const [y, m, d] = card.date.split('-').map(Number);
  let expense: SerializableExpense;
  try {
    expense = await addExpense({
      userId,
      operationId: chatOperationId(card.userMsgId),
      amount: card.total,
      currency: card.currency as ParserCurrency,
      categoryId: parts.categoryId,
      splits: parts.splits,
      // Noon local time, like every chat entry: never shifted across midnight by UTC
      date: new Date(y, m - 1, d, 12, 0, 0),
      paymentMethod: 'card',
      store: card.merchant ?? undefined,
      tags: [],
      // The service tightens this to secret when any chosen category is private
      privacy: 'regular',
    });
  } catch (error) {
    return { status: error instanceof Error && error.message === 'entry-already-deleted' ? 'deleted' : 'unconfirmed' };
  }

  const main = categories.find((c) => c.id === expense.categoryId);
  const sym = getCurrencySymbol(card.currency);
  const parts2 = 1 + (expense.splits?.length ?? 0);
  return {
    status: 'saved',
    expense,
    card: {
      userId, senderId: 'bot', kind: 'bot', status: 'saved', createdAt: new Date().toISOString(),
      text: `${sym} ${card.total} · ${card.merchant ?? main?.name ?? ''}`.trim(),
      expenseId: expense.id,
      card: {
        kind: 'saved',
        data: {
          icon: main?.icon ?? 'receipt', color: main?.color ?? '#E07A5F',
          title: card.merchant ?? main?.name ?? '', catName: main?.name ?? null, groupName: null,
          hint: parts2 > 1 ? (language === 'ru' ? `Чек · категорий: ${parts2}` : `Receipt · ${parts2} categories`) : undefined,
          amount: card.total, currency: sym, expenseId: expense.id, userMsgId: card.userMsgId,
        },
      },
    },
  };
}
