'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setIncome, prependIncome, removeIncome, updateIncome as updateIncomeAction } from '@/features/income/store/incomeSlice';
import { fetchMonthIncome, addIncome, updateIncome, deleteIncome } from '@/features/income/services/incomeService';
import { fetchRecurringIncome, advanceRecurringIncomeNextDue } from '@/features/income/services/recurringIncomeService';
import { IncomeCard } from '@/features/income/components/IncomeCard';
import { IncomeForm } from '@/features/income/components/IncomeForm';
import { formatAmount } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import type { SerializableIncome } from '@/shared/types';
import type { AddIncomeInput } from '@/features/income/services/incomeService';
import { useT } from '@/shared/hooks/useT';

function groupByDate(items: SerializableIncome[]): [string, SerializableIncome[]][] {
  const map = new Map<string, SerializableIncome[]>();
  for (const item of items) {
    const day = format(parseISO(item.date), 'yyyy-MM-dd');
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return Array.from(map.entries());
}

function dayLabel(dateStr: string, t: ReturnType<typeof useT>): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return t('common.today');
  if (isYesterday(d)) return t('common.yesterday');
  return format(d, 'EEEE, d MMMM', { locale: ru });
}

function getYearMonths(): string[] {
  const now = new Date();
  const currentMonth = format(now, 'yyyy-MM');
  const months: string[] = [];
  for (let m = 0; m <= 11; m++) {
    const d = new Date(now.getFullYear(), m, 1);
    const key = format(d, 'yyyy-MM');
    months.push(key);
    if (key === currentMonth) break;
  }
  return months;
}

export default function IncomePage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: reduxIncomes, status: incStatus } = useAppSelector((s) => s.income);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const yearMonths = getYearMonths();

  const [showForm, setShowForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState<SerializableIncome | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [localIncomes, setLocalIncomes] = useState<SerializableIncome[] | null>(null);
  const monthBarRef = useRef<HTMLDivElement>(null);

  const isCurrentMonth = selectedMonth === currentMonth;
  const incomes = isCurrentMonth ? reduxIncomes : (localIncomes ?? []);
  const formOpen = showForm || !!editingIncome;

  const loadCurrentIncomes = useCallback(async () => {
    if (!user || incStatus !== 'idle') return;
    dispatch(setIncome(await fetchMonthIncome(user.id, currentMonth)));

    // Auto-apply any due recurring incomes
    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const recurring = await fetchRecurringIncome(user.id);
      for (const item of recurring) {
        if (!item.isActive || item.nextDueDate > todayStr) continue;
        const [y, m, d] = item.nextDueDate.split('-').map(Number);
        const income = await addIncome({
          userId: user.id,
          amount: item.amount,
          currency: item.currency,
          categoryId: item.categoryId,
          date: new Date(y, m - 1, d, 12, 0, 0),
          method: 'bank',
          privacy: 'regular',
          comment: item.name,
        });
        dispatch(prependIncome(income));
        await advanceRecurringIncomeNextDue(user.id, item);
      }
    } catch { /* silent */ }
  }, [user, currentMonth, incStatus, dispatch]);

  useEffect(() => { loadCurrentIncomes(); }, [loadCurrentIncomes]);

  useEffect(() => {
    if (isCurrentMonth) { setLocalIncomes(null); return; }
    if (!user) return;
    setLoading(true);
    fetchMonthIncome(user.id, selectedMonth)
      .then(setLocalIncomes)
      .finally(() => setLoading(false));
  }, [selectedMonth, isCurrentMonth, user]);

  useEffect(() => {
    const bar = monthBarRef.current;
    if (!bar) return;
    const chip = bar.querySelector(`[data-month="${selectedMonth}"]`) as HTMLElement | null;
    if (chip) chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedMonth]);

  async function handleAdd(data: Omit<AddIncomeInput, 'userId'>) {
    if (!user) return;
    dispatch(prependIncome(await addIncome({ ...data, userId: user.id })));
    setShowForm(false);
  }

  async function handleEdit(data: Omit<AddIncomeInput, 'userId'>) {
    if (!user || !editingIncome) return;
    dispatch(updateIncomeAction(await updateIncome({ ...data, userId: user.id, id: editingIncome.id })));
    setEditingIncome(null);
  }

  async function handleDelete(income: SerializableIncome) {
    if (!user || !confirm('Удалить эту запись?')) return;
    await deleteIncome(user.id, income);
    dispatch(removeIncome(income.id));
  }

  const monthTotal = incomes.reduce((s, i) => s + i.amount, 0);
  const groups = groupByDate(incomes);

  const formPanel = (
    <IncomeForm
      initialIncome={editingIncome ?? undefined}
      onSave={editingIncome ? handleEdit : handleAdd}
      onCancel={() => { setShowForm(false); setEditingIncome(null); }}
    />
  );

  return (
    <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start">

      {/* ── List column ── */}
      <div className={cn('lg:col-span-2 flex flex-col', formOpen && 'hidden lg:flex')}>

        {/* Header */}
        <div className="px-4 pt-5 pb-2 flex items-center justify-between lg:px-0 lg:pt-0">
          <div>
            <h1 className="text-xl font-bold">{t('nav.income')}</h1>
            <p className="text-sm text-muted-foreground capitalize">
              {format(parseISO(selectedMonth + '-01'), 'LLLL yyyy', { locale: ru })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{t('expenses.total')}</p>
            <p className="text-lg font-bold text-emerald-500">
              {monthTotal > 0 ? '+' : ''}{formatAmount(monthTotal, currency)}
            </p>
          </div>
        </div>

        {/* Month bar */}
        <div
          ref={monthBarRef}
          className="flex gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [-webkit-overflow-scrolling:touch] lg:px-0"
        >
          {yearMonths.map((m) => {
            const sel = m === selectedMonth;
            const label = format(parseISO(m + '-01'), 'LLL', { locale: ru });
            return (
              <button
                key={m}
                data-month={m}
                onClick={() => setSelectedMonth(m)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1 text-xs font-bold capitalize transition-colors',
                  sel ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}

        {/* Empty state */}
        {!loading && incomes.length === 0 && (
          <div className="flex flex-col items-center py-16 px-8 text-center">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-medium">{t('income.noIncome')}</p>
            {isCurrentMonth && (
              <button
                onClick={() => router.push('/income/new')}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                {t('income.addIncome')}
              </button>
            )}
          </div>
        )}

        {/* Income groups */}
        {!loading && incomes.length > 0 && (
          <div className="flex flex-col gap-2 pb-4">
            {groups.map(([day, items]) => {
              const dayTotal = items.reduce((s, i) => s + i.amount, 0);
              return (
                <div key={day} className="rounded-2xl bg-card border border-border overflow-hidden mx-4 lg:mx-0">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {dayLabel(day, t)}
                    </span>
                    <span className="text-xs font-semibold text-emerald-500 tabular-nums">
                      +{formatAmount(dayTotal, currency)}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {items.map((i) => (
                      <IncomeCard
                        key={i.id}
                        income={i}
                        onEdit={() => setEditingIncome(i)}
                        onDelete={() => handleDelete(i)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Add more button */}
            {isCurrentMonth && (
              <div className="px-4 lg:px-0">
                <button
                  onClick={() => router.push('/income/new')}
                  className="lg:hidden w-full rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  + {t('income.addMore')}
                </button>
                <button
                  onClick={() => setShowForm(true)}
                  className="hidden lg:block w-full rounded-2xl border border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  + {t('income.addMore')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right column / Form ── */}
      <div>
        {/* Desktop sidebar */}
        <div className="hidden lg:block sticky top-6">
          {formOpen ? (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h2 className="font-semibold text-sm">
                  {editingIncome ? t('income.editTitle') : t('income.title')}
                </h2>
                <button
                  onClick={() => { setShowForm(false); setEditingIncome(null); }}
                  className="text-muted-foreground text-xs hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              {formPanel}
            </div>
          ) : null}
        </div>
      </div>

      {/* Mobile FAB */}
      {!formOpen && isCurrentMonth && (
        <button
          onClick={() => router.push('/income/new')}
          className="lg:hidden fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
          style={{ background: 'hsl(var(--primary))' }}
        >
          <Plus size={24} color="white" />
        </button>
      )}
    </div>
  );
}
