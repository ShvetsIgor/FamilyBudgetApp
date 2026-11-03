import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Calendar days to the deadline: tomorrow is 1 at any hour, not 0 after noon. */
export function goalDaysLeft(deadline: string, now: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(deadline), now);
}
