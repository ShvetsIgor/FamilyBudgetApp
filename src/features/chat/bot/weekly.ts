import { getISOWeek, startOfWeek, endOfWeek, format, subDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { addMessage } from '@/features/chat/services/messagesService';
import type { BotContext } from './context';
import type { WeeklyCardData, WeeklyEnvelope } from '@/features/chat/components/BotCard/WeeklyCard';

const STORAGE_KEY = 'chat_lastWeeklyAt';
const DAY_NAMES: Record<number, string> = { 0: 'Вс', 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб' };

function thisWeekKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, '0')}`;
}

export function shouldSendWeeklySummary(): boolean {
  const now = new Date();
  const isSunday = now.getDay() === 0;
  const isEvening = now.getHours() >= 18;
  if (!isSunday || !isEvening) return false;

  try {
    const last = localStorage.getItem(STORAGE_KEY);
    return last !== thisWeekKey();
  } catch {
    return false;
  }
}

export function markWeeklySummarySent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, thisWeekKey());
  } catch {
    // ignore
  }
}

export async function sendWeeklySummary(ctx: BotContext): Promise<void> {
  const { userId, currency, categoriesById } = ctx;

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekNum = getISOWeek(now);
  const weekRange = `${format(weekStart, 'd', { locale: ru })}–${format(weekEnd, 'd MMMM', { locale: ru })}`;

  const allExpenses = (ctx as any).allExpenses as Array<{
    amount: number; categoryId: string; date: string;
  }> ?? [];

  // Filter this week
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const weekExpenses = allExpenses.filter((e) => e.date >= weekStartStr && e.date <= weekEndStr);

  const totalSpent = weekExpenses.reduce((s, e) => s + e.amount, 0);

  // Total budget from ctx
  const monthBudget = (ctx as any).monthBudget as number ?? 0;
  const totalBudget = Math.round(monthBudget / 4);
  const saved = Math.max(0, totalBudget - totalSpent);

  // Savings goal name (first non-savings goal if any)
  const savingsGoalName = (ctx as any).firstGoalName as string | undefined;

  // Spending by category parent
  const catSpent: Record<string, number> = {};
  weekExpenses.forEach((e) => {
    const cat = categoriesById.get(e.categoryId);
    const parentId = cat?.parentId ?? e.categoryId;
    catSpent[parentId] = (catSpent[parentId] ?? 0) + e.amount;
  });

  // Build envelopes from budget limits
  const limits = (ctx as any).budgetLimits as Record<string, number> ?? {};
  const envelopes: WeeklyEnvelope[] = Object.entries(limits)
    .filter(([, lim]) => lim > 0)
    .map(([catId, monthLimit]) => {
      const cat = categoriesById.get(catId);
      return {
        name: cat?.name ?? catId,
        icon: cat?.icon ?? 'box',
        color: cat?.color ?? '#E07A5F',
        spent: catSpent[catId] ?? 0,
        limit: Math.round(monthLimit / 4),
      };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  // Spending by day
  const daySpent: Record<string, number> = {};
  weekExpenses.forEach((e) => {
    const d = e.date.slice(0, 10);
    daySpent[d] = (daySpent[d] ?? 0) + e.amount;
  });

  const dayEntries = Object.entries(daySpent);
  let bestDay = '—';
  let worstDay = '—';
  if (dayEntries.length > 0) {
    const sorted = dayEntries.sort((a, b) => a[1] - b[1]);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const bestDate = parseISO(best[0]);
    const worstDate = parseISO(worst[0]);
    bestDay = `${DAY_NAMES[bestDate.getDay()]} · ${sym}${best[1].toLocaleString()}`;
    worstDay = `${DAY_NAMES[worstDate.getDay()]} · ${sym}${worst[1].toLocaleString()}`;
  }

  // Most frequent category
  const catCount: Record<string, number> = {};
  weekExpenses.forEach((e) => {
    const cat = categoriesById.get(e.categoryId);
    const parentId = cat?.parentId ?? e.categoryId;
    catCount[parentId] = (catCount[parentId] ?? 0) + 1;
  });
  let mostFrequent = '—';
  if (Object.keys(catCount).length > 0) {
    const topId = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
    const topCat = categoriesById.get(topId);
    const count = catCount[topId];
    mostFrequent = `${topCat?.name ?? topId} ×${count}`;
  }

  const cardData: WeeklyCardData = {
    weekNum,
    weekRange,
    totalSpent,
    totalBudget,
    saved,
    savingsGoalName,
    envelopes,
    bestDay,
    worstDay,
    mostFrequent,
    currency: sym,
  };

  await addMessage({
    userId,
    senderId: 'bot',
    kind: 'bot',
    text: 'Неделя закрыта 💫',
    status: 'saved',
    card: { kind: 'weekly', data: cardData },
  });
}
