import { subDays } from 'date-fns';
import { store } from '@/store/store';
import { addNotification } from '@/features/notifications/store/notificationsSlice';
import { getPresetDisplayName } from '@/features/categories/config/categoryLabels';
import type { DigestContext } from './context';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import { makeT } from '@/shared/utils/makeT';
import type { MorningCardData } from '@/features/chat/components/BotCard/MorningCard';

const STORAGE_KEY = 'chat_lastMorningAt';

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shouldSendMorningGreeting(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== todayDateStr();
  } catch {
    return false;
  }
}

export function markMorningGreetingSent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, todayDateStr());
  } catch {}
}

/** Pure so the arithmetic can be pinned without a store or a clock. */
export function buildMorningCard(ctx: DigestContext, now: Date): MorningCardData {
  const bt = makeT(ctx.language);
  const { currency, categoriesById, language, dailyBudget, todayFree } = ctx;

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  // subDays, not «now − 24 h»: a day is 23 hours long when the clocks go forward
  const yesterdayStr = toLocalDateKey(subDays(now, 1));
  const yesterdayExpenses = ctx.allExpenses.filter((e) => toLocalDateKey(e.date) === yesterdayStr);
  const yesterdayAmount = yesterdayExpenses.reduce((s, e) => s + e.amount, 0);

  const catFreq: Record<string, number> = {};
  yesterdayExpenses.forEach((e) => {
    const cat = categoriesById.get(e.categoryId);
    const displayName = getPresetDisplayName(e.categoryId, language) ?? cat?.name ?? bt.cat('Other');
    const name = displayName.toLowerCase();
    if (name) catFreq[name] = (catFreq[name] ?? 0) + 1;
  });
  const topCatNames = Object.entries(catFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([n]) => n)
    .join(bt('chat.bot.andJoiner'));

  return {
    yesterdayAmount,
    yesterdayCatNames: topCatNames,
    todayFree,
    currency: sym,
    hasBudget: dailyBudget > 0,
  };
}

export async function sendMorningGreeting(ctx: DigestContext, now: Date = new Date()): Promise<void> {
  const bt = makeT(ctx.language);
  const cardData = buildMorningCard(ctx, now);
  const { yesterdayAmount, todayFree, currency: sym } = cardData;

  store.dispatch(addNotification({
    kind: 'morning',
    title: bt('chat.bot.morningTitle'),
    text: yesterdayAmount > 0
      ? bt('chat.bot.morningYesterday', { sym, amount: yesterdayAmount.toLocaleString(), free: todayFree.toLocaleString() })
      : bt('chat.bot.morningFree', { sym, free: todayFree.toLocaleString() }),
    data: cardData,
    createdAt: new Date().toISOString(),
  }));
}
