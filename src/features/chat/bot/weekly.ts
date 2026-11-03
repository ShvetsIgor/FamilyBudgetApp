import { getISOWeek, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';
import { store } from '@/store/store';
import { addNotification } from '@/features/notifications/store/notificationsSlice';
import { getPresetDisplayName } from '@/features/categories/config/categoryLabels';
import { spentByCategory } from '@/features/budget/utils/envelopes';
import type { DigestContext } from './context';
import { makeT } from '@/shared/utils/makeT';
import type { WeeklyCardData, WeeklyEnvelope } from '@/features/chat/components/BotCard/WeeklyCard';
import { toLocalDateKey } from '@/shared/utils/dateKey';

const STORAGE_KEY = 'chat_lastWeeklyAt';

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

/** Pure so the arithmetic can be pinned without a store or a clock. */
export function buildWeeklyCard(ctx: DigestContext, now: Date): WeeklyCardData {
  const bt = makeT(ctx.language);
  const dayName = (iso: string) => {
    const d = format(parseISO(iso), 'EEEEEE', { locale: getDateFnsLocale(ctx.language) });
    return d.charAt(0).toUpperCase() + d.slice(1);
  };
  const { currency, categoriesById, language } = ctx;
  const catDisplayName = (catId: string, fallback?: string | null): string => {
    const preset = getPresetDisplayName(catId, language);
    if (preset) return preset;
    return fallback ?? bt.cat('Other');
  };

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const weekNum = getISOWeek(now);
  const weekRange = `${format(weekStart, 'd', { locale: getDateFnsLocale(ctx.language) })}–${format(weekEnd, 'd MMMM', { locale: getDateFnsLocale(ctx.language) })}`;

  const weekStartStr = toLocalDateKey(weekStart);
  const weekEndStr = toLocalDateKey(weekEnd);
  const weekExpenses = ctx.allExpenses.filter((e) => {
    const expenseDay = toLocalDateKey(e.date);
    return expenseDay >= weekStartStr && expenseDay <= weekEndStr;
  });
  const totalSpent = weekExpenses.reduce((s, e) => s + e.amount, 0);

  // A limit left behind by a deleted category budgets nothing, so it adds nothing
  const limits = Object.fromEntries(
    Object.entries(ctx.budgetLimits).filter(([catId, limit]) => limit > 0 && categoriesById.has(catId)),
  );
  const monthBudget = Object.values(limits).reduce((sum, limit) => sum + limit, 0);
  const totalBudget = Math.round(monthBudget / 4);
  const saved = Math.max(0, totalBudget - totalSpent);
  const savingsGoalName = ctx.firstGoalName;

  const catSpent = spentByCategory(weekExpenses);

  const envelopes: WeeklyEnvelope[] = Object.entries(limits)
    .map(([catId, monthLimit]) => {
      const cat = categoriesById.get(catId);
      return { name: catDisplayName(catId, cat?.name), icon: cat?.icon ?? 'box', color: cat?.color ?? '#E07A5F', spent: catSpent[catId] ?? 0, limit: Math.round(monthLimit / 4) };
    })
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  const daySpent: Record<string, number> = {};
  weekExpenses.forEach((e) => {
    const dayKey = toLocalDateKey(e.date);
    daySpent[dayKey] = (daySpent[dayKey] ?? 0) + e.amount;
  });
  let bestDay = '—', worstDay = '—';
  const dayEntries = Object.entries(daySpent);
  if (dayEntries.length > 0) {
    const sorted = dayEntries.sort((a, b) => a[1] - b[1]);
    const best = sorted[0], worst = sorted[sorted.length - 1];
    bestDay = `${dayName(best[0])} · ${sym}\u202F${best[1].toLocaleString()}`;
    worstDay = `${dayName(worst[0])} · ${sym}\u202F${worst[1].toLocaleString()}`;
  }

  const catCount: Record<string, number> = {};
  weekExpenses.forEach((e) => {
    catCount[e.categoryId] = (catCount[e.categoryId] ?? 0) + 1;
  });
  let mostFrequent = '—';
  if (Object.keys(catCount).length > 0) {
    const topId = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0][0];
    const topCat = categoriesById.get(topId);
    mostFrequent = `${catDisplayName(topId, topCat?.name)} ×${catCount[topId]}`;
  }

  return { weekNum, weekRange, totalSpent, totalBudget, saved, savingsGoalName, envelopes, bestDay, worstDay, mostFrequent, currency: sym };
}

export async function sendWeeklySummary(ctx: DigestContext, now: Date = new Date()): Promise<void> {
  const bt = makeT(ctx.language);
  const cardData = buildWeeklyCard(ctx, now);
  const { weekNum, weekRange, totalSpent, totalBudget, saved, currency: sym } = cardData;

  store.dispatch(addNotification({
    kind: 'weekly',
    title: bt('chat.bot.weeklyTitle', { n: weekNum }),
    text: `${bt('chat.bot.weeklySpent', { range: weekRange, sym, total: totalSpent.toLocaleString() })}${totalBudget > 0 ? bt('chat.bot.weeklySaved', { sym, amount: saved.toLocaleString() }) : ''}.`,
    data: cardData,
    createdAt: new Date().toISOString(),
  }));
}
