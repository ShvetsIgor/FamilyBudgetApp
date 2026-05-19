'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { FastIncomeEntry } from '@/features/income/components/FastIncomeEntry';

export default function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const income = useAppSelector((s) => s.income.list.find((i) => i.id === id));

  if (!income) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <p className="text-4xl mb-3">🔍</p>
        <p className="font-medium">Запись не найдена</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          Назад
        </button>
      </div>
    );
  }

  return <FastIncomeEntry initialIncome={income} />;
}
