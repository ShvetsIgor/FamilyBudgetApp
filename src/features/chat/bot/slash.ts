import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { addMessage } from '@/features/chat/services/messagesService';
import { getPresetDisplayName } from '@/features/categories/config/categoryLabels';
import type { BotContext } from './context';
import type { EnvelopesCardData } from '@/features/chat/components/BotCard/EnvelopesCard';
import type { WeeklyCardData } from '@/features/chat/components/BotCard/WeeklyCard';
import { sendWeeklySummary } from './weekly';

export function isSlashCommand(text: string): boolean {
  return text.trim().startsWith('/');
}

const HELP_TEXT =
  'Как записывать траты:\n' +
  '• «<b>хлеб 12</b>» — слово + сумма\n' +
  '• «<b>65 кофе</b>» — сумма + слово\n' +
  '• «<b>☕ 40</b>» — эмодзи + сумма\n\n' +
  'Команды:\n' +
  '• <b>/баланс</b> — конверты за месяц\n' +
  '• <b>/неделя</b> — итог недели\n' +
  '• <b>/помощь</b> — это сообщение';

export async function handleSlashCommand(
  text: string,
  ctx: BotContext & {
    allExpenses: Array<{ amount: number; categoryId: string; date: string }>;
    monthBudget: number;
    budgetLimits: Record<string, number>;
    dailyBudget: number;
    firstGoalName?: string;
  }
): Promise<void> {
  const cmd = text.trim().toLowerCase();
  const { userId, categoriesById, currency, allExpenses, budgetLimits } = ctx;

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  // /помощь
  if (cmd === '/помощь' || cmd === '/help') {
    await addMessage({
      userId,
      senderId: 'bot',
      kind: 'bot',
      text: HELP_TEXT,
      status: 'saved',
    });
    return;
  }

  // /неделя — reuse weekly summary logic
  if (cmd === '/неделя' || cmd === '/week') {
    await sendWeeklySummary(ctx as any);
    return;
  }

  // /баланс — envelopes for current month
  if (cmd === '/баланс' || cmd === '/balance') {
    const monthStr = new Date().toISOString().slice(0, 7); // "2026-05"
    const monthLabel = format(new Date(), 'LLLL yyyy', { locale: ru });

    // Spending per category this month
    const catSpent: Record<string, number> = {};
    allExpenses
      .filter((e) => e.date.startsWith(monthStr))
      .forEach((e) => {
        catSpent[e.categoryId] = (catSpent[e.categoryId] ?? 0) + e.amount;
      });

    // Build envelopes — union of limits and spending
    const catIds = new Set([...Object.keys(budgetLimits), ...Object.keys(catSpent)]);
    const envelopes = Array.from(catIds)
      .map((catId) => {
        const cat = categoriesById.get(catId);
        return {
          name: cat?.name ?? catId,
          icon: cat?.icon ?? 'box',
          color: cat?.color ?? '#E07A5F',
          spent: catSpent[catId] ?? 0,
          limit: budgetLimits[catId] ?? 0,
          currency: sym,
        };
      })
      .filter((e) => e.spent > 0 || e.limit > 0)
      .sort((a, b) => b.spent - a.spent);

    const cardData: EnvelopesCardData = { envelopes, monthLabel };

    await addMessage({
      userId,
      senderId: 'bot',
      kind: 'bot',
      text: 'Конверты',
      status: 'saved',
      card: { kind: 'envelopes' as any, data: cardData },
    });
    return;
  }

  // Unknown command
  await addMessage({
    userId,
    senderId: 'bot',
    kind: 'bot',
    text: `Не знаю команды <b>${text}</b>. Попробуй <b>/помощь</b>.`,
    status: 'saved',
  });
}
