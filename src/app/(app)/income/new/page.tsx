'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { openQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { FastIncomeEntry } from '@/features/income/components/FastIncomeEntry';

export default function NewIncomePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      router.back();
      dispatch(openQuickAdd({ tab: 'income' }));
    }
  }, [dispatch, router]);

  return <FastIncomeEntry />;
}
