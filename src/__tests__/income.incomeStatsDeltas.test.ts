import { describe, expect, it } from 'vitest';
import { buildIncomeStatsDeltas } from '@/features/income/services/incomeService';

describe('buildIncomeStatsDeltas', () => {
  it('applies only the amount difference inside one month', () => {
    expect(buildIncomeStatsDeltas(
      { amount: 1_000, date: '2026-07-10T09:00:00.000Z' },
      { amount: 1_250, date: new Date(2026, 6, 20) },
    )).toEqual([{ month: '2026-07', amount: 250 }]);
  });

  it('subtracts the old amount and adds the new amount when moving months', () => {
    expect(buildIncomeStatsDeltas(
      { amount: 1_000, date: '2026-06-10' },
      { amount: 1_250, date: new Date(2026, 6, 20) },
    )).toEqual([
      { month: '2026-06', amount: -1_000 },
      { month: '2026-07', amount: 1_250 },
    ]);
  });

  it('does not write a zero delta for metadata-only edits', () => {
    expect(buildIncomeStatsDeltas(
      { amount: 1_000, date: '2026-07-10' },
      { amount: 1_000, date: new Date(2026, 6, 10) },
    )).toEqual([]);
  });
});
