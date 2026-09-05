'use client';

/**
 * Every recharts import for /analytics lives here.
 *
 * recharts is 100 kB gzip — a fifth of this route's JavaScript — and the charts
 * sit below the stat cards with nothing to draw until the Firestore round trips
 * finish. Importing them from the page made that 100 kB block first paint;
 * `next/dynamic` in page.tsx lets it arrive alongside the data instead. Keeping
 * all three in ONE module means one lazy chunk, not three.
 */

import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatAmount } from '@/shared/utils/currency';
import type { Currency } from '@/shared/types';

const tooltipStyle = { borderRadius: 12, border: '1px solid hsl(var(--border))' };
const GRID = 'hsl(var(--border))';
const TICK = { fontSize: 11 };

export interface DowPoint {
  name: string;
  shortDate: string;
  isoDate: string;
  amount: number;
}

export function AvgDailyChart({ data, currency, seriesLabel }: {
  data: { name: string; avgDay: number }[];
  currency: Currency;
  seriesLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="name" tick={TICK} />
        <YAxis tick={TICK} width={45} />
        <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={tooltipStyle} />
        <Bar dataKey="avgDay" name={seriesLabel} fill="#81B29A" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TrendChart({ data, currency, incomeLabel, expensesLabel }: {
  data: { name: string; expenses: number; income: number }[];
  currency: Currency;
  incomeLabel: string;
  expensesLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="name" tick={TICK} />
        <YAxis tick={TICK} width={45} />
        <Tooltip formatter={(value) => formatAmount(value as number, currency)} contentStyle={tooltipStyle} />
        <Area dataKey="income" name={incomeLabel} stroke="#10b981" strokeWidth={2} fill="url(#incomeGrad)" dot={false} />
        <Area dataKey="expenses" name={expensesLabel} stroke="#ef4444" strokeWidth={2} fill="url(#expenseGrad)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/**
 * Module scope on purpose: a component declared inside a render is a new type
 * on every pass and remounts the tooltip each time.
 */
function DowTooltip({
  active, payload, label, points, currency,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  points: { name: string; shortDate: string }[];
  currency: Currency;
}) {
  if (!active || !payload?.length) return null;
  const point = points.find((d) => d.name === label);
  return (
    <div style={{
      borderRadius: 12, border: '1px solid hsl(var(--border))',
      background: 'hsl(var(--card))', padding: '8px 12px', fontSize: 12,
    }}>
      <p style={{ fontWeight: 700 }}>{label}{point ? ` · ${point.shortDate}` : ''}</p>
      <p style={{ color: 'hsl(var(--primary))' }}>{formatAmount(payload[0].value, currency)}</p>
    </div>
  );
}

export function DowChart({ data, currency }: { data: DowPoint[]; currency: Currency }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="name" tick={TICK} />
        <YAxis tick={TICK} width={45} />
        <Tooltip content={<DowTooltip points={data} currency={currency} />} />
        <Bar dataKey="amount" name="Spent" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
