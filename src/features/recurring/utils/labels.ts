import { RECURRING_TYPE_ICONS } from '@/shared/config/domainIcons';
import type { IconKey } from '@/features/categories/icons/icons';
import type { TFunc } from '@/shared/utils/makeT';
import type { RecurringFrequency, RecurringType } from '@/shared/types';

export interface RecurringTypeOption {
  value: RecurringType;
  label: string;
  icon: IconKey;
}

export interface RecurringFreqOption {
  value: RecurringFrequency;
  label: string;
}

/** Kind chips/labels — one definition for the form, the list and the detail screen. */
export function recurringTypeOptions(t: TFunc): RecurringTypeOption[] {
  return [
    { value: 'subscription', label: t('recurring.subscription'), icon: RECURRING_TYPE_ICONS.subscription },
    { value: 'rent', label: t('recurring.rent'), icon: RECURRING_TYPE_ICONS.rent },
    { value: 'utility', label: t('recurring.utility'), icon: RECURRING_TYPE_ICONS.utility },
    { value: 'credit', label: t('recurring.credit'), icon: RECURRING_TYPE_ICONS.credit },
    { value: 'mortgage', label: t('recurring.mortgage'), icon: RECURRING_TYPE_ICONS.mortgage },
    { value: 'installment', label: t('recurring.installment'), icon: RECURRING_TYPE_ICONS.installment },
    { value: 'custom', label: t('recurring.custom'), icon: RECURRING_TYPE_ICONS.custom },
  ];
}

export function recurringFreqOptions(t: TFunc): RecurringFreqOption[] {
  return [
    { value: 'monthly', label: t('recurring.monthly') },
    { value: 'weekly', label: t('recurring.weekly') },
    { value: 'yearly', label: t('recurring.yearly') },
    { value: 'daily', label: t('recurring.daily') },
  ];
}

/** Kind label with the user's own wording for `custom` templates. */
export function recurringTypeLabel(
  item: { type: RecurringType; typeLabel?: string },
  t: TFunc,
): string {
  if (item.type === 'custom' && item.typeLabel) return item.typeLabel;
  return recurringTypeOptions(t).find((o) => o.value === item.type)?.label ?? '';
}

export function recurringTypeIcon(type: RecurringType): IconKey {
  return RECURRING_TYPE_ICONS[type];
}

export function recurringFreqLabel(frequency: RecurringFrequency, t: TFunc): string {
  return recurringFreqOptions(t).find((o) => o.value === frequency)?.label ?? '';
}
