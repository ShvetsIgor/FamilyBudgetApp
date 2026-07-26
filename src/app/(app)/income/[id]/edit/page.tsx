'use client';
import { Search } from 'lucide-react';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/store';
import { useT } from '@/shared/hooks/useT';
import { FastIncomeEntry } from '@/features/income/components/FastIncomeEntry';
import { fetchIncomeById } from '@/features/income/services/incomeService';
import type { SerializableIncome } from '@/shared/types';

export default function EditIncomePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const reduxIncome = useAppSelector((s) => s.income.list.find((i) => i.id === id));
  const [loadedIncome, setLoadedIncome] = useState<SerializableIncome | undefined>();
  const [loading, setLoading] = useState(!reduxIncome);
  const income = reduxIncome ?? loadedIncome;
  const t = useT();

  useEffect(() => {
    if (reduxIncome || !user) return;
    fetchIncomeById(user.id, id)
      .then((item) => setLoadedIncome(item ?? undefined))
      .finally(() => setLoading(false));
  }, [id, reduxIncome, user]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;
  }

  if (!income) {
    return (
      <div className="flex flex-col items-center py-20 px-4 text-center">
        <Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground" strokeWidth={1.6} />
        <p className="font-medium">{t('common.entryNotFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  return <FastIncomeEntry initialIncome={income} />;
}
