'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAppDispatch } from '@/store/store';
import { openQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { FastExpenseEntry } from '@/features/expenses/components/FastExpenseEntry';
import { PARSER_CURRENCIES } from '@/features/ai/expenseParser/schema';

export default function NewExpensePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromChat = searchParams.get('fromChat') === 'true';

  useEffect(() => {
    if (window.innerWidth >= 1024 && !fromChat) {
      router.back();
      dispatch(openQuickAdd({ tab: 'expense' }));
    }
  }, [dispatch, router, fromChat]);

  const initialCurrency = PARSER_CURRENCIES.find((value) => value === searchParams.get('currency'));
  const rawAmount = searchParams.get('amount');
  const initialAmount = rawAmount ? parseFloat(rawAmount) : undefined;
  const initialStore = searchParams.get('storeName') ?? undefined;
  const initialStoreId = searchParams.get('storeId') ?? undefined;
  const initialStoreGroup = searchParams.get('storeGroup') ?? undefined;
  const initialFolderId = searchParams.get('folderId') ?? undefined;
  const initialFolderName = searchParams.get('folderName') ?? undefined;
  const initialDate = searchParams.get('date') ?? undefined;
  const initialUserMsgId = searchParams.get('userMsgId') ?? undefined;
  const initialMode = searchParams.get('mode') === 'split' ? 'split' as const : undefined;

  return (
    <FastExpenseEntry
      fromChat={fromChat}
      initialAmount={initialAmount}
      initialCurrency={initialCurrency}
      initialStore={initialStore}
      initialStoreId={initialStoreId}
      initialStoreGroup={initialStoreGroup}
      initialFolderId={initialFolderId}
      initialFolderName={initialFolderName}
      initialDate={initialDate}
      initialUserMsgId={initialUserMsgId}
      initialMode={initialMode}
    />
  );
}
