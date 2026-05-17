'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { FastExpenseEntry } from '@/features/expenses/components/FastExpenseEntry';
import { useT } from '@/shared/hooks/useT';

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const expense = useAppSelector((s) => s.expenses.list.find((e) => e.id === id));
  const t = useT();

  if (!expense) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="font-medium">{t('expense.notFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          {t('expense.goBack')}
        </button>
      </div>
    );
  }

  return <FastExpenseEntry initialExpense={expense} />;
}
