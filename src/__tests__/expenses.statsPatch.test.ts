import { expect, it } from 'vitest';
import { buildMonthlyStatsPatch, buildStatsDelta } from '@/features/expenses/utils/expenseStats';
import { zonedDateToDate, toZonedDateKey } from '@/shared/utils/dateKey';
it('preserves split allocation and currency maps for both SDK adapters', () => {
  const delta = buildStatsDelta('food', 100, [{ categoryId: 'home', amount: 30 }], 1, 'CAD');
  expect(buildMonthlyStatsPatch('alice', '2026-09', delta, (value) => value, 'now')).toEqual({
    userId: 'alice', month: '2026-09', totalExpenses: 100, totalsByCurrency: { CAD: 100 },
    byCategory: { food: 70, home: 30 }, byCategoryByCurrency: { CAD: { food: 70, home: 30 } }, updatedAt: 'now',
  });
});
it('updates category-only deltas without touching totals', () => {
  const patch = buildMonthlyStatsPatch('alice', '2026-09', { currency: 'USD', totalExpenses: 0, byCategory: { a: -10, b: 10 } }, (n) => n, 'now');
  expect(patch).not.toHaveProperty('totalExpenses');
  expect(patch?.byCategoryByCurrency).toEqual({ USD: { a: -10, b: 10 } });
});
it.each([
  ['2026-01-01', 'Asia/Jerusalem', '2026-01-01T10:00:00.000Z'],
  ['2026-07-01', 'Asia/Jerusalem', '2026-07-01T09:00:00.000Z'],
  ['2026-03-08', 'America/Toronto', '2026-03-08T16:00:00.000Z'],
  ['2026-09-01', 'Pacific/Kiritimati', '2026-08-31T22:00:00.000Z'],
])('stores local date %s in %s without changing the calendar day', (key, zone, iso) => {
  const date = zonedDateToDate(key, zone);
  expect(date.toISOString()).toBe(iso); expect(toZonedDateKey(date, zone)).toBe(key);
});
