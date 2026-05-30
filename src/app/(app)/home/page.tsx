'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useAppSelector, useAppDispatch, useAppStore } from '@/store/store';
import { setTyping, removeMessage } from '@/features/chat/store/chatSlice';
import { removeExpense, mergeExpenses } from '@/features/expenses/store/expensesSlice';
import { prependIncome } from '@/features/income/store/incomeSlice';
import { updateRecurringItem } from '@/features/recurring/store/recurringSlice';

import { useChatMessages } from '@/features/chat/hooks/useChatMessages';
import { useLearnedKeywords } from '@/features/chat/hooks/useLearnedKeywords';
import { useStoreProfiles } from '@/features/chat/hooks/useStoreProfiles';

import { parseMessage } from '@/features/chat/parser/parse';
import { deleteExpense, fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { deleteMessage } from '@/features/chat/services/messagesService';
import { collectBotContext } from '@/features/chat/bot/context';
import { respondToUserMessage } from '@/features/chat/bot/respond';
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
import { ClarifyCard } from '@/features/chat/components/BotCard/ClarifyCard';
import { EnvelopesCard } from '@/features/chat/components/BotCard/EnvelopesCard';
import { Typing } from '@/features/chat/components/Typing';
import { useT } from '@/shared/hooks/useT';
import type { EnvelopesCardData } from '@/features/chat/components/BotCard/EnvelopesCard';
import type { Currency } from '@/shared/types';
import { toLocalDateKey, toLocalMonthKey } from '@/shared/utils/dateKey';

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
  const appStore = useAppStore();
  const router = useRouter();
  const t = useT();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const currency = useAppSelector((s) => s.ui.currency) as Currency;
  const messages = useAppSelector((s) => s.chat.messages);
  const typing = useAppSelector((s) => s.chat.typing);
  const language = useAppSelector((s) => s.ui.language);

  const dateFnsLocale = language === 'ru' ? ru : undefined;

  function dayLabel(iso: string): string {
    const d = parseISO(iso);
    if (isToday(d)) return t('common.today');
    if (isYesterday(d)) return t('common.yesterday');
    return format(d, 'd MMMM', { locale: dateFnsLocale });
  }

  useChatMessages();
  const [learned] = useLearnedKeywords();
  useStoreProfiles();

  const budgetMode = useAppSelector((s) => s.ui.budgetMode);
  const budgetDailyLimit = useAppSelector((s) => s.ui.budgetDailyLimit);
  const budgetMonthlyLimit = useAppSelector((s) => s.ui.budgetMonthlyLimit);
  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const monthBudget = useAppSelector((s) =>
    Object.values(s.budget.limits).reduce((acc, v) => acc + v, 0)
  );

  const now = new Date();
  const todayStr = toLocalDateKey(now);
  const monthStr = toLocalMonthKey(now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;

  const todaySpent = useAppSelector((s) =>
    s.expenses.list
      .filter((e) => toLocalDateKey(e.date) === todayStr)
      .reduce((acc, e) => acc + e.amount, 0)
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
  const allIncomeCats = useAppSelector((s) => s.categories.income);
  const savingsGoals = useAppSelector((s) => s.savings.list);
  const [budgetSettingsOpen, setBudgetSettingsOpen] = useState(false);

  // Load current month expenses on home mount so todaySpent is accurate
  useEffect(() => {
    if (!userId) return;
    fetchMonthExpenses(userId, toLocalMonthKey(new Date()))
      .then((list) => dispatch(mergeExpenses(list)))
      .catch(() => {});
  }, [userId, dispatch]);

  // Auto-send morning greeting / weekly summary on first daily mount
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (!userId || autoSentRef.current) return;
    autoSentRef.current = true;

    const ctx = collectBotContext(appStore.getState());
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

  type IncomeClarifyContext = {
    amount: number;
    parsedDate?: string;
    parsedDateLabel?: string;
    parsedNote?: string;
  };
  const [incomeCategorySheet, setIncomeCategorySheet] = useState<IncomeClarifyContext | null>(null);

  const buildEnrichedCtx = useCallback(() => {
    const ctx = collectBotContext(appStore.getState());
    if (!ctx) return null;
    return {
      ...ctx,
      allExpenses,
      monthBudget,
      budgetLimits,
      dailyBudget,
      firstGoalName: savingsGoals.find((g) => !g.name?.toLowerCase().includes('savings'))?.name,
    };
  }, [appStore, allExpenses, monthBudget, budgetLimits, dailyBudget, savingsGoals]);

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
      if (reply.income) dispatch(prependIncome(reply.income));

      // Expense path: always navigate to Split — no clarify cards, no auto-save in chat.
      if (reply.openSplit) {
        const params = new URLSearchParams({
          fromChat: 'true',
          amount: String(reply.openSplit.amount),
          userMsgId: reply.openSplit.userMsgId,
        });
        if (reply.openSplit.storeId) params.set('storeId', reply.openSplit.storeId);
        if (reply.openSplit.storeName) params.set('storeName', reply.openSplit.storeName);
        if (reply.openSplit.storeGroup) params.set('storeGroup', reply.openSplit.storeGroup);
        if (reply.openSplit.date) params.set('date', reply.openSplit.date);
        router.push(`/expenses/new?${params.toString()}`);
      }
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, learned, dispatch, router]);

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
      await deleteMessage(userId, botMsgId);
      await deleteMessage(userId, userMsgId);
      if (expense) {
        const restored = await deleteExpense(userId, expense);
        if (restored) dispatch(updateRecurringItem(restored));
      }
    } catch { /* ignore */ }
  }, [userId, allExpenses, dispatch]);

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

            if (msg.card?.kind === 'clarify') {
              const d = msg.card.data as Record<string, unknown>;
              const cardIsIncome = !!(d.isIncome as boolean | undefined);
              // Clarify cards are kept only for income.
              if (!cardIsIncome) return null;
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <ClarifyCard
                    amount={d.amount as number}
                    currency={(d.currency as string | undefined) ?? '₪'}
                    chips={d.chips as { id: string; name: string; icon: string; color: string }[]}
                    unknownNote={d.parsedNote as string | undefined}
                    categories={allIncomeCats}
                    onSelectChip={(chip) =>
                      handleIncomeClarifyChip(
                        d.amount as number,
                        chip,
                        d.parsedDate as string | undefined,
                        d.parsedDateLabel as string | undefined,
                        d.parsedNote as string | undefined,
                      )
                    }
                    onAllCategories={() => setIncomeCategorySheet({
                      amount: d.amount as number,
                      parsedDate: d.parsedDate as string | undefined,
                      parsedDateLabel: d.parsedDateLabel as string | undefined,
                      parsedNote: d.parsedNote as string | undefined,
                    })}
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

    {/* Income categories sheet */}
    {incomeCategorySheet && (
      <CategorySheet
        categories={allIncomeCats}
        onSelect={(chip) => {
          handleIncomeClarifyChip(
            incomeCategorySheet.amount,
            chip,
            incomeCategorySheet.parsedDate,
            incomeCategorySheet.parsedDateLabel,
            incomeCategorySheet.parsedNote,
          );
          setIncomeCategorySheet(null);
        }}
        onClose={() => setIncomeCategorySheet(null)}
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

