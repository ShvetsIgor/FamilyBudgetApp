import { getFirebaseAuth } from '@/shared/lib/firebase';
import type { ParseResult } from '@/shared/types/message';
import type { Language } from '@/shared/types';
import { parseMessage, type ParserContext } from '@/features/chat/parser/parse';
import { detectMerchant } from '@/features/chat/parser/pipeline';
import { PARSER_CURRENCIES } from '@/features/ai/expenseParser/schema';
import { exactMerchant, type ChatExpenseDraft } from '@/features/chat/parser/merchantDraft';
import { matchLearnedKeyword } from '@/features/chat/parser/keywordLearning';

export type ChatParseOutcome = { kind: 'parsed'; parsed: ParseResult }
  /** Several separate purchases in one message, each still to be confirmed */
  | { kind: 'multi'; items: ParseResult[] }
  | { kind: 'clarification'; message: string }
  /** The account has no active expense category: the chat offers starter setup. */
  | { kind: 'needs_categories' };

export class ChatSessionChangedError extends Error {}

export function toChatParseResult(expense: ChatExpenseDraft): ParseResult {
  const exact = expense.merchant ? exactMerchant(expense.merchant) : undefined;
  const merchant = exact ?? (expense.merchant ? detectMerchant(expense.merchant.toLowerCase()) : undefined);
  return {
    amount: expense.amount, currency: expense.currency, categoryId: expense.categoryId,
    confidence: 'high', needsConfirmation: true, date: expense.date,
    ...(expense.description ? { note: expense.description } : {}),
    ...(expense.merchant ? { storeName: exact?.name ?? expense.merchant } : {}),
    ...(merchant ? { storeId: merchant.id, storeGroup: merchant.storeGroup } : {}),
    ...(expense.merchantOnly ? { merchantOnly: true } : {}),
  };
}

function isUsableDraft(expense: ChatExpenseDraft | undefined): expense is ChatExpenseDraft {
  return !!expense && expense.amount > 0 && PARSER_CURRENCIES.includes(expense.currency) && !!expense.date
    && (!!expense.categoryId || (expense.categoryId === null && expense.merchantOnly === true));
}

/**
 * No expense writes, automatic retries, or amount/currency guesses on failure.
 * `referenceDate` (local YYYY-MM-DD) is the day the message was originally
 * written, for messages finished later; the server only honours a recent one.
 */
export async function parseChatMessage(text: string, context: ParserContext & {
  userId: string; language: Language; referenceDate?: string;
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
      body: JSON.stringify({
        text, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(context.referenceDate ? { referenceDate: context.referenceDate } : {}),
      }),
      signal: controller.signal, cache: 'no-store',
    });
    const body = await response.json();
    assertSession();
    // A word the user taught leads the choice; a dictionary supermarket keeps its own memory
    const withLearned = (parsed: ParseResult, source: string): ParseResult => {
      const learnedHit = parsed.merchantOnly ? null : matchLearnedKeyword(source, context.learned);
      return learnedHit ? { ...parsed, learnedCategoryId: learnedHit.categoryId } : parsed;
    };
    if (response.ok && body.ok === true && isUsableDraft(body.expense)) {
      return { kind: 'parsed', parsed: withLearned(toChatParseResult(body.expense), text) };
    }
    // Every item must be usable — a list is never recorded minus one purchase
    if (response.ok && body.ok === true && Array.isArray(body.expenses) && body.expenses.length > 1
      && body.expenses.every(isUsableDraft)) {
      return { kind: 'multi', items: (body.expenses as ChatExpenseDraft[]).map((expense) =>
        withLearned(toChatParseResult(expense), expense.description ?? expense.merchant ?? '')) };
    }
    if (response.status === 422 && body.reason === 'no_categories') return { kind: 'needs_categories' };
    if (response.status === 422 && typeof body.message === 'string') {
      return { kind: 'clarification', message: body.message };
    }
    const message = response.status === 401
      ? ru ? 'Войди в аккаунт заново и повтори сообщение. Расход не сохранён.' : 'Sign in again and resend the message. Expense not saved.'
      : response.status === 429
        // 'ai_capacity' is the service-wide ceiling, 'request_rate_limited' the
        // per-owner message pace (no AI involved); only 'rate_limited' is the AI quota
        ? body.error === 'ai_capacity'
          ? ru ? 'ИИ сейчас перегружен у всех. Расход не сохранён. Попробуй позже или добавь вручную через «+».' : 'The AI is busy for everyone right now. Expense not saved. Try later or add it manually using “+”.'
          : body.error === 'request_rate_limited'
            ? ru ? 'Слишком много сообщений подряд. Расход не сохранён. Подожди немного или добавь вручную через «+».' : 'Too many messages in a row. Expense not saved. Wait a moment or add it manually using “+”.'
            : ru ? 'Лимит ИИ временно исчерпан. Расход не сохранён. Попробуй позже или добавь вручную через «+».' : 'AI request limit reached. Expense not saved. Try later or add it manually using “+”.'
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
