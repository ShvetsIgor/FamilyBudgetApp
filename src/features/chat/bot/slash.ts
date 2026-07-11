import { format } from 'date-fns';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { addMessage } from '@/features/chat/services/messagesService';
import { getPresetDisplayName } from '@/features/categories/config/categoryLabels';
import type { BotContext } from './context';
import { makeT } from '@/shared/utils/makeT';
import type { EnvelopesCardData } from '@/features/chat/components/BotCard/EnvelopesCard';
import type { WeeklyCardData } from '@/features/chat/components/BotCard/WeeklyCard';
import { sendWeeklySummary } from './weekly';

export function isSlashCommand(text: string): boolean {
  return text.trim().startsWith('/');
}

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
  const { userId, categoriesById, currency, allExpenses, budgetLimits, language } = ctx;

  const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
  const sym = symMap[currency] ?? currency;

  // /помощь
  if (cmd === '/помощь' || cmd === '/help') {
    await addMessage({
      userId,
      senderId: 'bot',
      kind: 'bot',
      text: makeT(ctx.language)('chat.bot.helpText'),
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
    const monthStr = toLocalMonthKey(new Date());
    const monthLabel = format(new Date(), 'LLLL yyyy', { locale: getDateFnsLocale(ctx.language) });

    // Spending per category this month (local calendar month, not UTC)
    const catSpent: Record<string, number> = {};
    allExpenses
      .filter((e) => toLocalMonthKey(e.date) === monthStr)
      .forEach((e) => {
        catSpent[e.categoryId] = (catSpent[e.categoryId] ?? 0) + e.amount;
      });

    // Build envelopes — union of limits and spending
    const catIds = new Set([...Object.keys(budgetLimits), ...Object.keys(catSpent)]);
    const envelopes = Array.from(catIds)
      .map((catId) => {
        const cat = categoriesById.get(catId);
        return {
          name: getPresetDisplayName(catId, language) ?? cat?.name ?? catId,
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
      text: makeT(ctx.language)('chat.bot.envelopes'),
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
    text: makeT(ctx.language)('chat.bot.unknownCommand', { cmd: text }),
    status: 'saved',
  });
}
