import type { BudgetMode } from '@/features/ui/store/uiSlice';

interface DailyBudgetInput {
  mode: BudgetMode;
  dailyLimit: number;
  monthlyLimit: number;
  /** Account-currency totals: there is no FX source to fold anything else in */
  monthSpent: number;
  monthIncome: number;
  now: Date;
}

/** Days left in the month, today included. */
export function remainingDaysInMonth(now: Date): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return daysInMonth - now.getDate() + 1;
}

/**
 * What may be spent per day under the selected budget mode. The chat header
 * and the morning card both show it, so both must read it from here.
 */
export function computeDailyBudget({ mode, dailyLimit, monthlyLimit, monthSpent, monthIncome, now }: DailyBudgetInput): number {
  if (mode === 'daily') return dailyLimit;
  const pool = mode === 'monthly' ? monthlyLimit : monthIncome;
  if (pool <= 0) return 0;
  return Math.max(0, Math.round((pool - monthSpent) / remainingDaysInMonth(now)));
}
