import { describe, expect, it } from 'vitest';
import { dueIncomeOccurrences, nextIncomeDueDate } from '@/features/income/services/recurringIncomeService';

describe('nextIncomeDueDate', () => {
  it('moves to the same day next month', () => {
    expect(nextIncomeDueDate('2026-03-10', 10)).toBe('2026-04-10');
  });

  it('rolls over the year boundary', () => {
    expect(nextIncomeDueDate('2026-12-01', 1)).toBe('2027-01-01');
  });

  it('clamps a 31st anchor into February and restores it in March', () => {
    expect(nextIncomeDueDate('2026-01-31', 31)).toBe('2026-02-28');
    // The anchor is kept, not derived from the clamped date
    expect(nextIncomeDueDate('2026-02-28', 31)).toBe('2026-03-31');
  });
});

describe('dueIncomeOccurrences', () => {
  it('returns nothing when the next occurrence is still ahead', () => {
    expect(dueIncomeOccurrences('2026-10-01', 1, '2026-09-04')).toEqual([]);
  });

  it('includes an occurrence falling on today', () => {
    expect(dueIncomeOccurrences('2026-09-04', 4, '2026-09-04')).toEqual(['2026-09-04']);
  });

  it('collects every occurrence missed while the app was closed', () => {
    // Away since June, opening the app on 4 September: three salaries are owed,
    // and booking one per launch used to make the user relaunch twice more.
    expect(dueIncomeOccurrences('2026-06-01', 1, '2026-09-04')).toEqual([
      '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01',
    ]);
  });

  it('stops at the cap rather than looping forever on bad data', () => {
    expect(dueIncomeOccurrences('1990-01-01', 1, '2026-09-04', 12)).toHaveLength(12);
  });
});
