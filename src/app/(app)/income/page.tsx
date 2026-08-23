'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import type { Locale } from 'date-fns';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { Plus } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { prependIncome, removeIncome, updateIncome as updateIncomeAction } from '@/features/income/store/incomeSlice';
import { fetchMonthIncome, addIncome, updateIncome, deleteIncome } from '@/features/income/services/incomeService';
import { IncomeCard } from '@/features/income/components/IncomeCard';
import { IncomeForm } from '@/features/income/components/IncomeForm';
import { formatAmount } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import type { SerializableIncome } from '@/shared/types';
import type { AddIncomeInput } from '@/features/income/services/incomeService';
import { useT } from '@/shared/hooks/useT';
import { buildMemberColorMap } from '@/features/family/utils/memberColors';
import { fetchFamilyMonthIncomes, type FamilyIncome, type FamilyIncomeData } from '@/features/family/services/familyBudgetService';
import { groupByCurrency, formatCurrencyTotals } from '@/features/family/utils/familyCurrency';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';

function groupByDate(items: SerializableIncome[]): [string, SerializableIncome[]][] {
  const map = new Map<string, SerializableIncome[]>();
  for (const item of items) {
    const day = format(parseISO(item.date), 'yyyy-MM-dd');
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return Array.from(map.entries());
}

function dayLabel(dateStr: string, t: ReturnType<typeof useT>, locale: Locale): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return t('common.today');
  if (isYesterday(d)) return t('common.yesterday');
  return format(d, 'EEEE, d MMMM', { locale });
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
  const dfLocale = useDateFnsLocale();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { list: reduxIncomes } = useAppSelector((s) => s.income);

  const currentMonth = format(new Date(), 'yyyy-MM');
  const yearMonths = getYearMonths();

  const [showForm, setShowForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState<SerializableIncome | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [localIncomes, setLocalIncomes] = useState<SerializableIncome[] | null>(null);
  const incomeCategories = useAppSelector((st) => st.categories.income);
  const family = useAppSelector((st) => st.family.family);
  const members = useAppSelector((st) => st.family.members);
  const [viewMode, setViewMode] = useState<'mine' | 'family'>('mine');
  const [familyData, setFamilyData] = useState<FamilyIncomeData | null>(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const memberColorMap = buildMemberColorMap(members);
  const familyAvailable = !!family && members.length > 1;
  const isFamilyView = viewMode === 'family' && familyAvailable;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fetch starts here; this app has no server loader, everything comes from Firestore on the client
    if (!isFamilyView || !user) { setFamilyData(null); return; }
    setFamilyLoading(true);
    fetchFamilyMonthIncomes(members, selectedMonth, user.id, incomeCategories)
      .then(setFamilyData)
      .catch(() => setFamilyData({ incomes: [], categoryMeta: {} }))
      .finally(() => setFamilyLoading(false));
  }, [isFamilyView, user, members, selectedMonth, incomeCategories]);
  const monthBarRef = useRef<HTMLDivElement>(null);

  const isCurrentMonth = selectedMonth === currentMonth;
  const incomes = isCurrentMonth ? reduxIncomes : (localIncomes ?? []);
  const formOpen = showForm || !!editingIncome;

  // Current-month incomes (incl. due recurring generation) are loaded once on
  // app start by the (app) layout via loadCurrentMonthIncomes — no local fetch
  // here, a second concurrent run would duplicate recurring occurrences.

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the fetch starts here; this app has no server loader, everything comes from Firestore on the client
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
    dispatch(updateIncomeAction(await updateIncome({
      ...data,
      tags: editingIncome.tags,
      userId: user.id,
      id: editingIncome.id,
      previous: editingIncome,
    })));
    setEditingIncome(null);
  }

  async function handleDelete(income: SerializableIncome) {
    if (!user || !confirm(t('income.confirmDelete'))) return;
    await deleteIncome(user.id, income);
    dispatch(removeIncome(income.id));
  }

  const familyIncomes = familyData?.incomes ?? [];
  const familyTotals = groupByCurrency(familyIncomes);
  const personalTotals = groupByCurrency(incomes);
  const visibleTotals = isFamilyView ? familyTotals : personalTotals;
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

        {/* Header — architectural */}
        <div className="px-4 pt-6 pb-4 lg:px-0 lg:pt-0" style={{ borderBottom: '2px solid hsl(var(--foreground))', background: 'hsl(var(--card))' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
            {format(parseISO(selectedMonth + '-01'), 'LLLL yyyy', { locale: dfLocale })}
          </p>
          <div style={{ fontSize: visibleTotals.length > 1 ? 26 : 44, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#18A957' }}>
            {visibleTotals.length > 0
              ? formatCurrencyTotals(visibleTotals, { sign: '+', fallback: currency })
              : formatAmount(0, currency)}
          </div>
        </div>

        {/* Mine / Family toggle */}
        {familyAvailable && (
          <div className="px-4 pt-3 lg:px-0" style={{ background: 'hsl(var(--card))' }}>
            <div className="inline-flex rounded-full bg-muted p-0.5">
              {(['mine', 'family'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`min-h-11 rounded-full px-4 text-sm font-bold transition-colors ${viewMode === m ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}
                  aria-pressed={viewMode === m}
                >
                  {m === 'mine' ? t('expenses.viewMine') : t('expenses.viewFamily')}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Month bar */}
        <div
          ref={monthBarRef}
          className="flex gap-1.5 overflow-x-auto px-4 pt-3 pb-2 scrollbar-none [-webkit-overflow-scrolling:touch] lg:px-0"
          style={{ background: 'hsl(var(--card))' }}
        >
          {yearMonths.map((m) => {
            const sel = m === selectedMonth;
            const label = format(parseISO(m + '-01'), 'LLL', { locale: dfLocale });
            return (
              <button
                key={m}
                data-month={m}
                onClick={() => setSelectedMonth(m)}
                className={cn(
                  'min-h-11 shrink-0 rounded-full px-3.5 text-sm font-bold capitalize transition-colors',
                  sel ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {(loading || familyLoading) && (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        )}

        {/* Empty state */}
        {!isFamilyView && !loading && incomes.length === 0 && (
          <div className="flex flex-col items-center py-16 px-8 text-center">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-medium">{t('income.noIncome')}</p>
          </div>
        )}

        {/* Income groups */}
        {!isFamilyView && !loading && incomes.length > 0 && (
          <div className="flex flex-col pb-4">
            {groups.map(([day, items]) => {
              const dayTotals = groupByCurrency(items);
              return (
                <div key={day} className="border-b border-border/30">
                  <div className="flex items-center justify-between px-4 py-2 lg:px-0" style={{ background: 'hsl(var(--muted)/0.4)' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, color: 'hsl(var(--muted-foreground))' }}>
                      {dayLabel(day, t, dfLocale)}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#18A957' }}>
                      {formatCurrencyTotals(dayTotals, { sign: '+', fallback: currency })}
                    </span>
                  </div>
                  <div className="divide-y divide-border/20">
                    {items.map((i) => (
                      <IncomeCard
                        key={i.id}
                        income={i}
                        onEdit={() => {
                          if (window.innerWidth < 1024) router.push(`/income/${i.id}`);
                          else setEditingIncome(i);
                        }}
                        onDelete={() => handleDelete(i)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Family income groups */}
        {isFamilyView && !familyLoading && familyIncomes.length === 0 && (
          <div className="flex flex-col items-center py-16 px-8 text-center">
            <p className="text-4xl mb-3">👨‍👩‍👧</p>
            <p className="font-medium">{t('income.familyEmpty')}</p>
          </div>
        )}
        {isFamilyView && !familyLoading && familyIncomes.length > 0 && (
          <div className="flex flex-col pb-4">
            {groupByDate(familyIncomes).map(([day, items]) => {
              const rows = items as FamilyIncome[];
              // Per-currency day total — members may earn in different currencies
              const dayTotals = groupByCurrency(rows);
              return (
                <div key={day} className="border-b border-border/30">
                  <div className="flex items-center justify-between px-4 py-2 lg:px-0" style={{ background: 'hsl(var(--muted)/0.4)' }}>
                    <span style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800, color: 'hsl(var(--muted-foreground))' }}>
                      {dayLabel(day, t, dfLocale)}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#18A957' }}>
                      {formatCurrencyTotals(dayTotals, { sign: '+', fallback: currency })}
                    </span>
                  </div>
                  <div className="divide-y divide-border/20">
                    {rows.map((i) => {
                      const meta = familyData?.categoryMeta[i.categoryId];
                      const isMine = i.memberId === user?.id;
                      return (
                        <div key={`${i.memberId}-${i.id}`} className="flex items-center gap-3 px-4 py-3 lg:px-0">
                          <StickerIcon icon={meta?.icon ?? 'cash'} color={meta?.color ?? '#18A957'} className="h-9 w-9 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {i.comment || (meta ? t.cat(meta.name) : t('nav.income'))}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {meta ? t.cat(meta.name) : '—'} · <span style={{ color: memberColorMap[i.memberId] }}>●</span> <span style={{ color: memberColorMap[i.memberId], fontWeight: 700 }}>{isMine ? t('expenses.you') : i.memberName}</span>
                            </p>
                          </div>
                          <span className="text-sm font-extrabold tabular-nums" style={{ color: '#18A957' }}>+{formatAmount(i.amount, i.currency)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
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

      {/* Mobile FAB — available in past months too; the form's own date
          picker decides which day the income lands on */}
      {!formOpen && !isFamilyView && (
        <button
          onClick={() => router.push('/income/new')}
          aria-label={t('income.add')}
          className="lg:hidden fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
          style={{ background: 'hsl(var(--primary))' }}
        >
          <Plus size={24} color="white" />
        </button>
      )}
    </div>
  );
}
