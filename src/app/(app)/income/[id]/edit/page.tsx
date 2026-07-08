'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { useT } from '@/shared/hooks/useT';
import { FastIncomeEntry } from '@/features/income/components/FastIncomeEntry';

export default function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const income = useAppSelector((s) => s.income.list.find((i) => i.id === id));
  const t = useT();

  if (!income) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="font-medium">{t('common.entryNotFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  return <FastIncomeEntry initialIncome={income} />;
}
