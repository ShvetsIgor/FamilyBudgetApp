/**
 * Fixed-term progress: which payment is pending, how many are left and how
 * much is still owed — the numbers the recurring detail screen reads.
 */
import { describe, it, expect } from 'vitest';
import { recurringProgress } from '@/features/recurring/utils/progress';
import { occurrenceDate } from '@/features/recurring/utils/schedule';
import type { RecurringScheduleInput } from '@/features/recurring/utils/progress';

const iso = (s: string) => new Date(s + 'T12:00:00').toISOString();

/** 12 monthly payments of 500, starting 2026-01-15 */
function installment(nextDue: string): RecurringScheduleInput {
  return {
    startDate: iso('2026-01-15'),
    endDate: occurrenceDate(new Date('2026-01-15T12:00:00'), 'monthly', 12).toISOString(),
    nextDueDate: iso(nextDue),
    frequency: 'monthly',
    amount: 500,
  };
}

describe('recurringProgress — open-ended', () => {
  it('reports nothing to count for a subscription', () => {
    const p = recurringProgress({
      startDate: iso('2026-01-15'), nextDueDate: iso('2026-08-15'),
      frequency: 'monthly', amount: 45,
    });
    expect(p.fixedTerm).toBe(false);
    expect([p.total, p.left, p.paid, p.pendingNumber]).toEqual([0, 0, 0, 0]);
    expect(p.lastPaymentDate).toBeNull();
  });
});

describe('recurringProgress — fixed term', () => {
  it('counts the whole term before the first payment', () => {
    const p = recurringProgress(installment('2026-01-15'));
    expect(p.fixedTerm).toBe(true);
    expect(p.total).toBe(12);
    expect(p.pendingNumber).toBe(1);
    expect(p.left).toBe(12);
    expect(p.paid).toBe(0);
    expect(p.leftAmount).toBe(6000);
    expect(p.paidAmount).toBe(0);
    expect(p.ratio).toBe(0);
  });

  it('tracks the pending payment mid-schedule', () => {
    const p = recurringProgress(installment('2026-03-15'));
    expect(p.pendingNumber).toBe(3);
    expect(p.paid).toBe(2);
    expect(p.left).toBe(10);
    expect(p.paidAmount).toBe(1000);
    expect(p.leftAmount).toBe(5000);
    expect(p.ratio).toBeCloseTo(2 / 12);
  });

  it('reports the last payment as pending, not as done', () => {
    const p = recurringProgress(installment('2026-12-15'));
    expect(p.pendingNumber).toBe(12);
    expect(p.left).toBe(1);
    expect(p.completed).toBe(false);
  });

  it('closes out once the due date passes the end date', () => {
    const p = recurringProgress(installment('2027-01-15'));
    expect(p.completed).toBe(true);
    expect(p.left).toBe(0);
    expect(p.paid).toBe(12);
    expect(p.pendingNumber).toBe(0);
    expect(p.leftAmount).toBe(0);
    expect(p.paidAmount).toBe(6000);
    expect(p.ratio).toBe(1);
  });

  it('names the date of the final scheduled payment', () => {
    const p = recurringProgress(installment('2026-03-15'));
    const last = new Date(p.lastPaymentDate!);
    expect([last.getFullYear(), last.getMonth(), last.getDate()]).toEqual([2026, 11, 15]);
  });

  it('follows the same month-end clamping as the schedule (Jan 31 → Feb 28)', () => {
    const start = new Date('2026-01-31T12:00:00');
    const p = recurringProgress({
      startDate: start.toISOString(),
      endDate: occurrenceDate(start, 'monthly', 3).toISOString(),
      nextDueDate: occurrenceDate(start, 'monthly', 2).toISOString(),
      frequency: 'monthly',
      amount: 100,
    });
    expect(p.total).toBe(3);
    expect(p.pendingNumber).toBe(2);
    expect(p.left).toBe(2);
  });

  it('treats a template terminated before its first payment as counting nothing', () => {
    // completeRecurring sets endDate to yesterday — here that is before the start
    const p = recurringProgress({
      startDate: iso('2026-08-20'),
      endDate: iso('2026-08-19'),
      nextDueDate: iso('2026-08-20'),
      frequency: 'monthly',
      amount: 45,
    });
    expect(p.fixedTerm).toBe(false);
    expect(p.total).toBe(0);
    expect(p.completed).toBe(true);
  });
});
