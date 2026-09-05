/**
 * The chart components were lifted out of /analytics and /statistics so recharts
 * could be loaded lazily. An authenticated walk is not possible on this machine
 * (the Firestore emulator needs Java), so these render the extracted components
 * against fixture data instead — enough to catch a prop that was renamed on one
 * side of the move but not the other, which is the failure mode of that kind of
 * refactor.
 *
 * recharts measures its own container, so ResponsiveContainer is given an
 * explicit size; without it jsdom reports 0×0 and recharts renders nothing.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { AvgDailyChart, TrendChart, DowChart } from '@/app/(app)/analytics/AnalyticsCharts';
import { CategoryPie, MonthBars } from '@/app/(app)/statistics/StatisticsCharts';

const ILS = 'ILS' as const;

beforeAll(() => {
  for (const prop of ['offsetWidth', 'offsetHeight'] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      value: prop === 'offsetWidth' ? 640 : 320,
    });
  }
});

const sized = (ui: React.ReactElement) =>
  render(<div style={{ width: 640, height: 320 }}>{ui}</div>);

describe('analytics charts', () => {
  it('renders the average-per-day bars', () => {
    const { container } = sized(
      <AvgDailyChart
        data={[{ name: '07', avgDay: 120 }, { name: '08', avgDay: 95 }]}
        currency={ILS}
        seriesLabel="Avg/day"
      />,
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });

  it('renders the income/expense trend', () => {
    const { container } = sized(
      <TrendChart
        data={[{ name: '07', expenses: 5000, income: 12000 }]}
        currency={ILS}
        incomeLabel="Income"
        expensesLabel="Expenses"
      />,
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });

  it('renders the day-of-week bars', () => {
    const { container } = sized(
      <DowChart
        data={[{ name: 'Mon', shortDate: '1 Sep', isoDate: '2026-09-01', amount: 210 }]}
        currency={ILS}
      />,
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});

describe('statistics charts', () => {
  it('renders the category pie', () => {
    const { container } = sized(
      <CategoryPie
        data={[{ catId: 'groceries', name: 'Groceries', amount: 900, color: '#12907A' }]}
        currency={ILS}
        height={210}
        outerRadius={88}
        innerRadius={62}
      />,
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });

  it('renders the month bars', () => {
    const { container } = sized(
      <MonthBars
        data={[{ name: '07', expenses: 5000, income: 12000 }]}
        currency={ILS}
        expensesLabel="Expenses"
        incomeLabel="Income"
      />,
    );
    expect(container.querySelector('.recharts-responsive-container')).toBeTruthy();
  });
});
