'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { openQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { FastSavingsEntry } from '@/features/savings/components/FastSavingsEntry';

function ContributeInner() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      router.back();
      dispatch(openQuickAdd({ tab: 'savings' }));
    }
  }, [dispatch, router]);

  return <FastSavingsEntry />;
}

export default function SavingsContributePage() {
  return (
    <Suspense>
      <ContributeInner />
    </Suspense>
  );
}
