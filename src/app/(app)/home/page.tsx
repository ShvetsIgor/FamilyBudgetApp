'use client';

import { useCallback, useRef, useEffect } from 'react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useAppSelector, useAppDispatch } from '@/store/store';
import { setTyping } from '@/features/chat/store/chatSlice';
import { prependExpense } from '@/features/expenses/store/expensesSlice';

import { useChatMessages } from '@/features/chat/hooks/useChatMessages';
import { useLearnedKeywords } from '@/features/chat/hooks/useLearnedKeywords';

import { parseMessage } from '@/features/chat/parser/parse';
import { saveLearnedKeyword } from '@/features/chat/parser/learning';
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
import { PinnedToday } from '@/features/chat/components/PinnedToday';
import { DateChip } from '@/features/chat/components/DateChip';
import { BotBubble, BotCardBubble } from '@/features/chat/components/BotBubble';
import { UserBubble } from '@/features/chat/components/UserBubble';
import { SavedCard } from '@/features/chat/components/BotCard/SavedCard';
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

  // Daily budget = sum of all category limits / 30
  const monthBudget = useAppSelector((s) =>
    Object.values(s.budget.limits).reduce((acc, v) => acc + v, 0)
  );
  const budgetLimits = useAppSelector((s) => s.budget.limits);
  const dailyBudget = monthBudget > 0 ? Math.round(monthBudget / 30) : 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySpent = useAppSelector((s) =>
    s.expenses.list.filter((e) => e.date.startsWith(todayStr)).reduce((acc, e) => acc + e.amount, 0)
  );
  const allExpenses = useAppSelector((s) => s.expenses.list);
  const savingsGoals = useAppSelector((s) => s.savings.list);

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

  const groups = groupByDay(messages);

  if (!userId) return null;

  return (
    <ChatScreen onSend={handleSend} disabled={typing}>
      {/* Pinned today hero */}
      <PinnedToday
        spent={todaySpent}
        total={dailyBudget}
        currency={currency}
        dayLabel={t('chat.today.budgetLabel')}
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

            if (msg.card?.kind === 'morning') {
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <MorningCard data={msg.card.data as MorningCardData} />
                </BotCardBubble>
              );
            }

            if (msg.card?.kind === 'weekly') {
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <WeeklyCard data={msg.card.data as WeeklyCardData} />
                </BotCardBubble>
              );
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
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <SavedCard
                    icon={d.icon as string}
                    color={d.color as string}
                    title={translatedTitle}
                    hint={d.hint as string | undefined}
                    amount={d.amount as number}
                    currency={d.currency as string}
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
                    onSelectChip={(chip) => handleClarifyChip(
                      d.amount as number,
                      chip,
                      d.parsedDate as string | undefined,
                      d.parsedDateLabel as string | undefined,
                      d.parsedNote as string | undefined,
                    )}
                    onAllCategories={() => {}}
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
  );
}
