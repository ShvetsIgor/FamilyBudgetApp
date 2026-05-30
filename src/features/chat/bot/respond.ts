import { format, parseISO } from 'date-fns';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import { ru } from 'date-fns/locale';
import { addExpense } from '@/features/expenses/services/expensesService';
import { addIncome } from '@/features/income/services/incomeService';
import { updateMessage } from '@/features/chat/services/messagesService';
import type { SerializableChatMessage, ParseResult } from '@/shared/types/message';
import type { BotContext } from './context';
import { UNKNOWN_PHRASE } from './templates';

function nowTimestamp(): string {
  return new Date().toISOString();
}

function saveErrorPhrase(language: string): string {
  return language === 'ru'
    ? 'Не удалось сохранить 😔 Попробуй ещё раз'
    : "Couldn't save 😔 Please try again";
}

function makeBotMsg(
  userId: string,
  overrides: Partial<Omit<SerializableChatMessage, 'id' | 'userId' | 'senderId' | 'kind' | 'createdAt'>>
): Omit<SerializableChatMessage, 'id'> {
  return {
    userId,
    senderId: 'bot',
    kind: 'bot',
    text: '',
    status: 'saved',
    createdAt: nowTimestamp(),
    ...overrides,
  };
}

function expenseDate(parsed: ParseResult): Date {
  if (parsed.date) {
    const parts = parsed.date.split('-').map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      // Use noon local time to avoid UTC day boundary issues (e.g. UTC+3 midnight = prev UTC day)
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }
  }
  return new Date();
}

export interface OpenSplitRequest {
  amount: number;
  userMsgId: string;
  storeId?: string;
  storeName?: string;
  storeGroup?: string;
  date?: string;
}

export interface BotReply {
  messages: Omit<SerializableChatMessage, 'id'>[];
  expense?: Awaited<ReturnType<typeof addExpense>>;
  income?: Awaited<ReturnType<typeof addIncome>>;
  userMsgUpdate?: { messageId: string; expenseId: string };
  /** Signal: host should navigate to Split entry instead of saving an expense in chat. */
  openSplit?: OpenSplitRequest;
}

export async function respondToUserMessage(
  userMsg: SerializableChatMessage,
  parsed: ParseResult,
  ctx: BotContext
): Promise<BotReply> {
  const { userId, currency, incomeCategoriesById, topIncomeCategoryIds } = ctx;
  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  // ── Income path: "+" prefix
  if (parsed.isIncome) {
    // No number → fail
    if (parsed.amount <= 0) {
      return { messages: [makeBotMsg(userId, { text: UNKNOWN_PHRASE })] };
    }

    // No category selected yet → show income clarify card
    if (!parsed.categoryId) {
      const chips = topIncomeCategoryIds
        .slice(0, 5)
        .map((id) => incomeCategoriesById.get(id))
        .filter(Boolean)
        .map((c) => ({ id: c!.id, name: c!.name, icon: c!.icon, color: c!.color }));

      return {
        messages: [
          makeBotMsg(userId, {
            text: `+${sym}\u202F${parsed.amount} — куда записать?`,
            card: {
              kind: 'clarify',
              data: {
                amount: parsed.amount,
                chips,
                isIncome: true,
                parsedDate: parsed.date,
                parsedDateLabel: parsed.dateLabel,
                parsedNote: parsed.note,
              },
            },
            status: 'saved',
          }),
        ],
      };
    }

    // Category selected → save income
    const incomeCat = incomeCategoriesById.get(parsed.categoryId)
      ?? [...incomeCategoriesById.values()].find((c) => c.id === parsed.categoryId);
    const date = expenseDate(parsed);

    let income: Awaited<ReturnType<typeof addIncome>> | undefined;
    try {
      income = await addIncome({
        userId,
        amount: parsed.amount,
        currency,
        categoryId: parsed.categoryId,
        date,
        method: 'bank',
        privacy: 'regular',
        comment: parsed.note || undefined,
      });
    } catch {
      return { messages: [makeBotMsg(userId, { text: saveErrorPhrase(ctx.language) })] };
    }

    await updateMessage(userId, userMsg.id, { status: 'saved', incomeId: income.id });

    const catName = incomeCat?.name ?? 'Доход';
    const _now = new Date();
    const todayStr = toLocalDateKey(_now);
    const isToday = (parsed.date ?? todayStr) === todayStr;
    const dateHint = !isToday && parsed.date
      ? format(parseISO(parsed.date), 'd MMMM', { locale: ru })
      : undefined;

    return {
      messages: [
        makeBotMsg(userId, {
          text: `+${sym}\u202F${parsed.amount} · ${catName}`,
          incomeId: income.id,
          card: {
            kind: 'saved',
            data: {
              icon: incomeCat?.icon ?? 'trending-up',
              color: incomeCat?.color ?? '#10b981',
              title: catName,
              catName: null,
              groupName: null,
              hint: dateHint,
              amount: parsed.amount,
              currency: sym,
              isIncome: true,
              incomeId: income.id,
              userMsgId: userMsg.id,
            },
          },
          status: 'saved',
        }),
      ],
      income,
    };
  }

  // ── No number recognized → fail with unknown phrase
  if (parsed.amount <= 0) {
    return { messages: [makeBotMsg(userId, { text: UNKNOWN_PHRASE })] };
  }

  // ── Any expense with recognized amount → always open Split.
  //    No intermediate clarify cards, no auto-save in chat.
  return {
    messages: [],
    openSplit: {
      amount: parsed.amount,
      userMsgId: userMsg.id,
      ...(parsed.storeId ? { storeId: parsed.storeId } : {}),
      ...(parsed.storeName ? { storeName: parsed.storeName } : parsed.note ? { storeName: parsed.note } : {}),
      ...(parsed.storeGroup ? { storeGroup: parsed.storeGroup } : {}),
      ...(parsed.date ? { date: parsed.date } : {}),
    },
  };
}

