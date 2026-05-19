import { getISOWeek, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { store } from '@/store/store';
import { addNotification } from '@/features/notifications/store/notificationsSlice';
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
  if (now.getDay() !== 0 || now.getHours() < 18) return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== thisWeekKey();
  } catch {
    return false;
  }
}

export function markWeeklySummarySent(): void {
  try {
    localStorage.setItem(STORAGE_KEY, thisWeekKey());
  } catch {}
}

export async function sendWeeklySummary(ctx: BotContext): Promise<void> {
  const { currency, categoriesById } = ctx;

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekNum = getISOWeek(now);
  const weekRange = `${format(weekStart, 'd', { locale: ru })}–${format(weekEnd, 'd MMMM', { locale: ru })}`;

  const allExpenses = (ctx as unknown as Record<string, unknown>).allExpenses as Array<{ amount: number; categoryId: string; date: string }> ?? [];
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);
  const weekExpenses = allExpenses.filter((e) => e.date >= weekStartStr && e.date <= weekEndStr);
  const totalSpent = weekExpenses.reduce((s, e) => s + e.amount, 0);

  const monthBudget = (ctx as unknown as Record<string, unknown>).monthBudget as number ?? 0;
  const totalBudget = Math.round(monthBudget / 4);
  const saved = Math.max(0, totalBudget - totalSpent);
  const savingsGoalName = (ctx as unknown as Record<string, unknown>).firstGoalName as string | undefined;

  const catSpent: Record<string, number> = {};
  weekExpenses.forEach((e) => {
    const cat = categoriesById.get(e.categoryId);
    const parentId = cat?.parentId ?? e.categoryId;
    catSpent[parentId] = (catSpent[parentId] ?? 0) + e.amount;
  });

  const limits = (ctx as unknown as Record<string, unknown>).budgetLimits as Record<string, number> ?? {};
  const envelopes: WeeklyEnvelope[] = Object.entries(limits)
    .filter(([, lim]) => lim > 0)
    .map(([catId, monthLimit]) => {
      const cat = categoriesById.get(catId);
      return { name: cat?.name ?? catId, icon: cat?.icon ?? 'box', color: cat?.color ?? '#E07A5F', spent: catSpent[catId] ?? 0, limit: Math.round(monthLimit / 4) };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  const daySpent: Record<string, number> = {};
  weekExpenses.forEach((e) => { daySpent[e.date.slice(0, 10)] = (daySpent[e.date.slice(0, 10)] ?? 0) + e.amount; });
  let bestDay = '—', worstDay = '—';
  const dayEntries = Object.entries(daySpent);
  if (dayEntries.length > 0) {
    const sorted = dayEntries.sort((a, b) => a[1] - b[1]);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    bestDay = `${DAY_NAMES[parseISO(best[0]).getDay()]} · ${sym}\u202F${best[1].toLocaleString()}`;
    worstDay = `${DAY_NAMES[parseISO(worst[0]).getDay()]} · ${sym}\u202F${worst[1].toLocaleString()}`;
  }

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
    mostFrequent = `${topCat?.name ?? topId} ×${catCount[topId]}`;
  }

  const cardData: WeeklyCardData = { weekNum, weekRange, totalSpent, totalBudget, saved, savingsGoalName, envelopes, bestDay, worstDay, mostFrequent, currency: sym };

  store.dispatch(addNotification({
    kind: 'weekly',
    title: `Неделя ${weekNum} закрыта 💫`,
    text: `За ${weekRange} потрачено ${sym}${totalSpent.toLocaleString()}${totalBudget > 0 ? `, сэкономлено ${sym}${saved.toLocaleString()}` : ''}.`,
    data: cardData,
    createdAt: new Date().toISOString(),
  }));
}
