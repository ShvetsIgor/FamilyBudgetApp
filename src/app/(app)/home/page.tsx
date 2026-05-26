'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useAppSelector, useAppDispatch } from '@/store/store';
import { setTyping, removeMessage } from '@/features/chat/store/chatSlice';
import { addFolder as addFolderAction } from '@/features/categories/store/categoriesSlice';
import { addFolder } from '@/features/categories/services/categoryFoldersService';
import { prependExpense, removeExpense, mergeExpenses } from '@/features/expenses/store/expensesSlice';
import { recordExpense } from '@/features/expenses/store/suggestionMemorySlice';
import { prependIncome } from '@/features/income/store/incomeSlice';

import { useChatMessages } from '@/features/chat/hooks/useChatMessages';
import { useLearnedKeywords } from '@/features/chat/hooks/useLearnedKeywords';
import { useStoreProfiles } from '@/features/chat/hooks/useStoreProfiles';

import { parseMessage } from '@/features/chat/parser/parse';
import { matchItem } from '@/features/chat/parser/itemDictionary';
import { saveLearnedKeyword } from '@/features/chat/parser/learning';
import { updateStoreProfile } from '@/features/chat/services/storeProfilesService';
import { upsertProfile } from '@/features/chat/store/storeProfilesSlice';
import { deleteExpense, fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { deleteMessageAndExpense } from '@/features/chat/services/messagesService';
import { collectBotContext } from '@/features/chat/bot/context';
import { respondToUserMessage, confirmFutureExpense } from '@/features/chat/bot/respond';
import type { FutureCardData } from '@/features/chat/bot/respond';
import { addMessage } from '@/features/chat/services/messagesService';
import {
  shouldSendMorningGreeting,
  markMorningGreetingSent,
  sendMorningGreeting,
} from '@/features/chat/bot/morning';
import {
  shouldSendWeeklySummary,
  markWeeklySummarySent,
  sendWeeklySummary,
} from '@/features/chat/bot/weekly';
import { isSlashCommand, handleSlashCommand } from '@/features/chat/bot/slash';

import { ChatScreen } from '@/features/chat/components/ChatScreen';
import { CategorySheet } from '@/features/chat/components/CategorySheet';
import { BudgetSettingsSheet } from '@/features/chat/components/BudgetSettingsSheet';
import { PinnedToday } from '@/features/chat/components/PinnedToday';
import { DateChip } from '@/features/chat/components/DateChip';
import { BotBubble, BotCardBubble } from '@/features/chat/components/BotBubble';
import { UserBubble } from '@/features/chat/components/UserBubble';
import { SavedCard } from '@/features/chat/components/BotCard/SavedCard';
import { FutureCard } from '@/features/chat/components/BotCard/FutureCard';
import { ClarifyCard } from '@/features/chat/components/BotCard/ClarifyCard';
import { MorningCard } from '@/features/chat/components/BotCard/MorningCard';
import { WeeklyCard } from '@/features/chat/components/BotCard/WeeklyCard';
import { EnvelopesCard } from '@/features/chat/components/BotCard/EnvelopesCard';
import { Typing } from '@/features/chat/components/Typing';
import { useT } from '@/shared/hooks/useT';
import type { MorningCardData } from '@/features/chat/components/BotCard/MorningCard';
import type { WeeklyCardData } from '@/features/chat/components/BotCard/WeeklyCard';
import type { EnvelopesCardData } from '@/features/chat/components/BotCard/EnvelopesCard';
import type { Currency } from '@/shared/types';
import { toLocalDateKey } from '@/shared/utils/dateKey';

import type { SerializableChatMessage } from '@/shared/types/message';

function msgTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

function localDateKey(iso: string): string {
  return toLocalDateKey(iso);
}

function groupByDay(messages: SerializableChatMessage[]): { day: string; items: SerializableChatMessage[] }[] {
  const map = new Map<string, SerializableChatMessage[]>();
  for (const m of messages) {
    const key = localDateKey(m.createdAt);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

export default function HomePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const t = useT();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const currency = useAppSelector((s) => s.ui.currency) as Currency;
  const messages = useAppSelector((s) => s.chat.messages);
  const typing = useAppSelector((s) => s.chat.typing);
  const state = useAppSelector((s) => s);
  const language = useAppSelector((s) => s.ui.language);

  const dateFnsLocale = language === 'ru' ? ru : undefined;

  function dayLabel(iso: string): string {
    const d = parseISO(iso);
    if (isToday(d)) return t('common.today');
    if (isYesterday(d)) return t('common.yesterday');
    return format(d, 'd MMMM', { locale: dateFnsLocale });
  }

  useChatMessages();
  const [learned, addLearned] = useLearnedKeywords();
  useStoreProfiles();

  const budgetMode = useAppSelector((s) => s.ui.budgetMode);
  const budgetDailyLimit = useAppSelector((s) => s.ui.budgetDailyLimit);
  const budgetMonthlyLimit = useAppSelector((s) => s.ui.budgetMonthlyLimit);
  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const monthBudget = useAppSelector((s) =>
    Object.values(s.budget.limits).reduce((acc, v) => acc + v, 0)
  );

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const monthStr = todayStr.slice(0, 7);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;

  const todaySpent = useAppSelector((s) =>
    s.expenses.list.filter((e) => {
      const d = new Date(e.date);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return ds === todayStr;
    }).reduce((acc, e) => acc + e.amount, 0)
  );
  const monthSpent = useAppSelector((s) =>
    s.expenses.list.filter((e) => e.date.startsWith(monthStr)).reduce((acc, e) => acc + e.amount, 0)
  );
  const monthIncome = useAppSelector((s) =>
    s.income.list.filter((i) => i.date.startsWith(monthStr)).reduce((acc, i) => acc + i.amount, 0)
  );

  // Compute daily budget based on selected mode
  const autoDaily = monthIncome > 0
    ? Math.max(0, Math.round((monthIncome - monthSpent) / remainingDays))
    : 0;

  const dailyBudget = (() => {
    if (budgetMode === 'daily') return budgetDailyLimit;
    if (budgetMode === 'monthly') return budgetMonthlyLimit > 0
      ? Math.max(0, Math.round((budgetMonthlyLimit - monthSpent) / remainingDays))
      : 0;
    return autoDaily; // 'auto'
  })();

  // PinnedToday display values — monthly mode shows month-level data
  const displaySpent = budgetMode === 'monthly' ? monthSpent : todaySpent;
  const displayTotal = budgetMode === 'monthly' ? budgetMonthlyLimit : dailyBudget;
  const displayLabel = budgetMode === 'monthly' ? t('chat.today.monthLabel') : t('chat.today.budgetLabel');

  const allExpenses = useAppSelector((s) => s.expenses.list);
  const allExpenseCats = useAppSelector((s) => s.categories.expense);
  const allExpenseFolders = useAppSelector((s) => s.categories.folders.expense ?? []);
  const allIncomeCats = useAppSelector((s) => s.categories.income);
  const savingsGoals = useAppSelector((s) => s.savings.list);
  const [budgetSettingsOpen, setBudgetSettingsOpen] = useState(false);

  // Load current month expenses on home mount so todaySpent is accurate
  useEffect(() => {
    if (!userId) return;
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    fetchMonthExpenses(userId, month)
      .then((list) => dispatch(mergeExpenses(list)))
      .catch(() => {});
  }, [userId, dispatch]);

  // Auto-send morning greeting / weekly summary on first daily mount
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (!userId || autoSentRef.current) return;
    autoSentRef.current = true;

    const ctx = collectBotContext(state);
    if (!ctx) return;

    const yesterdayStr = toLocalDateKey(new Date(Date.now() - 86_400_000));
    const yesterdayExpenses = allExpenses.filter((e) => e.date.startsWith(yesterdayStr));
    const firstGoalName = savingsGoals.find((g) => !g.name?.toLowerCase().includes('savings'))?.name;

    const enrichedCtx = {
      ...ctx,
      yesterdayExpenses,
      dailyBudget,
      monthBudget,
      budgetLimits,
      allExpenses,
      firstGoalName,
    };

    if (shouldSendMorningGreeting()) {
      markMorningGreetingSent();
      sendMorningGreeting(enrichedCtx).catch(() => {});
    }

    if (shouldSendWeeklySummary()) {
      markWeeklySummarySent();
      sendWeeklySummary(enrichedCtx).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const sendingRef = useRef(false);

  type ClarifyContext = {
    amount: number;
    parsedDate?: string;
    parsedDateLabel?: string;
    parsedNote?: string;
    isIncome?: boolean;
    storeId?: string;
    storeName?: string;
    storeGroup?: string;
    isTagLearning?: boolean;
  };
  const [categorySheet, setCategorySheet] = useState<ClarifyContext | null>(null);

  const buildEnrichedCtx = useCallback(() => {
    const ctx = collectBotContext(state);
    if (!ctx) return null;
    return {
      ...ctx,
      allExpenses,
      monthBudget,
      budgetLimits,
      dailyBudget,
      firstGoalName: savingsGoals.find((g) => !g.name?.toLowerCase().includes('savings'))?.name,
    };
  }, [state, allExpenses, monthBudget, budgetLimits, dailyBudget, savingsGoals]);

  const syncChatExpenseMemory = useCallback((expense: { categoryId: string; store?: string; date: string }) => {
    const category = allExpenseCats.find((c) => c.id === expense.categoryId);
    dispatch(recordExpense({
      merchant: expense.store,
      categoryId: expense.categoryId,
      folderId: category?.folderId ?? undefined,
      date: toLocalDateKey(expense.date),
    }));
  }, [allExpenseCats, dispatch]);

  const handleSend = useCallback(async (text: string) => {
    if (!userId || sendingRef.current) return;
    sendingRef.current = true;

    dispatch(setTyping(true));

    try {
      const enrichedCtx = buildEnrichedCtx();
      if (!enrichedCtx) return;

      // Slash command — save user message, skip expense parsing
      if (isSlashCommand(text)) {
        await addMessage({ userId, senderId: userId, kind: 'user', text, status: 'saved' });
        await new Promise((r) => setTimeout(r, 150));
        await handleSlashCommand(text, enrichedCtx);
        return;
      }

      // Normal expense parsing
      const parsed = parseMessage(text, { learned });
      const userMsg = await addMessage({
        userId,
        senderId: userId,
        kind: 'user',
        text,
        parsed,
        status: 'pending',
      });

      await new Promise((r) => setTimeout(r, 250));

      const reply = await respondToUserMessage(userMsg, parsed, enrichedCtx);
      for (const botMsg of reply.messages) {
        await addMessage(botMsg);
      }
      if (reply.expense) {
        dispatch(prependExpense(reply.expense));
        syncChatExpenseMemory(reply.expense);
        if (reply.expense.storeId && reply.expense.store) {
          dispatch(upsertProfile({
            storeId: reply.expense.storeId,
            storeName: reply.expense.store,
            storeGroup: reply.expense.storeGroup,
            categoryId: reply.expense.categoryId,
          }));
        }
      }
      if (reply.income) dispatch(prependIncome(reply.income));
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, learned, dispatch, syncChatExpenseMemory]);

  const handleClarifyChip = useCallback(async (
    amount: number,
    chip: { id: string; name: string; icon: string; color: string },
    parsedDate?: string,
    parsedDateLabel?: string,
    parsedNote?: string,
    storeId?: string,
    storeName?: string,
    storeGroup?: string,
    isTagLearning?: boolean,
  ) => {
    if (!userId || sendingRef.current) return;

    // isTagLearning + folder chip → navigate to split UI, do not save expense yet
    if (isTagLearning && allExpenseFolders.some(f => f.id === chip.id)) {
      const params = new URLSearchParams({ fromChat: 'true', amount: String(amount), folderId: chip.id, folderName: chip.name });
      if (storeId) params.set('storeId', storeId);
      if (storeName) params.set('storeName', storeName);
      if (storeGroup) params.set('storeGroup', storeGroup);
      if (parsedDate) params.set('date', parsedDate);
      router.push(`/expenses/new?${params.toString()}`);
      return;
    }

    sendingRef.current = true;

    if (storeId) {
      // Update store purchase history (store ≠ category — probabilistic memory)
      dispatch(upsertProfile({ storeId, storeName: storeName!, storeGroup, categoryId: chip.id }));
      updateStoreProfile(userId, storeId, storeName!, chip.id, storeGroup).catch(() => {});
    } else {
      // Teach learned keyword for non-store inputs
      const keyword = parsedNote?.trim() || chip.name.toLowerCase();
      const hit = { categoryId: chip.id };
      await saveLearnedKeyword(userId, keyword.toLowerCase(), hit);
      addLearned(keyword.toLowerCase(), hit); // optimistic update so next parse uses it immediately
    }

    dispatch(setTyping(true));
    try {
      const enrichedCtx = buildEnrichedCtx();
      if (!enrichedCtx) return;

      // Add visible user message
      const storeLabel = storeName ? ` · ${storeName}` : '';
      const userMsg = await addMessage({
        userId,
        senderId: userId,
        kind: 'user',
        text: `${amount} ${t.cat(chip.name).toLowerCase()}${storeLabel}${parsedDateLabel ? ` · ${parsedDateLabel}` : ''}`,
        status: 'saved',
      });

      await new Promise((r) => setTimeout(r, 150));

      // Bypass re-parse — we already know the category and date
      const parsed: import('@/shared/types/message').ParseResult = {
        amount,
        categoryId: chip.id,
        confidence: 'high',
        date: parsedDate,
        dateLabel: parsedDateLabel,
        note: parsedNote,
        storeId,
        storeName,
        storeGroup,
      };

      const reply = await respondToUserMessage(userMsg, parsed, enrichedCtx);
      for (const botMsg of reply.messages) {
        await addMessage(botMsg);
      }
      if (reply.expense) {
        dispatch(prependExpense(reply.expense));
        syncChatExpenseMemory(reply.expense);
      }
      if (reply.income) dispatch(prependIncome(reply.income));
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, allExpenseFolders, buildEnrichedCtx, dispatch, router, addLearned, t, syncChatExpenseMemory]);

  const handleIncomeClarifyChip = useCallback(async (
    amount: number,
    chip: { id: string; name: string; icon: string; color: string },
    parsedDate?: string,
    parsedDateLabel?: string,
    parsedNote?: string,
  ) => {
    if (!userId || sendingRef.current) return;
    sendingRef.current = true;
    dispatch(setTyping(true));
    try {
      const enrichedCtx = buildEnrichedCtx();
      if (!enrichedCtx) return;

      const userMsg = await addMessage({
        userId,
        senderId: userId,
        kind: 'user',
        text: `+${amount} ${chip.name.toLowerCase()}${parsedDateLabel ? ` · ${parsedDateLabel}` : ''}`,
        status: 'saved',
      });

      await new Promise((r) => setTimeout(r, 150));

      const parsed: import('@/shared/types/message').ParseResult = {
        amount,
        categoryId: chip.id,
        confidence: 'high',
        isIncome: true,
        date: parsedDate,
        dateLabel: parsedDateLabel,
        note: parsedNote,
      };

      const reply = await respondToUserMessage(userMsg, parsed, enrichedCtx);
      for (const botMsg of reply.messages) {
        await addMessage(botMsg);
      }
      if (reply.income) dispatch(prependIncome(reply.income));
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, dispatch]);

  const handleUndo = useCallback(async (
    botMsgId: string,
    userMsgId: string,
    expenseId: string,
  ) => {
    if (!userId) return;
    // Remove from Redux immediately
    dispatch(removeMessage(botMsgId));
    dispatch(removeMessage(userMsgId));
    const expense = allExpenses.find((e) => e.id === expenseId);
    if (expense) dispatch(removeExpense(expenseId));
    // Delete from Firestore
    try {
      await deleteMessageAndExpense(userId, botMsgId);
      await deleteMessageAndExpense(userId, userMsgId);
      if (expense) await deleteExpense(userId, expense);
    } catch { /* ignore */ }
  }, [userId, allExpenses, dispatch]);

  const handleCreateFolder = useCallback(async (
    name: string,
    amount?: number,
    storeId?: string,
    storeName?: string,
    storeGroup?: string,
    parsedDate?: string,
  ) => {
    if (!userId) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const newFolder = await addFolder(userId, {
      name: trimmed,
      icon: 'box',
      color: '#94A3B8',
      order: 99,
      type: 'expense',
    });
    dispatch(addFolderAction(newFolder));

    // Navigate directly to split UI — no bot message, flow continues unbroken
    const params = new URLSearchParams({ fromChat: 'true', amount: String(amount ?? 0), folderId: newFolder.id, folderName: newFolder.name });
    if (storeId) params.set('storeId', storeId);
    if (storeName) params.set('storeName', storeName);
    if (storeGroup) params.set('storeGroup', storeGroup);
    if (parsedDate) params.set('date', parsedDate);
    router.push(`/expenses/new?${params.toString()}`);
  }, [userId, dispatch, router]);

  const handleFutureConfirm = useCallback(async (botMsgId: string, data: FutureCardData) => {
    if (!userId || sendingRef.current) return;
    sendingRef.current = true;
    dispatch(setTyping(true));
    try {
      const enrichedCtx = buildEnrichedCtx();
      if (!enrichedCtx) return;
      const reply = await confirmFutureExpense(data, botMsgId, enrichedCtx);
      for (const botMsg of reply.messages) {
        await addMessage(botMsg);
      }
      if (reply.expense) {
        dispatch(prependExpense(reply.expense));
        syncChatExpenseMemory(reply.expense);
      }
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, dispatch, syncChatExpenseMemory]);

  const handleFutureCancel = useCallback(async (botMsgId: string, userMsgId: string) => {
    if (!userId) return;
    dispatch(removeMessage(botMsgId));
    dispatch(removeMessage(userMsgId));
    try {
      await deleteMessageAndExpense(userId, botMsgId);
      await deleteMessageAndExpense(userId, userMsgId);
    } catch { /* ignore */ }
  }, [userId, dispatch]);

  const groups = groupByDay(messages);

  if (!userId) return null;

  return (
    <>
    <ChatScreen onSend={handleSend} onPlus={() => router.push('/expenses/new')} disabled={typing}>
      {/* Pinned today hero */}
      <PinnedToday
        spent={displaySpent}
        total={displayTotal}
        currency={currency}
        dayLabel={displayLabel}
        budgetMode={budgetMode}
        onSettings={() => setBudgetSettingsOpen(true)}
      />

      {/* Message groups */}
      {groups.map(({ day, items }) => (
        <div key={day}>
          <DateChip label={dayLabel(day + 'T00:00:00')} />
          {items.map((msg, idx) => {
            const nextSameSender = idx < items.length - 1 && items[idx + 1]?.kind === msg.kind;
            const tail = !nextSameSender;
            const time = msgTime(msg.createdAt);

            if (msg.kind === 'user') {
              return (
                <UserBubble
                  key={msg.id}
                  text={msg.text}
                  time={time}
                  status={msg.status as 'pending' | 'saved' | 'sent'}
                  tail={tail}
                />
              );
            }

            if (msg.card?.kind === 'morning' || msg.card?.kind === 'weekly') {
              return null;
            }

            if (msg.card?.kind === 'envelopes') {
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <EnvelopesCard data={msg.card.data as EnvelopesCardData} />
                </BotCardBubble>
              );
            }

            if (msg.card?.kind === 'saved') {
              const d = msg.card.data as Record<string, unknown>;
              const groupName = d.groupName as string | null | undefined;
              const catName = d.catName as string | null | undefined;
              const translatedTitle = groupName && catName && catName !== groupName
                ? `${t.cat(groupName)} · ${t.cat(catName)}`
                : groupName ? t.cat(groupName) : catName ? t.cat(catName) : (d.title as string);
              const savedExpenseId = d.expenseId as string | undefined;
              const savedUserMsgId = d.userMsgId as string | undefined;
              const undoHandler = savedExpenseId && savedUserMsgId
                ? () => handleUndo(msg.id, savedUserMsgId, savedExpenseId)
                : undefined;
              return (
                <div key={msg.id}>
                  <BotCardBubble tail={tail}>
                    <SavedCard
                      icon={d.icon as string}
                      color={d.color as string}
                      title={translatedTitle}
                      hint={d.hint as string | undefined}
                      amount={d.amount as number}
                      currency={d.currency as string}
                      isIncome={(d.isIncome as boolean | undefined) ?? false}
                    />
                  </BotCardBubble>
                  {undoHandler && (
                    <div className="flex" style={{ paddingLeft: 42, marginTop: 4, marginBottom: 2 }}>
                      <button
                        onClick={undoHandler}
                        className="text-[11.5px] font-[700] active:opacity-50 transition-opacity"
                        style={{
                          color: '#9CA3AF',
                          background: 'none',
                          border: 'none',
                          borderBottom: '1.5px dashed #9CA3AF77',
                          cursor: 'pointer',
                          paddingBottom: 1,
                        }}
                      >
                        {t('chat.clarify.undo')}
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            if (msg.card?.kind === 'future') {
              const d = msg.card.data as FutureCardData;
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <FutureCard
                    amount={d.amount}
                    currency={d.currency}
                    note={d.note}
                    dateLabel={d.dateLabel}
                    onConfirm={() => handleFutureConfirm(msg.id, d)}
                    onCancel={() => handleFutureCancel(msg.id, d.userMsgId)}
                  />
                </BotCardBubble>
              );
            }

            if (msg.card?.kind === 'clarify') {
              const d = msg.card.data as Record<string, unknown>;
              const cardIsIncome = !!(d.isIncome as boolean | undefined);
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <ClarifyCard
                    amount={d.amount as number}
                    currency={(d.currency as string | undefined) ?? '₪'}
                    chips={d.chips as { id: string; name: string; icon: string; color: string }[]}
                    unknownNote={d.parsedNote as string | undefined}
                    isRepeat={(d.isRepeat as boolean | undefined) ?? false}
                    storeName={d.storeName as string | undefined}
                    isTagLearning={(d.isTagLearning as boolean | undefined) ?? false}
                    categories={cardIsIncome ? allIncomeCats : allExpenseCats}
                    onSelectChip={(chip) => cardIsIncome
                      ? handleIncomeClarifyChip(
                          d.amount as number,
                          chip,
                          d.parsedDate as string | undefined,
                          d.parsedDateLabel as string | undefined,
                          d.parsedNote as string | undefined,
                        )
                      : handleClarifyChip(
                          d.amount as number,
                          chip,
                          d.parsedDate as string | undefined,
                          d.parsedDateLabel as string | undefined,
                          d.parsedNote as string | undefined,
                          d.storeId as string | undefined,
                          d.storeName as string | undefined,
                          d.storeGroup as string | undefined,
                          (d.isTagLearning as boolean | undefined) ?? false,
                        )
                    }
                    onAllCategories={() => setCategorySheet({
                      amount: d.amount as number,
                      parsedDate: d.parsedDate as string | undefined,
                      parsedDateLabel: d.parsedDateLabel as string | undefined,
                      parsedNote: d.parsedNote as string | undefined,
                      isIncome: cardIsIncome,
                      storeId: d.storeId as string | undefined,
                      storeName: d.storeName as string | undefined,
                      storeGroup: d.storeGroup as string | undefined,
                      isTagLearning: (d.isTagLearning as boolean | undefined) ?? false,
                    })}
                    onSplit={cardIsIncome ? undefined : () => {
                      const params = new URLSearchParams({
                        fromChat: 'true',
                        amount: String(d.amount as number),
                        ...(d.storeId ? { storeId: d.storeId as string } : {}),
                        ...(d.storeName ? { storeName: d.storeName as string } : {}),
                        ...(d.storeGroup ? { storeGroup: d.storeGroup as string } : {}),
                        ...(d.parsedDate ? { date: d.parsedDate as string } : {}),
                      });
                      router.push(`/expenses/new?${params.toString()}`);
                    }}
                    onCreateFolder={cardIsIncome ? undefined : (name) => handleCreateFolder(name, d.amount as number, d.storeId as string | undefined, d.storeName as string | undefined, d.storeGroup as string | undefined, d.parsedDate as string | undefined)}
                    onOtherText={cardIsIncome ? undefined : (text) => {
                      const itemHit = matchItem(text.toLowerCase());
                      if (itemHit) {
                        const cat = allExpenseCats.find(
                          (c) => c.id === itemHit.categoryId || (c.name.toLowerCase() === itemHit.keyword && !c.archived)
                        );
                        if (cat) {
                          handleClarifyChip(
                            d.amount as number,
                            { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color },
                            d.parsedDate as string | undefined,
                            d.parsedDateLabel as string | undefined,
                            text,
                            d.storeId as string | undefined,
                            d.storeName as string | undefined,
                            d.storeGroup as string | undefined,
                          );
                          return;
                        }
                      }
                      setCategorySheet({
                        amount: d.amount as number,
                        parsedDate: d.parsedDate as string | undefined,
                        parsedDateLabel: d.parsedDateLabel as string | undefined,
                        parsedNote: text,
                        storeId: d.storeId as string | undefined,
                        storeName: d.storeName as string | undefined,
                        storeGroup: d.storeGroup as string | undefined,
                        isTagLearning: (d.isTagLearning as boolean | undefined) ?? false,
                      });
                    }}
                  />
                </BotCardBubble>
              );
            }

            return (
              <BotBubble key={msg.id} text={msg.text} time={time} tail={tail} />
            );
          })}
        </div>
      ))}

      {/* Typing indicator */}
      {typing && <Typing />}
    </ChatScreen>

    {/* All categories sheet */}
    {categorySheet && (
      <CategorySheet
        categories={categorySheet.isIncome ? allIncomeCats : undefined}
        onSelect={(chip) => {
          if (categorySheet.isIncome) {
            handleIncomeClarifyChip(
              categorySheet.amount,
              chip,
              categorySheet.parsedDate,
              categorySheet.parsedDateLabel,
              categorySheet.parsedNote,
            );
          } else {
            handleClarifyChip(
              categorySheet.amount,
              chip,
              categorySheet.parsedDate,
              categorySheet.parsedDateLabel,
              categorySheet.parsedNote,
              categorySheet.storeId,
              categorySheet.storeName,
              categorySheet.storeGroup,
              categorySheet.isTagLearning,
            );
          }
          setCategorySheet(null);
        }}
        onClose={() => setCategorySheet(null)}
      />
    )}

    {/* Budget settings sheet */}
    {budgetSettingsOpen && (
      <BudgetSettingsSheet
        autoDaily={autoDaily}
        onClose={() => setBudgetSettingsOpen(false)}
      />
    )}
    </>
  );
}
