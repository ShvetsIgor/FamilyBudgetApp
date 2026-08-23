import { parseISO } from 'date-fns';
import { countOccurrences, isScheduleCompleted, occurrenceDate, paymentsLeft } from './schedule';
import type { SerializableRecurringPayment } from '@/shared/types';

export type RecurringScheduleInput = Pick<
  SerializableRecurringPayment,
  'startDate' | 'endDate' | 'nextDueDate' | 'frequency' | 'amount'
>;

export interface RecurringProgress {
  /** A fixed-term schedule (installment/credit/mortgage) — has real payment counts */
  fixedTerm: boolean;
  /** Scheduled payments in total; 0 when open-ended */
  total: number;
  /** Schedule exhausted: the pending due date falls after the end date */
  completed: boolean;
  /** 1-based number of the payment now pending; 0 when completed or open-ended */
  pendingNumber: number;
  /** Payments still to make, including the pending one */
  left: number;
  /** Payments already made */
  paid: number;
  /** ISO date of the final scheduled payment; null when open-ended */
  lastPaymentDate: string | null;
  /**
   * Money already paid / still owed AT THE CURRENT PRICE. `updateRecurringAmount`
   * («сумма изменилась») rewrites the template price, so for a schedule whose
   * price changed mid-way these are estimates — the paid history on the detail
   * screen comes from real expenses, not from this number.
   */
  paidAmount: number;
  leftAmount: number;
  /** 0..1 share of the schedule completed */
  ratio: number;
}

const OPEN_ENDED: RecurringProgress = {
  fixedTerm: false, total: 0, completed: false, pendingNumber: 0, left: 0, paid: 0,
  lastPaymentDate: null, paidAmount: 0, leftAmount: 0, ratio: 0,
};

/**
 * Where a fixed-term payment stands: which payment is pending, how many are
 * left and how much is still owed. Open-ended templates (no end date) report
 * every count as 0 — there is nothing to be "done" with a subscription.
 */
export function recurringProgress(item: RecurringScheduleInput): RecurringProgress {
  if (!item.endDate) return OPEN_ENDED;

  const completed = isScheduleCompleted(item.nextDueDate, item.endDate);
  const start = parseISO(item.startDate);
  const total = countOccurrences(start, parseISO(item.endDate), item.frequency);

  // `completeRecurring` terminates by setting endDate to yesterday, which can
  // land before the start date — a template that never had a scheduled payment
  if (total === 0) return { ...OPEN_ENDED, completed };

  const left = completed ? 0 : paymentsLeft(item.nextDueDate, item.endDate, item.frequency);
  const paid = total - left;

  return {
    fixedTerm: true,
    total,
    completed,
    pendingNumber: completed ? 0 : paid + 1,
    left,
    paid,
    lastPaymentDate: occurrenceDate(start, item.frequency, total).toISOString(),
    paidAmount: paid * item.amount,
    leftAmount: left * item.amount,
    ratio: paid / total,
  };
}
