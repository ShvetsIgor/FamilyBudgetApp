'use client';

import Link from 'next/link';
import { Plus, TrendingUp } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { getCurrencySymbol } from '@/shared/utils/currency';

export default function HomePage() {
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const symbol = getCurrencySymbol(currency);

  return (
    <div className="flex flex-col items-center px-4 pt-8 gap-8">
      {/* Month summary card */}
      <div className="w-full max-w-sm rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
        <p className="text-sm font-medium opacity-80">This Month</p>
        <p className="mt-1 text-3xl font-bold">{symbol}0</p>
        <div className="mt-4 flex justify-between text-sm">
          <div>
            <p className="opacity-70">Income</p>
            <p className="font-semibold">{symbol}0</p>
          </div>
          <div className="text-right">
            <p className="opacity-70">Expenses</p>
            <p className="font-semibold">{symbol}0</p>
          </div>
        </div>
      </div>

      {/* Quick add buttons */}
      <div className="flex items-end gap-8">
        {/* Income */}
        <div className="flex flex-col items-center gap-2">
          <Link href="/expenses?tab=income">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md active:scale-95 transition-transform">
              <TrendingUp className="h-6 w-6" />
            </div>
          </Link>
          <p className="text-xs text-muted-foreground">Add Income</p>
        </div>

        {/* Expense — center, larger */}
        <div className="flex flex-col items-center gap-2">
          <Link href="/expenses/new">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 active:scale-95 transition-transform">
              <Plus className="h-9 w-9" />
            </div>
          </Link>
          <p className="text-sm text-muted-foreground">Add Expense</p>
        </div>

        {/* Placeholder for symmetry */}
        <div className="w-14" />
      </div>

      {/* Recent */}
      <div className="w-full max-w-sm">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Recent</h2>
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No expenses yet</p>
          <Link href="/expenses/new" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
            Add your first expense →
          </Link>
        </div>
      </div>
    </div>
  );
}
