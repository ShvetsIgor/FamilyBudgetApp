import { format, parseISO } from 'date-fns';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';
import { addExpense } from '@/features/expenses/services/expensesService';
import { addIncome } from '@/features/income/services/incomeService';
import { updateMessage } from '@/features/chat/services/messagesService';
import { getPresetDisplayName } from '@/features/categories/config/categoryLabels';
import type { SerializableChatMessage, ParseResult } from '@/shared/types/message';
import type { BotContext } from './context';
import { makeT } from '@/shared/utils/makeT';
import { unknownPhrase } from './templates';
import { buildExpenseDraft } from '@/features/expenses/engine/buildExpenseDraft';

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
  const { userId, currency, categoriesById, foldersById, incomeCategoriesById, topIncomeCategoryIds } = ctx;
  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  // ── Income path: "+" prefix
  if (parsed.isIncome) {
    // No number → fail
    if (parsed.amount <= 0) {
      return { messages: [makeBotMsg(userId, { text: unknownPhrase(ctx.language) })] };
    }

    // No category selected yet → show income clarify card
    if (!parsed.categoryId) {
      const chips = topIncomeCategoryIds
        .slice(0, 5)
        .map((id) => incomeCategoriesById.get(id))
        .filter(Boolean)
        .map((c) => ({
          id: c!.id,
          name: getPresetDisplayName(c!.id, ctx.language) ?? c!.name,
          icon: c!.icon,
          color: c!.color,
        }));

      return {
        messages: [
          makeBotMsg(userId, {
            text: makeT(ctx.language)('chat.bot.whereTo', { sym, amount: parsed.amount }),
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

    const catName = incomeCat
      ? (getPresetDisplayName(incomeCat.id, ctx.language) ?? incomeCat.name)
      : (ctx.language === 'ru' ? 'Доход' : 'Income');
    const _now = new Date();
    const todayStr = toLocalDateKey(_now);
    const isToday = (parsed.date ?? todayStr) === todayStr;
    const dateHint = !isToday && parsed.date
      ? format(parseISO(parsed.date), 'd MMMM', { locale: getDateFnsLocale(ctx.language) })
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
    return { messages: [makeBotMsg(userId, { text: unknownPhrase(ctx.language) })] };
  }

  // ── Explicit category confirmation → save one-category expense.
  // Merchant/amount alone never reaches this branch: confirmed is set only by
  // the clarification UI after the user makes an intentional choice.
  if (parsed.confirmed && parsed.categoryId) {
    const category = categoriesById.get(parsed.categoryId);
    if (!category || category.archived) {
      return { messages: [makeBotMsg(userId, { text: unknownPhrase(ctx.language) })] };
    }
    const date = expenseDate(parsed);
    let expense: Awaited<ReturnType<typeof addExpense>> | undefined;
    try {
      expense = await addExpense({
        userId,
        amount: parsed.amount,
        currency,
        categoryId: category.id,
        date,
        paymentMethod: 'card',
        store: parsed.storeName,
        storeId: parsed.storeId,
        storeGroup: parsed.storeGroup,
        tags: [],
        comment: parsed.storeName ? undefined : parsed.note,
        privacy: category.isPrivate ? 'secret' : 'regular',
        splits: [],
      });
    } catch {
      return { messages: [makeBotMsg(userId, { text: saveErrorPhrase(ctx.language) })] };
    }

    await updateMessage(userId, userMsg.id, { status: 'saved', expenseId: expense.id });
    const categoryName = getPresetDisplayName(category.id, ctx.language) ?? category.name;
    const folder = category.folderId ? foldersById.get(category.folderId) : undefined;
    const folderName = folder ? (getPresetDisplayName(folder.id, ctx.language) ?? folder.name) : null;
    const todayStr = toLocalDateKey(new Date());
    const dateHint = parsed.date && parsed.date !== todayStr
      ? format(parseISO(parsed.date), 'd MMMM', { locale: getDateFnsLocale(ctx.language) })
      : undefined;
    const hint = category.id === 'unsorted'
      ? makeT(ctx.language)('chat.clarify.deferHint')
      : dateHint;

    return {
      messages: [
        makeBotMsg(userId, {
          text: `${sym}\u202F${parsed.amount} · ${parsed.storeName ?? categoryName}`,
          expenseId: expense.id,
          card: {
            kind: 'saved',
            data: {
              icon: category.icon,
              color: category.color,
              title: parsed.storeName ?? categoryName,
              catName: categoryName,
              groupName: folderName,
              hint,
              amount: parsed.amount,
              currency: sym,
              expenseId: expense.id,
              userMsgId: userMsg.id,
            },
          },
          status: 'saved',
        }),
      ],
      expense,
      userMsgUpdate: { messageId: userMsg.id, expenseId: expense.id },
    };
  }

  // ── Ambiguous expense → lightweight in-chat classification.
  // A merchant can sell unrelated goods, so merchant + amount is never enough
  // for silent categorisation. History only ranks suggestions; the user still
  // chooses single category, Split, all categories, or "sort later".
  const categories = [...categoriesById.values()].filter((category) => !category.archived);
  const draft = buildExpenseDraft(
    { raw: userMsg.text, merchant: parsed.storeName, amount: parsed.amount },
    categories,
    ctx.suggestionMemory,
  );
  // Only EARNED suggestions: a dictionary hit, a learned word, or something
  // the engine backed with merchant history (it already refuses to surface
  // recency-only guesses). Padding this list with the user's overall top
  // categories filled the card up to five confident-looking chips even when
  // nothing was known — a supermarket would offer «Квартира» and «Видео»,
  // which teaches people to ignore the chips altogether. No signal now means
  // no chips, and the card asks instead of guessing.
  const candidateIds = [
    parsed.categoryId,
    parsed.learnedCategoryId,
    ...draft.suggestedCategories.map((suggestion) => suggestion.categoryId),
    ...draft.splitPresets.flatMap((preset) => preset.categoryIds),
  ].filter((id): id is string => Boolean(id));
  const seen = new Set<string>();
  const chips = candidateIds
    .filter((id) => {
      if (seen.has(id) || !categoriesById.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 3)
    .map((id) => categoriesById.get(id)!)
    .map((category) => ({
      id: category.id,
      name: getPresetDisplayName(category.id, ctx.language) ?? category.name,
      icon: category.icon,
      color: category.color,
    }));

  return {
    messages: [makeBotMsg(userId, {
      text: makeT(ctx.language)('chat.bot.classifyExpense', { sym, amount: parsed.amount }),
      card: {
        kind: 'clarify',
        data: {
          amount: parsed.amount,
          chips,
          isIncome: false,
          userMsgId: userMsg.id,
          storeId: parsed.storeId,
          storeName: parsed.storeName ?? parsed.note,
          storeGroup: parsed.storeGroup,
          parsedDate: parsed.date,
          parsedDateLabel: parsed.dateLabel,
          parsedNote: parsed.note,
          isRepeat: draft.hasMerchantHistory,
          hasSplitPreset: draft.splitPresets.length > 0,
        },
      },
      status: 'clarifying',
    })],
  };
}
