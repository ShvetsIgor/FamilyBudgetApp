'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { openQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { FastExpenseEntry } from '@/features/expenses/components/FastExpenseEntry';

export default function NewExpensePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      router.back();
      dispatch(openQuickAdd({ tab: 'expense' }));
    }
  }, [dispatch, router]);

  return <FastExpenseEntry />;
}
