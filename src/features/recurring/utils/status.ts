import { differenceInCalendarDays, parseISO } from 'date-fns';
import { isScheduleCompleted } from './schedule';
import type { SerializableRecurringPayment } from '@/shared/types';

export type RecurringStatusTone =
  | 'completed'  // fixed term exhausted — nothing more is due, ever
  | 'paused'     // manually paused
  | 'overdue'    // a due date was missed and never resolved
  | 'due'        // due today
  | 'soon'       // due within three days
  | 'upcoming';  // just a date

export interface RecurringStatus {
  tone: RecurringStatusTone;
  /** Calendar days until the pending due date; negative when overdue */
  days: number;
}

export type RecurringStatusInput = Pick<
  SerializableRecurringPayment,
  'nextDueDate' | 'endDate' | 'isActive'
>;

/**
 * The one status rule for a template, shared by the list row and the detail
 * screen so they can never disagree.
 *
 * `completed` outranks `paused` (a finished schedule is deactivated too), and
 * `paused` outranks `overdue`: nothing is owed on a template the user stopped.
 */
export function recurringStatus(item: RecurringStatusInput, now: Date = new Date()): RecurringStatus {
  const days = differenceInCalendarDays(parseISO(item.nextDueDate), now);
  if (isScheduleCompleted(item.nextDueDate, item.endDate)) return { tone: 'completed', days };
  if (!item.isActive) return { tone: 'paused', days };
  if (days < 0) return { tone: 'overdue', days };
  if (days === 0) return { tone: 'due', days };
  if (days <= 3) return { tone: 'soon', days };
  return { tone: 'upcoming', days };
}
