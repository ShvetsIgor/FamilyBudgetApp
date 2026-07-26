'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { removeIncome } from '@/features/income/store/incomeSlice';
import { deleteIncome, fetchIncomeById } from '@/features/income/services/incomeService';
import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
import { paymentMethodIcon } from '@/shared/config/domainIcons';
import { formatAmount } from '@/shared/utils/currency';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { useT } from '@/shared/hooks/useT';

export default function IncomeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const reduxIncome = useAppSelector((s) => s.income.list.find((item) => item.id === id));
  const [loadedIncome, setLoadedIncome] = useState<typeof reduxIncome>(undefined);
  const [loading, setLoading] = useState(!reduxIncome);
  const income = reduxIncome ?? loadedIncome;
  const categories = useAppSelector((s) => s.categories.income);
  const t = useT();
  const dfLocale = useDateFnsLocale();

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
      <div className="flex flex-col items-center px-4 py-20 text-center">
        <Search className="mb-3 h-9 w-9 text-muted-foreground" strokeWidth={1.6} />
        <p className="font-medium">{t('common.entryNotFound')}</p>
        <button onClick={() => router.back()} className="mt-4 text-sm text-primary hover:underline">
          {t('common.back')}
        </button>
      </div>
    );
  }

  const category = categories.find((item) => item.id === income.categoryId);

  async function handleDelete() {
    if (!user || !income || !confirm(t('income.confirmDelete'))) return;
    await deleteIncome(user.id, income);
    dispatch(removeIncome(income.id));
    router.back();
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-8 pt-5">
      <div className="flex min-h-11 items-center justify-between">
        <button onClick={() => router.back()} className="fb-touch-target text-sm text-muted-foreground">
          {t('income.back')}
        </button>
        <button
          onClick={() => router.push(`/income/${id}/edit`)}
          className="fb-touch-target text-sm font-medium text-primary hover:underline"
        >
          {t('income.edit')}
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-6">
        {category && <CategoryIcon icon={category.icon} color={category.color} size="lg" />}
        <p className="text-3xl font-bold tabular-nums text-emerald-500">
          +{formatAmount(income.amount, income.currency)}
        </p>
        <p className="text-sm text-muted-foreground">
          {format(parseISO(income.date), 'EEEE, d MMMM yyyy', { locale: dfLocale })}
        </p>
      </div>

      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        <DetailRow label={t('income.category')} value={category ? t.cat(category.name) : '—'} />
        <DetailRow
          label={t('income.method')}
          value={(
            <span className="inline-flex items-center gap-2">
              <StickerIcon
                icon={paymentMethodIcon(income.method)}
                color="hsl(var(--muted-foreground))"
                className="h-4 w-4"
              />
              {t(income.method === 'bank' ? 'income.bank' : `expense.${income.method}`)}
            </span>
          )}
        />
        <DetailRow
          label={t('expense.privacy2')}
          value={income.privacy === 'secret' ? t('expense.secret') : t('expense.regular')}
        />
        {income.comment && <DetailRow label={t('income.comment')} value={income.comment} />}
        {income.tags.length > 0 && <DetailRow label={t('expense.tags')} value={income.tags.join(', ')} />}
      </div>

      <button
        onClick={handleDelete}
        className="min-h-11 rounded-2xl border border-destructive/40 bg-destructive/5 py-3.5 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        {t('common.delete')}
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
