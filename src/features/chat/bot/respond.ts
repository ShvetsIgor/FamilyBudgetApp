import { addExpense } from '@/features/expenses/services/expensesService';
import { addMessage, updateMessage } from '@/features/chat/services/messagesService';
import type { SerializableChatMessage, ParseResult } from '@/shared/types/message';
import type { BotContext } from './context';
import { savedPhrase, clarifyPhrase, UNKNOWN_PHRASE } from './templates';

function nowTimestamp(): string {
  return new Date().toISOString();
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

export interface BotReply {
  /** Persist to Firestore via addMessage */
  messages: Omit<SerializableChatMessage, 'id'>[];
  /** If an expense was created, dispatch prependExpense with this */
  expense?: Awaited<ReturnType<typeof addExpense>>;
  /** If the user message should be updated (expenseId + status) */
  userMsgUpdate?: { messageId: string; expenseId: string };
}

export async function respondToUserMessage(
  userMsg: SerializableChatMessage,
  parsed: ParseResult,
  ctx: BotContext
): Promise<BotReply> {
  const { userId, currency, categoriesById, topParentIds } = ctx;
  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  // ── Case 1: no number at all
  if (parsed.confidence === 'failed' && parsed.amount === 0) {
    return {
      messages: [makeBotMsg(userId, { text: UNKNOWN_PHRASE })],
    };
  }

  // ── Case 2: have amount but no category → clarify card
  if (parsed.confidence === 'failed') {
    const chipIds = topParentIds.slice(0, 5);
    const chips = chipIds
      .map((id) => categoriesById.get(id))
      .filter(Boolean)
      .map((c) => ({ id: c!.id, name: c!.name, icon: c!.icon, color: c!.color }));

    return {
      messages: [
        makeBotMsg(userId, {
          text: clarifyPhrase(parsed.amount, sym),
          card: {
            kind: 'clarify',
            data: { amount: parsed.amount, chips },
          },
          status: 'saved',
        }),
      ],
    };
  }

  // ── Case 3: happy path — save expense
  const catId = parsed.categoryId!;
  const cat = categoriesById.get(catId);
  const parentCat = parsed.parentId ? categoriesById.get(parsed.parentId) : cat;

  let expense: Awaited<ReturnType<typeof addExpense>> | undefined;
  try {
    expense = await addExpense({
      userId,
      amount: parsed.amount,
      categoryId: catId,
      date: new Date(),
      paymentMethod: 'card',
      tags: [],
      privacy: 'regular',
      currency,
      splits: [],
    });
  } catch {
    return {
      messages: [makeBotMsg(userId, { text: 'Не удалось сохранить 😔 Попробуй ещё раз' })],
    };
  }

  // Update user message with expenseId
  await updateMessage(userId, userMsg.id, {
    expenseId: expense.id,
    status: 'saved',
  });

  const savedText = `${savedPhrase()} · ${sym}${parsed.amount}`;
  const catPath = cat && parentCat && cat.id !== parentCat.id
    ? `${parentCat.name} · ${cat.name}`
    : (parentCat?.name ?? cat?.name ?? '');

  return {
    messages: [
      makeBotMsg(userId, {
        text: savedText,
        card: {
          kind: 'saved',
          data: {
            icon: cat?.icon ?? parentCat?.icon ?? 'box',
            color: parentCat?.color ?? '#E07A5F',
            title: catPath,
            amount: parsed.amount,
            currency: sym,
          },
        },
        status: 'saved',
      }),
    ],
    expense,
    userMsgUpdate: { messageId: userMsg.id, expenseId: expense.id },
  };
}
