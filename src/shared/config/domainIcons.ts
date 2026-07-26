import type { IconKey } from '@/features/categories/icons/icons';
import type { PaymentMethod, RecurringType } from '@/shared/types';

/**
 * Single source of truth for domain iconography that used to be hard-coded
 * emoji (💳 🏦 📺 …). Emoji render differently per platform and cannot be
 * themed, so structural icons come from the app's own outline registry.
 *
 * Deliberately still emoji elsewhere: savings-goal icons (user-picked, and
 * rendered as emoji across every surface), family reactions (content, not
 * chrome), the parser's emoji dictionary (input data) and bot copy.
 */

// Income rows carry an extra 'bank' method on top of the expense union
export const PAYMENT_METHOD_ICONS: Record<PaymentMethod | 'bank', IconKey> = {
  card: 'card',
  cash: 'cash',
  bank: 'bank',
  other: 'refund',
};

export function paymentMethodIcon(method: string | undefined): IconKey {
  return PAYMENT_METHOD_ICONS[method as PaymentMethod | 'bank'] ?? 'refund';
}

export const RECURRING_TYPE_ICONS: Record<RecurringType, IconKey> = {
  subscription: 'tv',
  rent: 'house',
  utility: 'lightning',
  credit: 'card',
  mortgage: 'bank',
  installment: 'box',
  custom: 'refund',
};

export function recurringTypeIcon(type: string | undefined): IconKey {
  return RECURRING_TYPE_ICONS[type as RecurringType] ?? 'refund';
}
