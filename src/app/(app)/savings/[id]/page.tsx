'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { differenceInDays, format, parseISO } from 'date-fns';
import { Lock, Search, Users } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { removeGoalItem } from '@/features/savings/store/savingsSlice';
import { deleteGoal, fetchGoalById } from '@/features/savings/services/savingsService';
import { GoalIcon } from '@/features/savings/components/GoalIcon';
import { formatAmount } from '@/shared/utils/currency';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { useT } from '@/shared/hooks/useT';

export default function SavingsGoalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const reduxGoal = useAppSelector((s) => s.savings.list.find((item) => item.id === id));
  const [loadedGoal, setLoadedGoal] = useState<typeof reduxGoal>(undefined);
  const [loading, setLoading] = useState(!reduxGoal);
  const goal = reduxGoal ?? loadedGoal;
  const t = useT();
  const dfLocale = useDateFnsLocale();

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

  const pct = Math.min(100, goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0);
  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
  const daysLeft = goal.deadline ? differenceInDays(parseISO(goal.deadline), new Date()) : null;
  const done = pct >= 100;

  async function handleDelete() {
    if (!user || !goal || !confirm(t('savings.confirmDelete'))) return;
    await deleteGoal(user.id, goal.id);
    dispatch(removeGoalItem(goal.id));
    router.back();
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-5">
      <div className="flex min-h-11 items-center justify-between">
        <button onClick={() => router.back()} className="fb-touch-target text-sm text-muted-foreground">
          {t('savings.back')}
        </button>
        <button
          onClick={() => router.push(`/savings/${id}/edit`)}
          className="fb-touch-target text-sm font-medium text-primary hover:underline"
        >
          {t('common.edit')}
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
        <GoalIcon icon={goal.icon} color={goal.color} size="lg" />
        <div className="text-center">
          <h1 className="text-lg font-bold">{goal.name}</h1>
          <p className="mt-1 text-3xl font-black tabular-nums" style={{ color: done ? '#10b981' : goal.color }}>
            {pct.toFixed(0)}%
          </p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? '#10b981' : goal.color }} />
        </div>
        <div className="flex w-full justify-between text-sm tabular-nums">
          <span className="font-semibold" style={{ color: goal.color }}>{formatAmount(goal.currentAmount, goal.currency)}</span>
          <span className="text-muted-foreground">{formatAmount(goal.targetAmount, goal.currency)}</span>
        </div>
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        <DetailRow label={t('savings.toGo')} value={done ? t('savings.done') : formatAmount(remaining, goal.currency)} />
        {goal.deadline && (
          <DetailRow
            label={t('savings.deadline')}
            value={`${format(parseISO(goal.deadline), 'd MMMM yyyy', { locale: dfLocale })}${daysLeft !== null && daysLeft > 0 ? ` · ${daysLeft} ${t('savings.remaining')}` : ''}`}
          />
        )}
        <DetailRow
          label={t('expense.privacy2')}
          value={(
            <span className="inline-flex items-center gap-1.5">
              {goal.isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
              {goal.isPrivate ? t('expense.secret') : t('expense.regular')}
            </span>
          )}
        />
      </div>

      {!done && (
        <button
          onClick={() => router.push(`/savings/contribute?goalId=${goal.id}`)}
          className="min-h-11 rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground"
        >
          {t('savings.addContribution')}
        </button>
      )}

      {goal.contributions.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <p className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('savings.history')}
          </p>
          <div className="divide-y divide-border">
            {[...goal.contributions].reverse().map((contribution, index) => (
              <div key={contribution.id ?? index} className="flex min-h-11 items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{formatAmount(contribution.amount, goal.currency)}</p>
                  {(contribution.note || contribution.byName) && (
                    <p className="text-xs text-muted-foreground">{[contribution.note, contribution.byName].filter(Boolean).join(' · ')}</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{format(parseISO(contribution.date), 'd MMM yyyy', { locale: dfLocale })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleDelete}
        className="min-h-11 rounded-2xl border border-destructive/40 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        {t('savings.delete')}
      </button>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
