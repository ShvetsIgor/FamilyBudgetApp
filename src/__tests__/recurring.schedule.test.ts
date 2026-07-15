/**
 * Recurring schedule math: occurrence stepping, fixed-term payment counting
 * (credits/installments) and completion detection.
 */
import { describe, it, expect } from 'vitest';
import {
  nextOccurrence, occurrenceDate, countOccurrences, paymentsLeft,
  isScheduleCompleted, monthlyEquivalent,
} from '@/features/recurring/utils/schedule';

const d = (iso: string) => new Date(iso + 'T12:00:00');

describe('nextOccurrence', () => {
  it('steps by frequency', () => {
    expect(nextOccurrence(d('2026-07-15'), 'daily').getDate()).toBe(16);
    expect(nextOccurrence(d('2026-07-15'), 'weekly').getDate()).toBe(22);
    expect(nextOccurrence(d('2026-07-15'), 'monthly').getMonth()).toBe(7);
    expect(nextOccurrence(d('2026-07-15'), 'yearly').getFullYear()).toBe(2027);
  });

  it('clamps month-end like the live schedule does (Jan 31 → Feb 28 → Mar 28)', () => {
    const feb = nextOccurrence(d('2026-01-31'), 'monthly');
    expect([feb.getMonth(), feb.getDate()]).toEqual([1, 28]);
    const mar = nextOccurrence(feb, 'monthly');
    expect([mar.getMonth(), mar.getDate()]).toEqual([2, 28]);
  });
});

describe('occurrenceDate', () => {
  it('returns the start date for payment #1', () => {
    expect(occurrenceDate(d('2026-07-15'), 'monthly', 1).toDateString()).toBe(d('2026-07-15').toDateString());
  });

  it('returns the 12th monthly payment 11 months after start', () => {
    const last = occurrenceDate(d('2026-07-15'), 'monthly', 12);
    expect([last.getFullYear(), last.getMonth(), last.getDate()]).toEqual([2027, 5, 15]);
  });
});

describe('countOccurrences', () => {
  it('counts inclusive occurrences between start and end', () => {
    expect(countOccurrences(d('2026-07-15'), d('2027-06-15'), 'monthly')).toBe(12);
    expect(countOccurrences(d('2026-07-15'), d('2026-07-15'), 'monthly')).toBe(1);
  });

  it('returns 0 when end is before start', () => {
    expect(countOccurrences(d('2026-07-15'), d('2026-07-14'), 'monthly')).toBe(0);
  });

  it('ignores time-of-day noise (compares calendar days)', () => {
    const end = new Date('2026-08-15T00:00:00');
    const start = new Date('2026-07-15T23:59:00');
    expect(countOccurrences(start, end, 'monthly')).toBe(2);
  });
});

describe('paymentsLeft', () => {
  it('includes the pending payment', () => {
    // 12-payment plan, next due is payment #5 → 8 remain (5..12)
    const nextDue = occurrenceDate(d('2026-07-15'), 'monthly', 5).toISOString();
    const end = occurrenceDate(d('2026-07-15'), 'monthly', 12).toISOString();
    expect(paymentsLeft(nextDue, end, 'monthly')).toBe(8);
  });

  it('returns 0 once the schedule is exhausted', () => {
    const end = occurrenceDate(d('2026-07-15'), 'monthly', 12).toISOString();
    const beyond = occurrenceDate(d('2026-07-15'), 'monthly', 13).toISOString();
    expect(paymentsLeft(beyond, end, 'monthly')).toBe(0);
  });
});

describe('isScheduleCompleted', () => {
  it('is false without an end date', () => {
    expect(isScheduleCompleted(d('2026-07-15').toISOString(), undefined)).toBe(false);
  });

  it('is false while the pending due date is on or before the end', () => {
    expect(isScheduleCompleted(d('2026-07-15').toISOString(), d('2026-07-15').toISOString())).toBe(false);
  });

  it('is true when the pending due date falls after the end', () => {
    expect(isScheduleCompleted(d('2026-08-15').toISOString(), d('2026-07-15').toISOString())).toBe(true);
  });
});

describe('monthlyEquivalent', () => {
  it('normalizes each frequency to a monthly amount', () => {
    expect(monthlyEquivalent(100, 'monthly')).toBe(100);
    expect(monthlyEquivalent(120, 'yearly')).toBe(10);
    expect(monthlyEquivalent(10, 'weekly')).toBeCloseTo(43.3);
    expect(monthlyEquivalent(1, 'daily')).toBe(30);
  });
});
