'use client';

import { useCallback, useRef, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';

import { useAppSelector, useAppDispatch, useAppStore } from '@/store/store';
import { setTyping, removeMessage } from '@/features/chat/store/chatSlice';
import { removeExpense, mergeExpenses, prependExpense } from '@/features/expenses/store/expensesSlice';
import { prependIncome } from '@/features/income/store/incomeSlice';
import { updateRecurringItem } from '@/features/recurring/store/recurringSlice';
import { addNotification } from '@/features/notifications/store/notificationsSlice';

import { useChatMessages } from '@/features/chat/hooks/useChatMessages';
import { useLearnedKeywords } from '@/features/chat/hooks/useLearnedKeywords';

import { parseMessage } from '@/features/chat/parser/parse';
import { deleteExpense, fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { deleteMessage } from '@/features/chat/services/messagesService';
import { collectBotContext } from '@/features/chat/bot/context';
import { respondToUserMessage, saveErrorPhrase } from '@/features/chat/bot/respond';
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
import { CategoryFolderPickerSheet } from '@/features/categories/components/CategoryFolderPickerSheet';
import { CategoryEditorSheet } from '@/features/categories/components/CategoryEditorSheet';
import { FolderEditorSheet } from '@/features/categories/components/FolderEditorSheet';
import { addCategory as addCategoryToDb } from '@/features/categories/services/categoriesService';
import { addFolder as addFolderToDb } from '@/features/categories/services/categoryFoldersService';
import { addFolder as addFolderAction } from '@/features/categories/store/categoriesSlice';
import { normalizeNameKey } from '@/shared/utils/normalizeName';
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
import { getCurrencySymbol } from '@/shared/utils/currency';
import { toLocalDateKey, toLocalMonthKey } from '@/shared/utils/dateKey';
import { splitOwnCurrency } from '@/shared/utils/currencyTotals';
import { monthlyEquivalent } from '@/features/recurring/utils/schedule';
import { groupByCurrency, formatCurrencyTotals } from '@/features/family/utils/familyCurrency';

import type { SerializableChatMessage } from '@/shared/types/message';
import type { ParseResult } from '@/shared/types/message';
import { addCategoryWithId } from '@/features/categories/services/categoriesService';
import { addCategory as addCategoryAction } from '@/features/categories/store/categoriesSlice';
import { recordExpense } from '@/features/expenses/store/suggestionMemorySlice';

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

  const dateFnsLocale = getDateFnsLocale(language);

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
  const todayStr = toLocalDateKey(now);
  const monthStr = toLocalMonthKey(now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - now.getDate() + 1;

  const todaySpent = useAppSelector((s) =>
    splitOwnCurrency(
      s.expenses.list.filter((e) => toLocalDateKey(e.date) === todayStr),
      currency,
    ).ownTotal
  );
  // Budget arithmetic only works inside one currency: a $12 charge is not ₪12,
  // and there is no FX source. Foreign amounts are shown elsewhere, never folded
  // into the allowance.
  const monthSpent = useAppSelector((s) =>
    splitOwnCurrency(s.expenses.list.filter((e) => toLocalMonthKey(e.date) === monthStr), currency).ownTotal
  );
  const monthIncome = useAppSelector((s) =>
    splitOwnCurrency(s.income.list.filter((i) => toLocalMonthKey(i.date) === monthStr), currency).ownTotal
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

  // PinnedToday display values
  // daily mode tracks today vs the daily limit;
  // monthly/auto track the month, so spent and total must both be month-scale
  // (auto's effective month budget is monthIncome — same as /budget page)
  const displaySpent = budgetMode === 'daily' ? todaySpent : monthSpent;
  const displayTotal = budgetMode === 'daily' ? dailyBudget
    : budgetMode === 'monthly' ? budgetMonthlyLimit
    : monthIncome;
  const displayLabel = budgetMode === 'daily' ? t('chat.today.budgetLabel') : t('chat.today.monthLabel');

  // Budget threshold alerts (85% / 100%) → bell, once per month per threshold
  useEffect(() => {
    if (!userId) return;
    const effectiveMonthBudget = budgetMode === 'monthly' ? budgetMonthlyLimit
      : budgetMode === 'auto' ? monthIncome
      : 0;
    if (effectiveMonthBudget <= 0) return;
    const pct = (monthSpent / effectiveMonthBudget) * 100;
    const threshold = pct >= 100 ? 100 : pct >= 85 ? 85 : 0;
    if (threshold === 0) return;
    const key = `budget_alert_${userId}_${format(new Date(), 'yyyy-MM')}`;
    try {
      const prev = Number(localStorage.getItem(key) ?? 0);
      if (threshold <= prev) return;
      localStorage.setItem(key, String(threshold));
    } catch { return; }
    dispatch(addNotification({
      kind: 'alert',
      title: t('notifications.budgetTitle'),
      text: threshold >= 100 ? t('notifications.budget100') : t('notifications.budget85'),
      createdAt: new Date().toISOString(),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, monthSpent, monthIncome, budgetMode, budgetMonthlyLimit]);

  // Monthly subscription review → bell, once per calendar month.
  // Pull-based on launch (free plan, no server pushes), same as budget alerts.
  const recurringList = useAppSelector((s) => s.recurring.list);
  useEffect(() => {
    if (!userId) return;
    const subs = recurringList.filter((r) => r.isActive && r.type === 'subscription');
    if (subs.length < 2) return;
    const key = `subs_review_${userId}_${format(new Date(), 'yyyy-MM')}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch { return; }
    const sum = formatCurrencyTotals(
      groupByCurrency(subs.map((r) => ({ amount: monthlyEquivalent(r.amount, r.frequency), currency: r.currency }))),
      { fallback: currency },
    );
    dispatch(addNotification({
      kind: 'subscriptions',
      title: t('notifications.subsReviewTitle'),
      text: t('notifications.subsReviewText', { n: subs.length, sum }),
      createdAt: new Date().toISOString(),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, recurringList]);

  const allExpenses = useAppSelector((s) => s.expenses.list);
  const ownCurrencyExpenses = useMemo(
    () => allExpenses.filter((expense) => expense.currency === currency),
    [allExpenses, currency],
  );
  const expenseCats = useAppSelector((s) => s.categories.expense);
  // A selector that filters returns a fresh array on every store action and
  // would re-render the whole chat screen; the filter belongs in a memo.
  const allExpenseCats = useMemo(
    () => expenseCats.filter((category) => !category.archived),
    [expenseCats],
  );
  const allIncomeCats = useAppSelector((s) => s.categories.income);
  const expenseFolders = useAppSelector((s) => s.categories.folders.expense);
  const incomeFolders = useAppSelector((s) => s.categories.folders.income);
  const savingsGoals = useAppSelector((s) => s.savings.list);

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
    const yesterdayExpenses = ownCurrencyExpenses.filter((e) => toLocalDateKey(e.date) === yesterdayStr);
    const firstGoalName = savingsGoals.find((g) => !g.name?.toLowerCase().includes('savings'))?.name;

    const enrichedCtx = {
      ...ctx,
      yesterdayExpenses,
      dailyBudget,
      monthBudget,
      budgetLimits,
      allExpenses: ownCurrencyExpenses,
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
  type ExpenseClarifyContext = {
    botMsgId: string;
    userMsgId: string;
    amount: number;
    storeId?: string;
    storeName?: string;
    storeGroup?: string;
    parsedDate?: string;
    parsedDateLabel?: string;
    parsedNote?: string;
  };
  const [incomeCategorySheet, setIncomeCategorySheet] = useState<IncomeClarifyContext | null>(null);
  const [expenseCategorySheet, setExpenseCategorySheet] = useState<ExpenseClarifyContext | null>(null);
  // Inline creation from the clarify picker: without it a merchant whose
  // category does not exist yet is a dead end — the sheet used to offer
  // search over what already existed and nothing else.
  const [clarifyCatEditor, setClarifyCatEditor] = useState<{ type: 'expense' | 'income'; folderId: string | null } | null>(null);
  const [clarifyFolderEditor, setClarifyFolderEditor] = useState<'expense' | 'income' | null>(null);
  const [clarifyCreating, setClarifyCreating] = useState(false);

  const buildEnrichedCtx = useCallback(() => {
    const ctx = collectBotContext(appStore.getState());
    if (!ctx) return null;
    return {
      ...ctx,
      allExpenses: ownCurrencyExpenses,
      monthBudget,
      budgetLimits,
      dailyBudget,
      firstGoalName: savingsGoals.find((g) => !g.name?.toLowerCase().includes('savings'))?.name,
    };
  }, [appStore, ownCurrencyExpenses, monthBudget, budgetLimits, dailyBudget, savingsGoals]);

  const failureText = useMemo(() => saveErrorPhrase(language), [language]);

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

      // Explicit Split requests can still be forwarded by specialized bot flows.
      // Normal merchant + amount input now stays in chat for user classification.
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
    } catch (err) {
      // A rejected write used to fall straight through `finally`: the typing
      // dots cleared and nothing else happened — the message sat «pending»
      // with no reply and no error, and retyping it could duplicate an expense
      // that had in fact been saved. `failureText` is read before the try: the
      // React Compiler cannot compile a selector read inside a catch block.
      console.error('chat send failed', err);
      void addMessage({ userId, senderId: 'bot', kind: 'bot', status: 'saved', text: failureText });
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, learned, dispatch, router, failureText]);

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
    } catch (err) {
      // A rejected write used to fall straight through `finally`: the typing
      // dots cleared and nothing else happened — the message sat «pending»
      // with no reply and no error, and retyping it could duplicate an expense
      // that had in fact been saved. `failureText` is read before the try: the
      // React Compiler cannot compile a selector read inside a catch block.
      console.error('chat send failed', err);
      void addMessage({ userId, senderId: 'bot', kind: 'bot', status: 'saved', text: failureText });
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, buildEnrichedCtx, dispatch, failureText]);

  // The deps below are complete; the compiler bails on this one handler once
  // its catch block captures the language, and it is not enabled for the build
  // (no `experimental.reactCompiler` in next.config.mjs), so this useCallback
  // is what actually keeps the identity stable for the clarify cards.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleExpenseClarifyChip = useCallback(async (
    context: ExpenseClarifyContext,
    chip: { id: string; name: string; icon: string; color: string },
  ) => {
    if (!userId || sendingRef.current) return;
    const originalMessage = messages.find((message) => message.id === context.userMsgId);
    if (!originalMessage) return;
    sendingRef.current = true;
    dispatch(setTyping(true));
    // Resolved before the try: the React Compiler cannot compile a call to an
    // imported function inside a catch block without losing this useCallback.
    const failureText = saveErrorPhrase(language);
    try {
      const enrichedCtx = buildEnrichedCtx();
      if (!enrichedCtx) return;
      const parsed: ParseResult = {
        amount: context.amount,
        categoryId: chip.id,
        confidence: 'high',
        confirmed: true,
        storeId: context.storeId,
        storeName: context.storeName,
        storeGroup: context.storeGroup,
        date: context.parsedDate,
        dateLabel: context.parsedDateLabel,
        note: context.parsedNote,
      };
      const reply = await respondToUserMessage(originalMessage, parsed, enrichedCtx);
      for (const botMsg of reply.messages) await addMessage(botMsg);
      if (reply.expense) {
        dispatch(prependExpense(reply.expense));
        dispatch(recordExpense({
          merchant: context.storeName,
          categoryId: chip.id,
          folderId: appStore.getState().categories.expense.find((category) => category.id === chip.id)?.folderId ?? undefined,
          date: context.parsedDate ?? toLocalDateKey(new Date()),
        }));
        dispatch(removeMessage(context.botMsgId));
        await deleteMessage(userId, context.botMsgId).catch(() => {});
        setExpenseCategorySheet(null);
      }
    } catch (err) {
      // A rejected write used to fall straight through `finally`: the typing
      // dots cleared and nothing else happened — the message sat «pending»
      // with no reply and no error, and retyping it could duplicate an expense
      // that had in fact been saved. `failureText` is read before the try: the
      // React Compiler cannot compile a selector read inside a catch block.
      console.error('chat send failed', err);
      void addMessage({ userId, senderId: 'bot', kind: 'bot', status: 'saved', text: failureText });
    } finally {
      dispatch(setTyping(false));
      sendingRef.current = false;
    }
  }, [userId, messages, buildEnrichedCtx, dispatch, appStore, language]);

  const handleDeferExpense = useCallback(async (context: ExpenseClarifyContext) => {
    if (!userId) return;
    let category = appStore.getState().categories.expense.find((item) => item.id === 'unsorted' && !item.archived);
    if (!category) {
      category = await addCategoryWithId(userId, 'unsorted', {
        name: 'Unsorted',
        icon: 'box',
        color: '#475569',
        isPrivate: false,
        order: 999,
        type: 'expense',
      });
      dispatch(addCategoryAction(category));
    }
    await handleExpenseClarifyChip(context, {
      id: category.id,
      name: category.name,
      icon: category.icon,
      color: category.color,
    });
  }, [userId, appStore, dispatch, handleExpenseClarifyChip]);

  const handleOpenExpenseSplit = useCallback((context: ExpenseClarifyContext) => {
    if (!userId) return;
    dispatch(removeMessage(context.botMsgId));
    deleteMessage(userId, context.botMsgId).catch(() => {});
    const params = new URLSearchParams({
      fromChat: 'true',
      mode: 'split',
      amount: String(context.amount),
      userMsgId: context.userMsgId,
    });
    if (context.storeId) params.set('storeId', context.storeId);
    if (context.storeName) params.set('storeName', context.storeName);
    if (context.storeGroup) params.set('storeGroup', context.storeGroup);
    if (context.parsedDate) params.set('date', context.parsedDate);
    router.push(`/expenses/new?${params.toString()}`);
  }, [userId, dispatch, router]);

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
        dailyHint={budgetMode === 'daily' ? undefined : dailyBudget}
        onSettings={() => router.push('/budget')}
      />

      {/* Empty chat — a first-run user needs to know what to type here */}
      {groups.length === 0 && !typing && (
        <div className="flex flex-col items-center gap-3 px-8 py-14 text-center">
          <p className="text-4xl">💬</p>
          <p className="text-[15px] font-bold">{t('chat.emptyTitle')}</p>
          <p className="text-sm text-muted-foreground">{t('chat.emptyHint')}</p>
          <button
            type="button"
            onClick={() => handleSend(t('chat.emptyExample'))}
            className="mt-1 min-h-11 rounded-xl bg-primary/10 px-4 text-sm font-bold text-primary hover:bg-primary/15 transition-colors"
          >
            {t('chat.emptyExample')}
          </button>
        </div>
      )}

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
                        className="text-[11.5px] font-bold active:opacity-50 transition-opacity"
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
              if (!cardIsIncome) {
                const context: ExpenseClarifyContext = {
                  botMsgId: msg.id,
                  userMsgId: d.userMsgId as string,
                  amount: d.amount as number,
                  storeId: d.storeId as string | undefined,
                  storeName: d.storeName as string | undefined,
                  storeGroup: d.storeGroup as string | undefined,
                  parsedDate: d.parsedDate as string | undefined,
                  parsedDateLabel: d.parsedDateLabel as string | undefined,
                  parsedNote: d.parsedNote as string | undefined,
                };
                return (
                  <BotCardBubble key={msg.id} tail={tail}>
                    <ClarifyCard
                      amount={context.amount}
                      currency={(d.currency as string | undefined) ?? getCurrencySymbol(currency)}
                      chips={d.chips as { id: string; name: string; icon: string; color: string }[]}
                      unknownNote={context.parsedNote}
                      storeName={context.storeName}
                      isRepeat={Boolean(d.isRepeat)}
                      suggestSplit={Boolean(d.suggestSplit)}
                      categories={allExpenseCats}
                      onSelectChip={(chip) => handleExpenseClarifyChip(context, chip)}
                      onAllCategories={() => setExpenseCategorySheet(context)}
                      onSplit={() => handleOpenExpenseSplit(context)}
                      onDefer={() => handleDeferExpense(context)}
                    />
                  </BotCardBubble>
                );
              }
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

    {/* Income categories — the canonical folder-first picker, same as entry forms */}
    <CategoryFolderPickerSheet
      open={!!incomeCategorySheet && !clarifyCatEditor && !clarifyFolderEditor}
      onClose={() => setIncomeCategorySheet(null)}
      title={t('categories.selectCategory')}
      mode="single"
      folders={incomeFolders}
      categories={allIncomeCats.filter((category) => !category.archived)}
      onSelectCategory={(category) => {
        if (!incomeCategorySheet) return;
        handleIncomeClarifyChip(
          incomeCategorySheet.amount,
          { id: category.id, name: category.name, icon: category.icon, color: category.color },
          incomeCategorySheet.parsedDate,
          incomeCategorySheet.parsedDateLabel,
          incomeCategorySheet.parsedNote,
        );
        setIncomeCategorySheet(null);
      }}
      onCreateCategory={(folderId) => setClarifyCatEditor({ type: 'income', folderId })}
      onCreateFolder={() => setClarifyFolderEditor('income')}
    />

    <CategoryFolderPickerSheet
      open={!!expenseCategorySheet && !clarifyCatEditor && !clarifyFolderEditor}
      onClose={() => setExpenseCategorySheet(null)}
      title={t('categories.selectCategory')}
      mode="single"
      merchantLabel={expenseCategorySheet?.storeName}
      folders={expenseFolders}
      categories={allExpenseCats}
      onSelectCategory={(category) => {
        if (!expenseCategorySheet) return;
        handleExpenseClarifyChip(expenseCategorySheet, {
          id: category.id, name: category.name, icon: category.icon, color: category.color,
        });
      }}
      onCreateCategory={(folderId) => setClarifyCatEditor({ type: 'expense', folderId })}
      onCreateFolder={() => setClarifyFolderEditor('expense')}
    />

    {/* Create a category without leaving the clarify flow, then use it right away */}
    <CategoryEditorSheet
      open={!!clarifyCatEditor}
      onClose={() => setClarifyCatEditor(null)}
      type={clarifyCatEditor?.type ?? 'expense'}
      folderId={clarifyCatEditor?.folderId ?? undefined}
      initial={{ folderId: clarifyCatEditor?.folderId ?? undefined }}
      availableFolders={clarifyCatEditor?.type === 'income' ? incomeFolders : expenseFolders}
      onSave={async (catData) => {
        const name = catData.name?.trim();
        if (!name || !userId || !clarifyCatEditor || clarifyCreating) return;
        setClarifyCreating(true);
        try {
          const type = clarifyCatEditor.type;
          const folderId = catData.folderId ?? clarifyCatEditor.folderId ?? undefined;
          const folder = (type === 'income' ? incomeFolders : expenseFolders).find((f) => f.id === folderId);
          const created = await addCategoryToDb(userId, {
            name,
            icon: catData.icon ?? 'box',
            color: catData.color ?? folder?.color ?? '#94A3B8',
            folderId,
            extraFolderIds: catData.extraFolderIds?.filter((id) => id !== folderId) ?? [],
            isPrivate: catData.isPrivate ?? false,
            order: 99,
            type,
            ...(catData.tags ? { tags: catData.tags } : {}),
          });
          dispatch(addCategoryAction(created));
          setClarifyCatEditor(null);
          const chip = { id: created.id, name: created.name, icon: created.icon, color: created.color };
          if (type === 'income') {
            if (!incomeCategorySheet) return;
            handleIncomeClarifyChip(
              incomeCategorySheet.amount, chip,
              incomeCategorySheet.parsedDate, incomeCategorySheet.parsedDateLabel, incomeCategorySheet.parsedNote,
            );
            setIncomeCategorySheet(null);
          } else {
            if (!expenseCategorySheet) return;
            await handleExpenseClarifyChip(expenseCategorySheet, chip);
          }
        } finally {
          setClarifyCreating(false);
        }
      }}
    />

    {/* A brand-new folder opens category creation inside it, so the flow never
        dead-ends on an empty folder */}
    <FolderEditorSheet
      open={!!clarifyFolderEditor}
      onClose={() => setClarifyFolderEditor(null)}
      type={clarifyFolderEditor ?? 'expense'}
      onSave={async (data) => {
        if (!userId || !clarifyFolderEditor) return;
        const { id: _id, ...rest } = data;
        const type = clarifyFolderEditor;
        const existing = type === 'income' ? incomeFolders : expenseFolders;
        // Reuse a folder of the same name instead of creating a duplicate
        const duplicate = existing.find((f) => normalizeNameKey(f.name) === normalizeNameKey(rest.name));
        let folderId: string;
        if (duplicate) {
          folderId = duplicate.id;
        } else {
          const created = await addFolderToDb(userId, rest);
          dispatch(addFolderAction(created));
          folderId = created.id;
        }
        setClarifyFolderEditor(null);
        const pool = type === 'income' ? allIncomeCats : allExpenseCats;
        const hasCategories = pool.some(
          (c) => !c.archived && (c.folderId === folderId || c.extraFolderIds?.includes(folderId)),
        );
        if (!hasCategories) setClarifyCatEditor({ type, folderId });
      }}
    />

</>
  );
}
