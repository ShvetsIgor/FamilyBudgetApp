import { describe, expect, it } from 'vitest';
import { resolveUpdatedDueDate, nextOccurrence } from '@/features/recurring/utils/schedule';
import type { RecurringFrequency } from '@/shared/types';

/** The service's own walk-forward helper, kept identical so the rule is tested as used. */
function firstFutureOrToday(start: Date, frequency: RecurringFrequency): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let d = new Date(start);
  d.setHours(0, 0, 0, 0);
  while (d < today) d = nextOccurrence(d, frequency);
  return d;
}

const iso = (d: Date) => d.toISOString();
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

describe('resolveUpdatedDueDate', () => {
  it('keeps the advanced position when only the name changed', () => {
    // Paid today → the service advanced the due date a month out. Renaming the
    // template must not walk the schedule back onto the payment just booked.
    const startDate = new Date(2026, 0, 5);
    const advanced = daysFromNow(30);
    const resolved = resolveUpdatedDueDate(
      { startDate, frequency: 'monthly' },
      { startDate: iso(startDate), frequency: 'monthly', nextDueDate: iso(advanced) },
      firstFutureOrToday,
    );
    expect(resolved.toDateString()).toBe(advanced.toDateString());
  });

  it('keeps a due date the user paid early, still ahead of today', () => {
    const startDate = new Date(2026, 2, 1);
    const due = daysFromNow(4);
    const resolved = resolveUpdatedDueDate(
      { startDate, frequency: 'monthly' },
      { startDate: iso(startDate), frequency: 'monthly', nextDueDate: iso(due) },
      firstFutureOrToday,
    );
    expect(resolved.toDateString()).toBe(due.toDateString());
  });

  it('recomputes when the frequency changed', () => {
    const startDate = new Date(2026, 0, 5);
    const advanced = daysFromNow(30);
    const resolved = resolveUpdatedDueDate(
      { startDate, frequency: 'weekly' },
      { startDate: iso(startDate), frequency: 'monthly', nextDueDate: iso(advanced) },
      firstFutureOrToday,
    );
    expect(resolved.toDateString()).toBe(firstFutureOrToday(startDate, 'weekly').toDateString());
  });

  it('recomputes when the start date moved', () => {
    const oldStart = new Date(2026, 0, 5);
    const newStart = new Date(2026, 0, 20);
    const advanced = daysFromNow(30);
    const resolved = resolveUpdatedDueDate(
      { startDate: newStart, frequency: 'monthly' },
      { startDate: iso(oldStart), frequency: 'monthly', nextDueDate: iso(advanced) },
      firstFutureOrToday,
    );
    expect(resolved.toDateString()).toBe(firstFutureOrToday(newStart, 'monthly').toDateString());
  });

  it('recomputes when the stored due date now precedes the start date', () => {
    const startDate = daysFromNow(10);
    const stale = daysFromNow(2);
    const resolved = resolveUpdatedDueDate(
      { startDate, frequency: 'monthly' },
      { startDate: iso(startDate), frequency: 'monthly', nextDueDate: iso(stale) },
      firstFutureOrToday,
    );
    expect(resolved.toDateString()).toBe(startDate.toDateString());
  });

  it('falls back to the walk-forward when there is no stored schedule', () => {
    const startDate = new Date(2026, 0, 5);
    const resolved = resolveUpdatedDueDate(
      { startDate, frequency: 'monthly' },
      undefined,
      firstFutureOrToday,
    );
    expect(resolved.toDateString()).toBe(firstFutureOrToday(startDate, 'monthly').toDateString());
  });
});
