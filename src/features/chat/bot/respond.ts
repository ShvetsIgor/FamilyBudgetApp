import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { addExpense } from '@/features/expenses/services/expensesService';
import { addIncome } from '@/features/income/services/incomeService';
import { addMessage, updateMessage } from '@/features/chat/services/messagesService';
import type { SerializableChatMessage, ParseResult } from '@/shared/types/message';
import type { Category } from '@/shared/types';
import type { BotContext } from './context';
import { savedPhrase, clarifyPhrase, clarifyStorePhrase, UNKNOWN_PHRASE } from './templates';
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
    const parts = parsed.date.split('-').map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      // Use noon local time to avoid UTC day boundary issues (e.g. UTC+3 midnight = prev UTC day)
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    }
  }
  return new Date();
}

export interface FutureCardData {
  amount: number;
  currency: string;
  note?: string;
  dateLabel: string;
  parsedDate: string;
  parsedNote?: string;
  categoryId: string | null;
  userMsgId: string;
  storeId?: string;
  storeName?: string;
  storeGroup?: string;
}

export async function confirmFutureExpense(
  data: FutureCardData,
  botMsgId: string,
  ctx: BotContext
): Promise<BotReply & { expense: Awaited<ReturnType<typeof addExpense>> | undefined }> {
  const { userId, currency, categoriesById, foldersById } = ctx;
  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  const cat = resolveCategory(data.categoryId, categoriesById);
  const catId = cat?.id ?? data.categoryId!;
  const folderCat = cat?.folderId ? foldersById.get(cat.folderId) : undefined;

  const parts = data.parsedDate.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);

  let expense: Awaited<ReturnType<typeof addExpense>> | undefined;
  try {
    expense = await addExpense({
      userId,
      amount: data.amount,
      categoryId: catId,
      date,
      paymentMethod: 'card',
      tags: ['planned'],
      privacy: 'regular',
      currency,
      splits: [],
      ...(data.parsedNote ? { comment: data.parsedNote } : {}),
      ...(data.storeName ? { store: data.storeName } : {}),
      ...(data.storeId ? { storeId: data.storeId } : {}),
      ...(data.storeGroup ? { storeGroup: data.storeGroup } : {}),
    });
  } catch {
    return {
      messages: [makeBotMsg(userId, { text: 'Не удалось сохранить 😔 Попробуй ещё раз' })],
      expense: undefined,
    };
  }

  await updateMessage(userId, data.userMsgId, { expenseId: expense.id, status: 'saved' });
  await updateMessage(userId, botMsgId, { status: 'saved' });

  const savedText = `${savedPhrase()} · ${sym}\u202F${data.amount}`;
  const catPath = folderCat ? `${folderCat.name} · ${cat?.name ?? ''}` : (cat?.name ?? '');

  const dateHint = format(parseISO(data.parsedDate), 'd MMMM', { locale: ru });

  return {
    messages: [
      makeBotMsg(userId, {
        text: savedText,
        card: {
          kind: 'saved',
          data: {
            icon: cat?.icon ?? folderCat?.icon ?? 'box',
            color: cat?.color ?? folderCat?.color ?? '#E07A5F',
            title: catPath,
            catName: cat?.name ?? null,
            parentName: folderCat?.name ?? null,
            hint: dateHint,
            amount: data.amount,
            currency: sym,
            expenseId: expense.id,
            userMsgId: data.userMsgId,
          },
        },
        status: 'saved',
      }),
    ],
    expense,
  };
}

export interface BotReply {
  messages: Omit<SerializableChatMessage, 'id'>[];
  expense?: Awaited<ReturnType<typeof addExpense>>;
  income?: Awaited<ReturnType<typeof addIncome>>;
  userMsgUpdate?: { messageId: string; expenseId: string };
}

export async function respondToUserMessage(
  userMsg: SerializableChatMessage,
  parsed: ParseResult,
  ctx: BotContext
): Promise<BotReply> {
  const { userId, currency, categoriesById, topParentIds, incomeCategoriesById, topIncomeParentIds } = ctx;
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
      const chips = topIncomeParentIds
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
      return { messages: [makeBotMsg(userId, { text: 'Не удалось сохранить 😔 Попробуй ещё раз' })] };
    }

    await updateMessage(userId, userMsg.id, { status: 'saved' });

    const catName = incomeCat?.name ?? 'Доход';
    const _now = new Date();
    const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    const isToday = (parsed.date ?? todayStr) === todayStr;
    const dateHint = !isToday && parsed.date
      ? format(parseISO(parsed.date), 'd MMMM', { locale: ru })
      : undefined;

    return {
      messages: [
        makeBotMsg(userId, {
          text: `+${sym}\u202F${parsed.amount} · ${catName}`,
          card: {
            kind: 'saved',
            data: {
              icon: incomeCat?.icon ?? 'trending-up',
              color: incomeCat?.color ?? '#10b981',
              title: catName,
              catName: null,
              parentName: null,
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

  // ── Case 1: no number at all
  if (parsed.confidence === 'failed' && parsed.amount === 0) {
    return {
      messages: [makeBotMsg(userId, { text: UNKNOWN_PHRASE })],
    };
  }

  // ── Case 1.5: store known but no items → ask what was bought, suggest from profile
  if (parsed.confidence === 'low' && parsed.storeId) {
    const profile = ctx.storeProfiles?.[parsed.storeId];
    let chips: { id: string; name: string; icon: string; color: string }[];

    if (profile && profile.probableSubcategories.length > 0) {
      // Sort by usageCount desc, then by lastUsed desc
      const sorted = [...profile.probableSubcategories].sort(
        (a, b) => b.usageCount - a.usageCount || b.lastUsed.localeCompare(a.lastUsed)
      );
      const profileChips = sorted
        .slice(0, 4)
        .map((u) => categoriesById.get(u.subcategoryId))
        .filter(Boolean)
        .map((c) => ({ id: c!.id, name: c!.name, icon: c!.icon, color: c!.color }));

      // Fill remaining slots from top parents not already shown
      const shownIds = new Set(profileChips.map((c) => c.id));
      const fillChips = topParentIds
        .filter((id) => !shownIds.has(id))
        .slice(0, Math.max(0, 3 - profileChips.length))
        .map((id) => categoriesById.get(id))
        .filter(Boolean)
        .map((c) => ({ id: c!.id, name: c!.name, icon: c!.icon, color: c!.color }));

      chips = [...profileChips, ...fillChips];
    } else {
      // No history → show top parent categories
      chips = topParentIds
        .slice(0, 4)
        .map((id) => categoriesById.get(id))
        .filter(Boolean)
        .map((c) => ({ id: c!.id, name: c!.name, icon: c!.icon, color: c!.color }));
    }

    return {
      messages: [
        makeBotMsg(userId, {
          text: clarifyStorePhrase(parsed.storeName!, parsed.amount, sym),
          card: {
            kind: 'clarify',
            data: {
              amount: parsed.amount,
              chips,
              parsedDate: parsed.date,
              parsedDateLabel: parsed.dateLabel,
              parsedNote: parsed.note,
              storeId: parsed.storeId,
              storeName: parsed.storeName,
              storeGroup: parsed.storeGroup,
            },
          },
          status: 'saved',
        }),
      ],
    };
  }

  // ── Case 1.75: learned keyword — ask again with suggested category on top
  if (parsed.confidence === 'low' && !parsed.storeId && parsed.learnedCategoryId) {
    const learnedCat = resolveCategory(parsed.learnedCategoryId, categoriesById);
    const learnedChip = learnedCat
      ? [{ id: learnedCat.id, name: learnedCat.name, icon: learnedCat.icon, color: learnedCat.color }]
      : [];
    const shownIds = new Set(learnedChip.map((c) => c.id));
    const fillChips = topParentIds
      .filter((id) => !shownIds.has(id))
      .slice(0, 4 - learnedChip.length)
      .map((id) => categoriesById.get(id))
      .filter(Boolean)
      .map((c) => ({ id: c!.id, name: c!.name, icon: c!.icon, color: c!.color }));
    const chips = [...learnedChip, ...fillChips];

    return {
      messages: [
        makeBotMsg(userId, {
          text: clarifyPhrase(parsed.amount, sym),
          card: {
            kind: 'clarify',
            data: {
              amount: parsed.amount,
              chips,
              isRepeat: true,
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

  // ── Case 2.5: future date → ask confirmation
  if (parsed.date) {
    const _now = new Date();
    const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
    if (parsed.date > todayStr) {
      return {
        messages: [
          makeBotMsg(userId, {
            text: '',
            card: {
              kind: 'future',
              data: {
                amount: parsed.amount,
                currency: sym,
                note: parsed.note,
                dateLabel: parsed.dateLabel ?? parsed.date,
                parsedDate: parsed.date,
                parsedNote: parsed.note,
                categoryId: parsed.categoryId,
                userMsgId: userMsg.id,
                storeId: parsed.storeId,
                storeName: parsed.storeName,
                storeGroup: parsed.storeGroup,
              },
            },
            status: 'clarifying',
          }),
        ],
      };
    }
  }

  // ── Case 3: happy path — save expense
  const cat = resolveCategory(parsed.categoryId, categoriesById);
  const catId = cat?.id ?? parsed.categoryId!;
  const folderCat2 = cat?.folderId ? ctx.foldersById.get(cat.folderId) : undefined;
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
      ...(parsed.note ? { comment: parsed.note } : {}),
      ...(parsed.storeName ? { store: parsed.storeName } : {}),
      ...(parsed.storeId ? { storeId: parsed.storeId } : {}),
      ...(parsed.storeGroup ? { storeGroup: parsed.storeGroup } : {}),
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

  const savedText = `${savedPhrase()} · ${sym}\u202F${parsed.amount}`;
  const catPath = cat && parentCat && cat.id !== parentCat.id
    ? `${parentCat.name} · ${cat.name}`
    : (parentCat?.name ?? cat?.name ?? '');

  // Show date hint if it's not today (use local date to avoid UTC offset issues)
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
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
