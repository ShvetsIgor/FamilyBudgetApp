import type { SplitItem } from '@/shared/types';

export interface SplitResult {
  mainAmount: number;
  splitTotal: number;
  remainder: number;
  isValid: boolean;
}

export function calculateSplit(totalAmount: number, splits: SplitItem[]): SplitResult {
  const splitTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  const remainder = totalAmount - splitTotal;
  return {
    mainAmount: remainder,
    splitTotal,
    remainder,
    isValid: remainder >= 0,
  };
}
