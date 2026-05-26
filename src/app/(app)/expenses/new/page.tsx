'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { openQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { FastExpenseEntry } from '@/features/expenses/components/FastExpenseEntry';

export default function NewExpensePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (window.innerWidth >= 1024) {
      router.back();
      dispatch(openQuickAdd({ tab: 'expense' }));
    }
  }, [dispatch, router]);

  const fromChat = searchParams.get('fromChat') === 'true';
  const rawAmount = searchParams.get('amount');
  const initialAmount = rawAmount ? parseFloat(rawAmount) : undefined;
  const initialStore = searchParams.get('storeName') ?? undefined;
  const initialStoreId = searchParams.get('storeId') ?? undefined;
  const initialStoreGroup = searchParams.get('storeGroup') ?? undefined;
  const initialFolderId = searchParams.get('folderId') ?? undefined;
  const initialFolderName = searchParams.get('folderName') ?? undefined;

  return (
    <FastExpenseEntry
      fromChat={fromChat}
      initialAmount={initialAmount}
      initialStore={initialStore}
      initialStoreId={initialStoreId}
      initialStoreGroup={initialStoreGroup}
      initialFolderId={initialFolderId}
      initialFolderName={initialFolderName}
    />
  );
}
