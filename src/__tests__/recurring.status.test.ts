/**
 * The shared status rule behind the list row and the detail screen.
 */
import { describe, it, expect } from 'vitest';
import { recurringStatus } from '@/features/recurring/utils/status';

const now = new Date('2026-08-22T10:00:00');
const iso = (s: string) => new Date(s + 'T12:00:00').toISOString();

describe('recurringStatus', () => {
  it('reads a future due date as upcoming', () => {
    expect(recurringStatus({ nextDueDate: iso('2026-09-01'), isActive: true }, now))
      .toEqual({ tone: 'upcoming', days: 10 });
  });

  it('flags the three-day window as soon', () => {
    expect(recurringStatus({ nextDueDate: iso('2026-08-25'), isActive: true }, now).tone).toBe('soon');
    expect(recurringStatus({ nextDueDate: iso('2026-08-26'), isActive: true }, now).tone).toBe('upcoming');
  });

  it('separates due today from overdue', () => {
    expect(recurringStatus({ nextDueDate: iso('2026-08-22'), isActive: true }, now).tone).toBe('due');
    const late = recurringStatus({ nextDueDate: iso('2026-08-05'), isActive: true }, now);
    expect([late.tone, late.days]).toEqual(['overdue', -17]);
  });

  it('compares calendar days, not elapsed hours', () => {
    // 23:00 today is still «due today», not «overdue by a fraction of a day»
    expect(recurringStatus(
      { nextDueDate: new Date('2026-08-22T23:00:00').toISOString(), isActive: true },
      new Date('2026-08-22T01:00:00'),
    ).tone).toBe('due');
  });

  it('owes nothing on a paused template, even past its due date', () => {
    expect(recurringStatus({ nextDueDate: iso('2026-08-05'), isActive: false }, now).tone).toBe('paused');
  });

  it('reports a finished fixed term as completed, paused or not', () => {
    const done = { nextDueDate: iso('2027-01-15'), endDate: iso('2026-12-15') };
    expect(recurringStatus({ ...done, isActive: false }, now).tone).toBe('completed');
    expect(recurringStatus({ ...done, isActive: true }, now).tone).toBe('completed');
  });

  it('leaves a term still running on its normal status', () => {
    expect(recurringStatus(
      { nextDueDate: iso('2026-08-05'), endDate: iso('2026-12-15'), isActive: true },
      now,
    ).tone).toBe('overdue');
  });
});
