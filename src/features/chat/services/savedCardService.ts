import { format, isToday, isYesterday, parseISO } from 'date-fns';
import type { Locale } from 'date-fns';
import { addMessage } from './messagesService';

/**
 * Date hint for saved-entry chat cards: undefined for today,
 * localized "yesterday" or "5 July" otherwise.
 */
export function buildEntryDateHint(
  dateStr: string,
  t: (key: string) => string,
  locale: Locale,
): string | undefined {
  const d = parseISO(dateStr);
  if (isToday(d)) return undefined;
  return isYesterday(d) ? t('common.yesterday') : format(d, 'd MMMM', { locale });
}

export interface SavedCardInput {
  userId: string;
  text: string;
  icon: string;
  color: string;
  title: string;
  hint?: string;
  amount: number;
  currencySymbol: string;
  expenseId?: string;
  userMsgId?: string;
}

/**
 * Writes the bot "saved" confirmation card into chat history.
 * Every entry point that persists an expense/income/contribution should call
 * this so the chat timeline stays consistent regardless of where the user
 * saved from (chat, mobile fast entry, desktop quick-add).
 */
export async function recordSavedCard(input: SavedCardInput): Promise<void> {
  await addMessage({
    userId: input.userId,
    senderId: 'bot',
    kind: 'bot',
    text: input.text,
    status: 'saved',
    ...(input.expenseId ? { expenseId: input.expenseId } : {}),
    card: {
      kind: 'saved',
      data: {
        icon: input.icon,
        color: input.color,
        title: input.title,
        catName: null,
        groupName: null,
        hint: input.hint,
        amount: input.amount,
        currency: input.currencySymbol,
        ...(input.expenseId ? { expenseId: input.expenseId } : {}),
        ...(input.userMsgId ? { userMsgId: input.userMsgId } : {}),
      },
    },
  });
}
