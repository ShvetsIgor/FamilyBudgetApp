import { store } from '@/store/store';
import { addNotification } from '@/features/notifications/store/notificationsSlice';
import type { BotContext } from './context';
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

export async function sendMorningGreeting(ctx: BotContext): Promise<void> {
  const { currency, categoriesById, todaySpent } = ctx;

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  const yesterdayExpenses = (ctx as unknown as Record<string, unknown>).yesterdayExpenses as Array<{ amount: number; categoryId: string }> ?? [];
  const yesterdayAmount = yesterdayExpenses.reduce((s, e) => s + e.amount, 0);

  const catFreq: Record<string, number> = {};
  yesterdayExpenses.forEach((e) => {
    const cat = categoriesById.get(e.categoryId);
    const parentId = cat?.parentId ?? e.categoryId;
    const parent = categoriesById.get(parentId);
    const name = (parent?.name ?? cat?.name ?? '').toLowerCase();
    if (name) catFreq[name] = (catFreq[name] ?? 0) + 1;
  });
  const topCatNames = Object.entries(catFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([n]) => n)
    .join(' и ');

  const dailyBudget = (ctx as unknown as Record<string, unknown>).dailyBudget as number ?? 0;
  const todayFree = Math.max(0, dailyBudget - todaySpent);

  const cardData: MorningCardData = {
    yesterdayAmount,
    yesterdayCatNames: topCatNames,
    todayFree,
    currency: sym,
    hasBudget: dailyBudget > 0,
  };

  store.dispatch(addNotification({
    kind: 'morning',
    title: 'Доброе утро ✨',
    text: yesterdayAmount > 0
      ? `Вчера потрачено ${sym}${yesterdayAmount.toLocaleString()}. Сегодня свободно ${sym}${todayFree.toLocaleString()}.`
      : `Сегодня свободно ${sym}${todayFree.toLocaleString()}.`,
    data: cardData,
    createdAt: new Date().toISOString(),
  }));
}
