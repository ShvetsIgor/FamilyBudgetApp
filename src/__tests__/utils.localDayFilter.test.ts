/**
 * Expense dates are stored as UTC ISO strings, so "is this today?" must go
 * through a LOCAL day key. Comparing with `startsWith(localDayKey)` filed a
 * 02:00 expense under the previous day in every timezone ahead of UTC — which
 * is exactly what made «потрачено сегодня» read 0 after a late-night entry.
 */
import { describe, it, expect } from 'vitest';
import { toLocalDateKey, toLocalMonthKey } from '@/shared/utils/dateKey';

/** 02:00 local on 2026-07-27 for a UTC+3 clock is 23:00 UTC on 2026-07-26. */
const lateNightLocal = new Date(2026, 6, 27, 2, 0, 0);
const storedIso = lateNightLocal.toISOString();

describe('local day keys vs stored UTC timestamps', () => {
  it('keeps a past-midnight entry on its local day', () => {
    expect(toLocalDateKey(storedIso)).toBe('2026-07-27');
  });

  it('is what the naive ISO prefix gets wrong when local is ahead of UTC', () => {
    const utcPrefix = storedIso.slice(0, 10);
    const localKey = toLocalDateKey(lateNightLocal);
    // Only assert the mismatch where the clock actually differs, so the test
    // stays honest in UTC and behind-UTC CI environments.
    if (lateNightLocal.getTimezoneOffset() < 0) {
      expect(utcPrefix).not.toBe(localKey);
    }
    // The helper agrees with the local wall clock either way.
    expect(toLocalDateKey(storedIso)).toBe(localKey);
  });

  it('filters a same-local-day expense in, unlike a prefix match', () => {
    const todayKey = toLocalDateKey(lateNightLocal);
    const expenses = [{ date: storedIso, amount: 30 }];
    const byLocalKey = expenses.filter((e) => toLocalDateKey(e.date) === todayKey);
    expect(byLocalKey).toHaveLength(1);
  });

  it('buckets the month by the local day too', () => {
    expect(toLocalMonthKey(storedIso)).toBe('2026-07');
  });

  it('handles a plain date-key string unchanged', () => {
    expect(toLocalDateKey('2026-07-27')).toBe('2026-07-27');
  });
});
