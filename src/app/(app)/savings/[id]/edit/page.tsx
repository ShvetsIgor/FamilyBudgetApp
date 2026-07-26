'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useAppSelector } from '@/store/store';
import { FastGoalEntry } from '@/features/savings/components/FastGoalEntry';
import { fetchGoalById } from '@/features/savings/services/savingsService';
import { useT } from '@/shared/hooks/useT';
import type { SavingsGoal } from '@/shared/types';

export default function EditSavingsGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const reduxGoal = useAppSelector((s) => s.savings.list.find((item) => item.id === id));
  const [loadedGoal, setLoadedGoal] = useState<SavingsGoal | undefined>();
  const [loading, setLoading] = useState(!reduxGoal);
  const goal = reduxGoal ?? loadedGoal;
  const t = useT();

  useEffect(() => {
    if (reduxGoal || !user) return;
    fetchGoalById(user.id, id)
      .then((item) => setLoadedGoal(item ?? undefined))
      .finally(() => setLoading(false));
  }, [id, reduxGoal, user]);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>;
  }

  if (!goal) {
    return (
      <div className="flex flex-col items-center px-4 py-20 text-center">
        <Search className="mb-3 h-9 w-9 text-muted-foreground" strokeWidth={1.6} />
        <p className="font-medium">{t('common.entryNotFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  return <FastGoalEntry initialGoal={goal} />;
}
