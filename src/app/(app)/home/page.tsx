'use client';

import { useCallback, useRef, useEffect, useState } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useAppSelector, useAppDispatch } from '@/store/store';
import { setTyping, removeMessage } from '@/features/chat/store/chatSlice';
import { prependExpense, removeExpense, mergeExpenses } from '@/features/expenses/store/expensesSlice';

import { useChatMessages } from '@/features/chat/hooks/useChatMessages';
import { useLearnedKeywords } from '@/features/chat/hooks/useLearnedKeywords';

import { parseMessage } from '@/features/chat/parser/parse';
import { saveLearnedKeyword } from '@/features/chat/parser/learning';
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
import type { SerializableChatMessage } from '@/shared/types/message';

function msgTime(iso: string): string {
  return format(parseISO(iso), 'HH:mm');
}

function groupByDay(messages: SerializableChatMessage[]): { day: string; items: SerializableChatMessage[] }[] {
  const map = new Map<string, SerializableChatMessage[]>();
  for (const m of messages) {
    const key = m.createdAt.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

export default function HomePage() {
  const dispatch = useAppDispatch();
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
  const learned = useLearnedKeywords();

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

  const allExpenses = useAppSelector((s) => s.expenses.list);
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

    const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
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

  type ClarifyContext = { amount: number; parsedDate?: string; parsedDateLabel?: string; parsedNote?: string };
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
        await new Promise((r) => setTimeout(r, 400));
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

      await new Promise((r) => setTimeout(r, 600));

      const reply = await respondToUserMessage(userMsg, parsed, enrichedCtx);
      for (const botMsg of reply.messages) {
        await addMessage(botMsg);
      }
      if (reply.expense) {
        dispatch(prependExpense(reply.expense));
      }
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, learned, dispatch]);

  const handleClarifyChip = useCallback(async (
    amount: number,
    chip: { id: string; name: string; icon: string; color: string },
    parsedDate?: string,
    parsedDateLabel?: string,
    parsedNote?: string,
  ) => {
    if (!userId || sendingRef.current) return;
    sendingRef.current = true;

    // Teach bot the unknown word → category mapping (not the chip name)
    const keyword = parsedNote?.trim() || chip.name.toLowerCase();
    await saveLearnedKeyword(userId, keyword.toLowerCase(), { parentId: chip.id });

    dispatch(setTyping(true));
    try {
      const enrichedCtx = buildEnrichedCtx();
      if (!enrichedCtx) return;

      // Add visible user message
      const userMsg = await addMessage({
        userId,
        senderId: userId,
        kind: 'user',
        text: `${amount} ${chip.name.toLowerCase()}${parsedDateLabel ? ` · ${parsedDateLabel}` : ''}`,
        status: 'saved',
      });

      await new Promise((r) => setTimeout(r, 400));

      // Bypass re-parse — we already know the category and date
      const parsed: import('@/shared/types/message').ParseResult = {
        amount,
        categoryId: chip.id,
        parentId: chip.id,
        confidence: 'high',
        date: parsedDate,
        dateLabel: parsedDateLabel,
        note: parsedNote,
      };

      const reply = await respondToUserMessage(userMsg, parsed, enrichedCtx);
      for (const botMsg of reply.messages) {
        await addMessage(botMsg);
      }
      if (reply.expense) {
        dispatch(prependExpense(reply.expense));
      }
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
      }
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, dispatch]);

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
    <ChatScreen onSend={handleSend} disabled={typing}>
      {/* Pinned today hero */}
      <PinnedToday
        spent={todaySpent}
        total={dailyBudget}
        currency={currency}
        dayLabel={t('chat.today.budgetLabel')}
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
              const parentName = d.parentName as string | null | undefined;
              const catName = d.catName as string | null | undefined;
              const translatedTitle = parentName && catName && catName !== parentName
                ? `${t.cat(parentName)} · ${t.cat(catName)}`
                : parentName ? t.cat(parentName) : catName ? t.cat(catName) : (d.title as string);
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
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <ClarifyCard
                    amount={d.amount as number}
                    currency={(d.currency as string | undefined) ?? '₪'}
                    chips={d.chips as { id: string; name: string; icon: string; color: string }[]}
                    unknownNote={d.parsedNote as string | undefined}
                    onSelectChip={(chip) => handleClarifyChip(
                      d.amount as number,
                      chip,
                      d.parsedDate as string | undefined,
                      d.parsedDateLabel as string | undefined,
                      d.parsedNote as string | undefined,
                    )}
                    onAllCategories={() => setCategorySheet({
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

    {/* All categories sheet */}
    {categorySheet && (
      <CategorySheet
        onSelect={(chip) => {
          handleClarifyChip(
            categorySheet.amount,
            chip,
            categorySheet.parsedDate,
            categorySheet.parsedDateLabel,
            categorySheet.parsedNote,
          );
          setCategorySheet(null);
        }}
        onClose={() => setCategorySheet(null)}
      />
    )}
    </>
  );
}
