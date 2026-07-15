import { addDays, addWeeks, addMonths, addYears, parseISO } from 'date-fns';
import type { RecurringFrequency } from '@/shared/types';

// Hard cap so a malformed range can never loop forever (~100 years of monthly)
const MAX_OCCURRENCES = 1200;

export function nextOccurrence(from: Date, frequency: RecurringFrequency): Date {
  switch (frequency) {
    case 'daily': return addDays(from, 1);
    case 'weekly': return addWeeks(from, 1);
    case 'monthly': return addMonths(from, 1);
    case 'yearly': return addYears(from, 1);
  }
}

// Occurrence math compares calendar days: stored dates carry arbitrary
// times (Timestamp vs local-noon vs date-key strings)
function dayValue(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Date of the n-th payment (1-based; the start date is payment #1). */
export function occurrenceDate(start: Date, frequency: RecurringFrequency, n: number): Date {
  let d = start;
  for (let i = 1; i < Math.min(n, MAX_OCCURRENCES); i++) d = nextOccurrence(d, frequency);
  return d;
}

/** Scheduled payments from start to end inclusive; 0 when end is before start. */
export function countOccurrences(start: Date, end: Date, frequency: RecurringFrequency): number {
  if (dayValue(end) < dayValue(start)) return 0;
  let d = start;
  let count = 1;
  while (count < MAX_OCCURRENCES) {
    const next = nextOccurrence(d, frequency);
    if (dayValue(next) > dayValue(end)) break;
    d = next;
    count++;
  }
  return count;
}

/** Remaining payments including the pending one; 0 when the schedule is done. */
export function paymentsLeft(nextDueISO: string, endISO: string, frequency: RecurringFrequency): number {
  return countOccurrences(parseISO(nextDueISO), parseISO(endISO), frequency);
}

/** True when the schedule is exhausted: the pending due date falls after endDate. */
export function isScheduleCompleted(nextDueISO: string, endISO: string | undefined): boolean {
  if (!endISO) return false;
  return dayValue(parseISO(nextDueISO)) > dayValue(parseISO(endISO));
}

/** Monthly-equivalent amount for a frequency (weekly ≈ 4.33 per month). */
export function monthlyEquivalent(amount: number, frequency: RecurringFrequency): number {
  const factor =
    frequency === 'monthly' ? 1 :
    frequency === 'yearly' ? 1 / 12 :
    frequency === 'weekly' ? 4.33 : 30;
  return amount * factor;
}
