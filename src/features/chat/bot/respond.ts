import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { addExpense } from '@/features/expenses/services/expensesService';
import { addMessage, updateMessage } from '@/features/chat/services/messagesService';
import type { SerializableChatMessage, ParseResult } from '@/shared/types/message';
import type { Category } from '@/shared/types';
import type { BotContext } from './context';
import { savedPhrase, clarifyPhrase, UNKNOWN_PHRASE } from './templates';
import { TAXONOMY, INCOME_TAXONOMY } from '@/features/categories/icons/icons';

// Lookup category by taxonomy alias — handles both stable IDs and legacy random IDs
function resolveCategory(alias: string | null, categoriesById: Map<string, Category>): Category | undefined {
  if (!alias) return undefined;
  const direct = categoriesById.get(alias);
  if (direct) return direct;
  // Find taxonomy name for this alias
  for (const parent of [...TAXONOMY, INCOME_TAXONOMY as typeof TAXONOMY[0]]) {
    if (parent.id === alias) {
      for (const [, cat] of categoriesById) {
        if (cat.name === parent.name && !cat.parentId) return cat;
      }
    }
    for (const sub of parent.subs ?? []) {
      if (sub.id === alias) {
        for (const [, cat] of categoriesById) {
          if (cat.name === sub.name) return cat;
        }
      }
    }
  }
  return undefined;
}

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

function expenseDate(parsed: ParseResult): Date {
  if (parsed.date) {
    const d = parseISO(parsed.date);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

export interface BotReply {
  messages: Omit<SerializableChatMessage, 'id'>[];
  expense?: Awaited<ReturnType<typeof addExpense>>;
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
            data: {
              amount: parsed.amount,
              chips,
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

  // ── Case 3: happy path — save expense
  const cat = resolveCategory(parsed.categoryId, categoriesById);
  const catId = cat?.id ?? parsed.categoryId!;
  const parentCat = resolveCategory(parsed.parentId, categoriesById) ?? cat;
  const date = expenseDate(parsed);

  let expense: Awaited<ReturnType<typeof addExpense>> | undefined;
  try {
    expense = await addExpense({
      userId,
      amount: parsed.amount,
      categoryId: catId,
      date,
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

  await updateMessage(userId, userMsg.id, {
    expenseId: expense.id,
    status: 'saved',
  });

  const savedText = `${savedPhrase()} · ${sym}${parsed.amount}`;
  const catPath = cat && parentCat && cat.id !== parentCat.id
    ? `${parentCat.name} · ${cat.name}`
    : (parentCat?.name ?? cat?.name ?? '');

  // Show date hint if it's not today
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = (parsed.date ?? todayStr) === todayStr;
  const dateHint = !isToday && parsed.date
    ? format(parseISO(parsed.date), 'd MMMM', { locale: ru })
    : undefined;

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
            catName: cat?.name ?? null,
            parentName: parentCat?.name ?? null,
            hint: dateHint,
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
