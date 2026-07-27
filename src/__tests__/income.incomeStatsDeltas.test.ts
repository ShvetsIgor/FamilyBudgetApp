import { describe, expect, it } from 'vitest';
import { buildIncomeStatsDeltas } from '@/features/income/services/incomeService';

const ILS = 'ILS' as const;
const USD = 'USD' as const;

describe('buildIncomeStatsDeltas', () => {
  it('applies only the amount difference inside one month', () => {
    expect(buildIncomeStatsDeltas(
      { amount: 1_000, date: '2026-07-10T09:00:00.000Z', currency: ILS },
      { amount: 1_250, date: new Date(2026, 6, 20), currency: ILS },
    )).toEqual([{ month: '2026-07', amount: 250, currency: ILS }]);
  });

  it('subtracts the old amount and adds the new amount when moving months', () => {
    expect(buildIncomeStatsDeltas(
      { amount: 1_000, date: '2026-06-10', currency: ILS },
      { amount: 1_250, date: new Date(2026, 6, 20), currency: ILS },
    )).toEqual([
      { month: '2026-06', amount: -1_000, currency: ILS },
      { month: '2026-07', amount: 1_250, currency: ILS },
    ]);
  });

  it('does not write a zero delta for metadata-only edits', () => {
    expect(buildIncomeStatsDeltas(
      { amount: 1_000, date: '2026-07-10', currency: ILS },
      { amount: 1_000, date: new Date(2026, 6, 10), currency: ILS },
    )).toEqual([]);
  });

  it('moves the whole amount between buckets when the currency changes', () => {
    // Same month, different currency: the old bucket must give the money back
    // rather than the two totals being netted against each other.
    expect(buildIncomeStatsDeltas(
      { amount: 1_000, date: '2026-07-10', currency: ILS },
      { amount: 1_000, date: new Date(2026, 6, 10), currency: USD },
    )).toEqual([
      { month: '2026-07', amount: -1_000, currency: ILS },
      { month: '2026-07', amount: 1_000, currency: USD },
    ]);
  });
});
