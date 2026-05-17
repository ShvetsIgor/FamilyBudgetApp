import { Suspense } from 'react';
import { FastSavingsEntry } from '@/features/savings/components/FastSavingsEntry';

export default function SavingsContributePage() {
  return (
    <Suspense>
      <FastSavingsEntry />
    </Suspense>
  );
}
