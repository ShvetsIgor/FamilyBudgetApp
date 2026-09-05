'use client';

/**
 * Every recharts import for /statistics lives here, loaded lazily by page.tsx.
 * See the note in ../analytics/AnalyticsCharts.tsx — same reasoning, and this
 * route is the heaviest in the app.
 */

import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { formatAmount } from '@/shared/utils/currency';
import type { Currency } from '@/shared/types';

const tooltipStyle = { borderRadius: 12, border: '1px solid hsl(var(--border))' };
const GRID = 'hsl(var(--border))';
const TICK = { fontSize: 11 };

export function CategoryPie({ data, currency, height, outerRadius, innerRadius }: {
  data: { catId: string; name: string; amount: number; color: string }[];
  currency: Currency;
  height: number;
  outerRadius: number;
  innerRadius: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data} dataKey="amount" nameKey="name" cx="50%" cy="50%"
          outerRadius={outerRadius} innerRadius={innerRadius} paddingAngle={2}
        >
          {data.map((entry) => <Cell key={entry.catId} fill={entry.color} />)}
        </Pie>
        <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MonthBars({ data, currency, expensesLabel, incomeLabel }: {
  data: { name: string; expenses: number; income: number }[];
  currency: Currency;
  expensesLabel: string;
  incomeLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="name" tick={TICK} />
        <YAxis tick={TICK} width={45} />
        <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={tooltipStyle} />
        <Bar dataKey="expenses" name={expensesLabel} fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
        <Bar dataKey="income" name={incomeLabel} fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
