import { getFirebaseAuth } from '@/shared/lib/firebase';
import type { ParseResult } from '@/shared/types/message';
import type { Language } from '@/shared/types';
import { parseMessage, type ParserContext } from '@/features/chat/parser/parse';
import { detectMerchant } from '@/features/chat/parser/pipeline';
import { PARSER_CURRENCIES } from '@/features/ai/expenseParser/schema';
import type { ValidatedParsedExpense } from '@/features/ai/validateParsedExpense';

export type ChatParseOutcome = { kind: 'parsed'; parsed: ParseResult }
  | { kind: 'clarification'; message: string };

export class ChatSessionChangedError extends Error {}

export function toChatParseResult(expense: ValidatedParsedExpense): ParseResult {
  const merchant = expense.merchant ? detectMerchant(expense.merchant.toLowerCase()) : undefined;
  return {
    amount: expense.amount, currency: expense.currency, categoryId: expense.categoryId,
    confidence: 'high', needsConfirmation: true, date: expense.date,
    ...(expense.description ? { note: expense.description } : {}),
    ...(expense.merchant ? { storeName: expense.merchant } : {}),
    ...(merchant ? { storeId: merchant.id, storeGroup: merchant.storeGroup } : {}),
  };
}

/** No expense writes, automatic retries, or amount/currency guesses on failure. */
export async function parseChatMessage(text: string, context: ParserContext & {
  userId: string; language: Language;
}): Promise<ChatParseOutcome> {
  // Income still has its own explicit + workflow; slash commands are handled by the page.
  if (text.trimStart().startsWith('+')) return { kind: 'parsed', parsed: parseMessage(text, context) };
  const ru = context.language === 'ru';
  const unavailable = ru
    ? 'ИИ временно недоступен. Расход не сохранён. Попробуй позже или добавь его вручную через «+».'
    : 'AI is temporarily unavailable. Expense not saved. Try later or add it manually using “+”.';
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const assertSession = () => {
    if (!user || user.uid !== context.userId || auth.currentUser !== user) throw new ChatSessionChangedError();
  };
  assertSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const token = await user!.getIdToken();
    assertSession();
    const response = await fetch('/api/chat/parse-expense', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      signal: controller.signal, cache: 'no-store',
    });
    const body = await response.json();
    assertSession();
    if (response.ok && body.ok === true && body.expense?.amount > 0
      && PARSER_CURRENCIES.includes(body.expense.currency) && body.expense.categoryId && body.expense.date) {
      return { kind: 'parsed', parsed: toChatParseResult(body.expense) };
    }
    if (response.status === 422 && typeof body.message === 'string') {
      return { kind: 'clarification', message: body.message };
    }
    const message = response.status === 401
      ? ru ? 'Войди в аккаунт заново и повтори сообщение. Расход не сохранён.' : 'Sign in again and resend the message. Expense not saved.'
      : response.status === 429
        ? ru ? 'Лимит ИИ временно исчерпан. Расход не сохранён. Попробуй позже или добавь вручную через «+».' : 'AI request limit reached. Expense not saved. Try later or add it manually using “+”.'
        : response.status === 400 || response.status === 413
          ? ru ? 'Опиши один расход сообщением до 2000 символов.' : 'Describe one expense in a message of up to 2000 characters.'
          : body.error === 'profile_required'
            ? ru ? 'Выбери валюту и язык в настройках аккаунта и повтори сообщение.' : 'Choose your currency and language in account settings, then resend the message.'
            : unavailable;
    return { kind: 'clarification', message };
  } catch (error) {
    assertSession();
    if (error instanceof ChatSessionChangedError) throw error;
    return { kind: 'clarification', message: unavailable };
  } finally { clearTimeout(timeout); }
}
