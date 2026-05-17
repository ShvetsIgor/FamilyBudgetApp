'use client';

import { useCallback, useRef } from 'react';
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

import { ChatScreen } from '@/features/chat/components/ChatScreen';
import { PinnedToday } from '@/features/chat/components/PinnedToday';
import { DateChip } from '@/features/chat/components/DateChip';
import { BotBubble, BotCardBubble } from '@/features/chat/components/BotBubble';
import { UserBubble } from '@/features/chat/components/UserBubble';
import { SavedCard } from '@/features/chat/components/BotCard/SavedCard';
import { ClarifyCard } from '@/features/chat/components/BotCard/ClarifyCard';
import { Typing } from '@/features/chat/components/Typing';
import type { Currency } from '@/shared/types';
import type { SerializableChatMessage } from '@/shared/types/message';

function dayLabel(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return 'Сегодня';
  if (isYesterday(d)) return 'Вчера';
  return format(d, 'd MMMM', { locale: ru });
}

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
  const userId = useAppSelector((s) => s.auth.user?.id);
  const currency = useAppSelector((s) => s.ui.currency) as Currency;
  const messages = useAppSelector((s) => s.chat.messages);
  const typing = useAppSelector((s) => s.chat.typing);
  const state = useAppSelector((s) => s);

  useChatMessages();
  const learned = useLearnedKeywords();

  // Daily budget = sum of all category limits / 30
  const monthBudget = useAppSelector((s) =>
    Object.values(s.budget.limits).reduce((acc, v) => acc + v, 0)
  );
  const dailyBudget = monthBudget > 0 ? Math.round(monthBudget / 30) : 0;
  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySpent = useAppSelector((s) =>
    s.expenses.list.filter((e) => e.date.startsWith(todayStr)).reduce((acc, e) => acc + e.amount, 0)
  );

  const sendingRef = useRef(false);

  const handleSend = useCallback(async (text: string) => {
    if (!userId || sendingRef.current) return;
    sendingRef.current = true;

    const ctx = collectBotContext(state);
    if (!ctx) { sendingRef.current = false; return; }

    const parsed = parseMessage(text, { learned });

    // 1. Optimistically add user message
    const userMsgInput = {
      userId,
      senderId: userId,
      kind: 'user' as const,
      text,
      parsed,
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    };
    const userMsg = await addMessage(userMsgInput);

    // 2. Show typing indicator
    dispatch(setTyping(true));
    await new Promise((r) => setTimeout(r, 600));

    // 3. Bot response
    try {
      const reply = await respondToUserMessage(userMsg, parsed, ctx);

      // 4. Save bot messages to Firestore
      for (const botMsg of reply.messages) {
        await addMessage(botMsg);
      }

      // 5. Patch expense into Redux if created
      if (reply.expense) {
        dispatch(prependExpense(reply.expense));
      }
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, state, learned, dispatch]);

  const handleClarifyChip = useCallback(async (
    amount: number,
    chip: { id: string; name: string; icon: string; color: string }
  ) => {
    if (!userId) return;
    // Teach bot this association for future
    await saveLearnedKeyword(userId, chip.name.toLowerCase(), { parentId: chip.id });
    // Re-send with category name
    await handleSend(`${amount} ${chip.name.toLowerCase()}`);
  }, [userId, handleSend]);

  const groups = groupByDay(messages);

  if (!userId) return null;

  return (
    <ChatScreen onSend={handleSend} disabled={typing}>
      {/* Pinned today hero */}
      <PinnedToday
        spent={todaySpent}
        total={dailyBudget}
        currency={currency}
        dayLabel="Бюджет на сегодня"
      />

      {/* Message groups */}
      {groups.map(({ day, items }, gi) => (
        <div key={day}>
          <DateChip label={dayLabel(day + 'T00:00:00')} />
          {items.map((msg, idx) => {
            const isLast = idx === items.length - 1;
            const nextSameSender = !isLast && items[idx + 1]?.kind === msg.kind;
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

            // Bot message
            if (msg.card?.kind === 'saved') {
              const d = msg.card.data;
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <SavedCard
                    icon={d.icon}
                    color={d.color}
                    title={d.title}
                    amount={d.amount}
                    currency={d.currency}
                  />
                </BotCardBubble>
              );
            }

            if (msg.card?.kind === 'clarify') {
              const d = msg.card.data;
              return (
                <BotCardBubble key={msg.id} tail={tail}>
                  <ClarifyCard
                    amount={d.amount}
                    currency={d.currency ?? '₪'}
                    chips={d.chips}
                    onSelectChip={(chip) => handleClarifyChip(d.amount, chip)}
                    onAllCategories={() => {}}
                  />
                </BotCardBubble>
              );
            }

            return (
              <BotBubble
                key={msg.id}
                text={msg.text}
                time={time}
                tail={tail}
              />
            );
          })}
        </div>
      ))}

      {/* Typing indicator */}
      {typing && <Typing />}
    </ChatScreen>
  );
}
