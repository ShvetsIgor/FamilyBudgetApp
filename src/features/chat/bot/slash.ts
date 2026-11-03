import { format } from 'date-fns';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { addMessage } from '@/features/chat/services/messagesService';
import { getPresetDisplayName } from '@/features/categories/config/categoryLabels';
import { spentByCategory } from '@/features/budget/utils/envelopes';
import type { DigestContext } from './context';
import { makeT } from '@/shared/utils/makeT';
import type { EnvelopesCardData } from '@/features/chat/components/BotCard/EnvelopesCard';
import type { WeeklyCardData } from '@/features/chat/components/BotCard/WeeklyCard';
import { sendWeeklySummary } from './weekly';

export function isSlashCommand(text: string): boolean {
  return text.trim().startsWith('/');
}

/** The reports add expenses up, so they need them loaded; /help does not. */
export function slashCommandNeedsExpenses(text: string): boolean {
  return ['/неделя', '/week', '/баланс', '/balance'].includes(text.trim().toLowerCase());
}

export async function handleSlashCommand(text: string, ctx: DigestContext): Promise<void> {
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
    await sendWeeklySummary(ctx);
    return;
  }

  // /баланс — envelopes for current month
  if (cmd === '/баланс' || cmd === '/balance') {
    const monthStr = toLocalMonthKey(new Date());
    const monthLabel = format(new Date(), 'LLLL yyyy', { locale: getDateFnsLocale(ctx.language) });

    // Spending per category this month (local calendar month, not UTC)
    const catSpent = spentByCategory(allExpenses.filter((e) => toLocalMonthKey(e.date) === monthStr));

    // Union of limits and spending. Money spent in a since-deleted category is
    // still shown; a limit left behind by one budgets nothing.
    const liveLimits = Object.keys(budgetLimits).filter((catId) => categoriesById.has(catId));
    const catIds = new Set([...liveLimits, ...Object.keys(catSpent)]);
    const envelopes = Array.from(catIds)
      .map((catId) => {
        const cat = categoriesById.get(catId);
        return {
          name: getPresetDisplayName(catId, language) ?? cat?.name ?? makeT(language).cat('Other'),
          icon: cat?.icon ?? 'box',
          color: cat?.color ?? '#E07A5F',
          spent: catSpent[catId] ?? 0,
          limit: cat ? budgetLimits[catId] ?? 0 : 0,
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
