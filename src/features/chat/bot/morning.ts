import { addMessage } from '@/features/chat/services/messagesService';
import type { BotContext } from './context';
import type { MorningCardData } from '@/features/chat/components/BotCard/MorningCard';

const STORAGE_KEY = 'chat_lastMorningAt';

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shouldSendMorningGreeting(): boolean {
  try {
    const last = localStorage.getItem(STORAGE_KEY);
    return last !== todayDateStr();
  } catch {
    return false;
  }
}

export function markMorningGreetingSent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, todayDateStr());
  } catch {
    // ignore
  }
}

export async function sendMorningGreeting(ctx: BotContext): Promise<void> {
  const { userId, currency, categoriesById, todaySpent } = ctx;

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  // Yesterday's expenses — passed via ctx.yesterdayExpenses if available
  const yesterdayExpenses = (ctx as any).yesterdayExpenses as Array<{ amount: number; categoryId: string }> ?? [];
  const yesterdayAmount = yesterdayExpenses.reduce((s: number, e: { amount: number }) => s + e.amount, 0);

  // Top 2 category names for yesterday
  const catFreq: Record<string, number> = {};
  yesterdayExpenses.forEach((e: { categoryId: string }) => {
    const cat = categoriesById.get(e.categoryId);
    const parentId = cat?.parentId ?? e.categoryId;
    const parent = categoriesById.get(parentId);
    const name = (parent?.name ?? cat?.name ?? '').toLowerCase();
    if (name) catFreq[name] = (catFreq[name] ?? 0) + 1;
  });
  const topCatNames = Object.entries(catFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([n]) => n);
  const yesterdayCatNames = topCatNames.join(' и ');

  // Daily budget = todayFree from ctx
  const dailyBudget = (ctx as any).dailyBudget as number ?? 0;
  const todayFree = Math.max(0, dailyBudget - todaySpent);

  const cardData: MorningCardData = {
    yesterdayAmount,
    yesterdayCatNames,
    todayFree,
    currency: sym,
    hasBudget: dailyBudget > 0,
  };

  await addMessage({
    userId,
    senderId: 'bot',
    kind: 'bot',
    text: 'Доброе утро ✨',
    status: 'saved',
    card: { kind: 'morning', data: cardData },
  });
}
