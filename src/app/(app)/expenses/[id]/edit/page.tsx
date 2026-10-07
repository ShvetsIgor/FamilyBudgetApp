'use client';
import { useExpenseById } from '@/features/expenses/hooks/useExpenseById';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { Search } from 'lucide-react';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { FastExpenseEntry } from '@/features/expenses/components/FastExpenseEntry';
import { useT } from '@/shared/hooks/useT';

export default function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { expense, loading, error } = useExpenseById(id);
  const t = useT();

  if (loading) return <LoadingScreen />;
  if (!expense) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground" strokeWidth={1.6} />
        <p className="font-medium">{t(error ? 'common.error' : 'expense.notFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          {t('expense.goBack')}
        </button>
      </div>
    );
  }

  return <FastExpenseEntry initialExpense={expense} />;
}
