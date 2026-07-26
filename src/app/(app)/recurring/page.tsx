'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { format, parseISO, differenceInCalendarDays, isToday, isYesterday, subMonths } from 'date-fns';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { X, Calendar, MessageSquare, Plus, ChevronRight } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import {
  setRecurring, addRecurringItem, removeRecurringItem, updateRecurringItem, toggleRecurringItem,
} from '@/features/recurring/store/recurringSlice';
import {
  fetchRecurring, addRecurring, updateRecurring, deleteRecurring, toggleRecurring,
  markAsPaid, advanceToNextFutureDue, completeRecurring, updateRecurringAmount,
  type AddRecurringInput,
} from '@/features/recurring/services/recurringService';
import { groupByCurrency, formatCurrencyTotals } from '@/features/family/utils/familyCurrency';
import { toLocalMonthKey } from '@/shared/utils/dateKey';
import { detectSubscriptionCandidates, type SubscriptionCandidate } from '@/features/recurring/utils/subscriptionDetect';
import { addExpense, fetchMonthExpenses } from '@/features/expenses/services/expensesService';
import { resolveExpensePrivacy } from '@/features/expenses/utils/expensePrivacy';
import { prependExpense, mergeExpenses } from '@/features/expenses/store/expensesSlice';
import { CategoryEditorSheet } from '@/features/categories/components/CategoryEditorSheet';
import { CategoryFolderPickerSheet } from '@/features/categories/components/CategoryFolderPickerSheet';
import { FolderEditorSheet } from '@/features/categories/components/FolderEditorSheet';
import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
import { RECURRING_TYPE_ICONS } from '@/shared/config/domainIcons';
import { haptic } from '@/shared/utils/haptics';
import type { IconKey } from '@/features/categories/icons/icons';
import {
  addCategory as addCategoryAction,
  addFolder as addFolderAction,
  updateCategory as updateCategoryAction,
} from '@/features/categories/store/categoriesSlice';
import {
  addCategory as addCategoryToDb,
  addCategoryWithId,
  updateCategory as updateCategoryInDb,
} from '@/features/categories/services/categoriesService';
import {
  addFolder as addFolderToDb,
  addFolderWithId,
} from '@/features/categories/services/categoryFoldersService';
import {
  categoryBlueprintToSuggestion,
  findCategoryBlueprint,
  findFolderBlueprint,
  folderBlueprintToSuggestion,
  getCategoryLibraryBlueprints,
  getFolderLibraryBlueprints,
} from '@/features/categories/utils/libraryLookup';
import { formatAmount, parseLocalDate } from '@/shared/utils/currency';
import type { Currency } from '@/shared/types';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { MiniCalendar } from '@/shared/components/MiniCalendar';
import { cn } from '@/shared/utils/cn';
import { normalizeNameKey } from '@/shared/utils/normalizeName';
import { useT } from '@/shared/hooks/useT';
import { applyKey } from '@/features/expenses/hooks/useSplitEditor';
import {
  countOccurrences, isScheduleCompleted, monthlyEquivalent, occurrenceDate, paymentsLeft,
} from '@/features/recurring/utils/schedule';
import type {
  Category,
  CategoryFolder,
  RecurringFrequency,
  RecurringType,
  SerializableRecurringPayment,
} from '@/shared/types';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];

const CURRENCIES: Currency[] = ['ILS', 'USD', 'CAD', 'RUB'];

function daysUntil(dateStr: string): number {
  return differenceInCalendarDays(parseISO(dateStr), new Date());
}

function startOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function occursOnOrBeforeToday(date: Date): boolean {
  return startOfDay(date) <= startOfDay(new Date());
}

function toLocalNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}


/** Seed values when the add form opens from a detected-subscription card */
export interface RecurringPrefill {
  name: string;
  amount: number;
  currency: Currency;
  categoryId: string;
  frequency: RecurringFrequency;
  type: RecurringType;
  /** ISO — strictly future, so saving never backfills an already-logged charge */
  startDate: string;
}

type FormMode =
  | { mode: 'add'; prefill?: RecurringPrefill }
  | { mode: 'edit'; item: SerializableRecurringPayment };

export default function RecurringPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const language = useAppSelector((s) => s.ui.language);
  const categories = useAppSelector((s) => s.categories.expense);
  const { list, status } = useAppSelector((s) => s.recurring);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [loading, setLoading] = useState(false);
  // «Оплачено, но сумма изменилась» — inline amount editor per row
  const [payEdit, setPayEdit] = useState<{ id: string; value: string } | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<string[]>([]);
  const [pendingCandidateKey, setPendingCandidateKey] = useState<string | null>(null);
  const t = useT();
  const dfLocale = useDateFnsLocale();

  const FREQ: { value: RecurringFrequency; label: string }[] = [
    { value: 'monthly', label: t('recurring.monthly') },
    { value: 'weekly', label: t('recurring.weekly') },
    { value: 'yearly', label: t('recurring.yearly') },
    { value: 'daily', label: t('recurring.daily') },
  ];

  const TYPES: { value: RecurringType; label: string; icon: IconKey }[] = [
    { value: 'subscription', label: t('recurring.subscription'), icon: RECURRING_TYPE_ICONS.subscription },
    { value: 'rent', label: t('recurring.rent'), icon: RECURRING_TYPE_ICONS.rent },
    { value: 'utility', label: t('recurring.utility'), icon: RECURRING_TYPE_ICONS.utility },
    { value: 'credit', label: t('recurring.credit'), icon: RECURRING_TYPE_ICONS.credit },
    { value: 'mortgage', label: t('recurring.mortgage'), icon: RECURRING_TYPE_ICONS.mortgage },
    { value: 'installment', label: t('recurring.installment'), icon: RECURRING_TYPE_ICONS.installment },
    { value: 'custom', label: t('recurring.custom'), icon: RECURRING_TYPE_ICONS.custom },
  ];

  // Overdue items are NOT silently advanced anymore: a missed payment stays
  // visible as «Просрочено» until the user explicitly pays or skips it.
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      dispatch(setRecurring(await fetchRecurring(user.id)));
    } finally { setLoading(false); }
  }, [user, dispatch]);

  useEffect(() => { if (status === 'idle') load(); }, [status, load]);

  // Subscription detection needs a few months of history, not just the
  // current month that /home already loads (merge dedupes by id)
  useEffect(() => {
    if (!user) return;
    for (let i = 0; i < 4; i++) {
      fetchMonthExpenses(user.id, toLocalMonthKey(subMonths(new Date(), i)))
        .then((items) => dispatch(mergeExpenses(items)))
        .catch(() => {});
    }
  }, [user, dispatch]);

  // Per-user dismissed suggestion keys («не подписка / не предлагать»)
  useEffect(() => {
    if (!user) return;
    try {
      setDismissedKeys(JSON.parse(localStorage.getItem(`subs_suggest_dismissed_${user.id}`) ?? '[]'));
    } catch { setDismissedKeys([]); }
  }, [user]);

  const allExpenses = useAppSelector((s) => s.expenses.list);
  const candidates = useMemo(
    () => detectSubscriptionCandidates({ expenses: allExpenses, templates: list, dismissedKeys }).slice(0, 3),
    [allExpenses, list, dismissedKeys]
  );

  function dismissCandidate(key: string) {
    if (!user) return;
    const next = [...dismissedKeys, key];
    setDismissedKeys(next);
    try { localStorage.setItem(`subs_suggest_dismissed_${user.id}`, JSON.stringify(next)); } catch {}
  }

  function openCandidateForm(c: SubscriptionCandidate) {
    setPendingCandidateKey(c.key);
    setFormMode({
      mode: 'add',
      prefill: {
        name: c.displayName, amount: c.amount, currency: c.currency,
        categoryId: c.categoryId, frequency: 'monthly', type: 'subscription',
        startDate: c.suggestedStartDate,
      },
    });
  }

  function closeForm() {
    setFormMode(null);
    setPendingCandidateKey(null);
  }

  function openAddForm() {
    setPendingCandidateKey(null);
    setFormMode({ mode: 'add' });
  }

  async function handleSave(data: Omit<AddRecurringInput, 'userId'>) {
    if (!user) return;
    try {
      if (formMode?.mode === 'edit') {
        const { nextDueDate, isActive } = await updateRecurring(user.id, formMode.item.id, data);
        dispatch(updateRecurringItem({
          ...formMode.item, ...data,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate ? data.endDate.toISOString() : undefined,
          nextDueDate,
          currency: data.currency,
          ...(isActive === false ? { isActive } : {}),
        }));
      } else {
        const added = await addRecurring({ ...data, userId: user.id });
        // Saved from a detected-subscription card — stop suggesting this merchant
        if (pendingCandidateKey) {
          dismissCandidate(pendingCandidateKey);
          setPendingCandidateKey(null);
        }
        const shouldCreateInitialOccurrence = occursOnOrBeforeToday(data.startDate);
        if (shouldCreateInitialOccurrence) {
          try {
            const exp = await addExpense({
              userId: user.id, amount: data.amount, currency: data.currency,
              categoryId: data.categoryId, date: toLocalNoon(data.startDate),
              paymentMethod: 'card', splits: [], tags: ['recurring'],
              privacy: resolveExpensePrivacy({ categories, categoryId: data.categoryId }),
              store: data.name, comment: data.comment || undefined,
              recurringId: added.id,
              isRecurring: true,
            });
            dispatch(prependExpense(exp));
          } catch (expenseError) {
            await deleteRecurring(user.id, added.id).catch(() => {});
            throw expenseError;
          }
          try {
            dispatch(addRecurringItem(await advanceToNextFutureDue(user.id, added)));
          } catch {
            dispatch(addRecurringItem(added));
          }
        } else {
          dispatch(addRecurringItem(added));
        }
      }
      closeForm();
    } catch (e) {
      console.error('handleSave error:', e);
      throw e;
    }
  }

  async function handleMarkPaid(item: SerializableRecurringPayment, amountOverride?: number) {
    if (!user) return;
    const amount = amountOverride ?? item.amount;
    if (amount <= 0) return;
    try {
      if (item.categoryId) {
        const exp = await addExpense({
          userId: user.id, amount, currency: item.currency,
          categoryId: item.categoryId, date: parseISO(item.nextDueDate),
          paymentMethod: 'card', splits: [], tags: ['recurring'],
          privacy: resolveExpensePrivacy({ categories, categoryId: item.categoryId }),
          store: item.name,
          comment: item.comment || undefined,
          recurringId: item.id,
        });
        dispatch(prependExpense(exp));
      }
      // «Сумма изменилась»: the new price sticks to the template from now on
      if (amount !== item.amount) await updateRecurringAmount(user.id, item.id, amount);
      dispatch(updateRecurringItem(await markAsPaid(user.id, { ...item, amount })));
      haptic('success');
      setPayEdit(null);
    } catch (e) {
      console.error('handleMarkPaid error:', e);
    }
  }

  async function handleDelete(item: SerializableRecurringPayment) {
    if (!user || !confirm(`${t('recurring.confirmDelete')} "${item.name}"?`)) return;
    await deleteRecurring(user.id, item.id);
    dispatch(removeRecurringItem(item.id));
  }

  async function handleToggle(item: SerializableRecurringPayment) {
    if (!user) return;
    const next = !item.isActive;
    await toggleRecurring(user.id, item.id, next);
    dispatch(toggleRecurringItem({ id: item.id, isActive: next }));
  }

  // Skip a missed occurrence without creating an expense
  async function handleSkip(item: SerializableRecurringPayment) {
    if (!user) return;
    try {
      dispatch(updateRecurringItem(await advanceToNextFutureDue(user.id, item)));
    } catch (e) {
      console.error('handleSkip error:', e);
    }
  }

  // «Я отменил подписку» — terminate: no more dues, stays listed as completed
  async function handleFinish(item: SerializableRecurringPayment) {
    if (!user || !confirm(t('recurring.confirmFinish'))) return;
    try {
      const { endDate } = await completeRecurring(user.id, item.id);
      dispatch(updateRecurringItem({ ...item, endDate, isActive: false }));
      closeForm();
    } catch (e) {
      console.error('handleFinish error:', e);
    }
  }

  // Different currencies are never added into one number — totals are grouped
  // per currency (same rule as family analytics №15/16)
  const activeItems = list.filter((r) => r.isActive);
  const asMonthly = (items: SerializableRecurringPayment[]) =>
    items.map((r) => ({ amount: monthlyEquivalent(r.amount, r.frequency), currency: r.currency }));
  const monthlyTotals = groupByCurrency(asMonthly(activeItems));
  const primaryTotal = monthlyTotals[0];
  const otherTotals = monthlyTotals.slice(1);

  // Fixed commitments as a share of this month's income, in the primary
  // commitments currency only (no FX conversion on the free plan)
  const monthStr = toLocalMonthKey(new Date());
  const incomeList = useAppSelector((s) => s.income.list);
  const monthIncomeTotals = groupByCurrency(
    incomeList
      .filter((i) => toLocalMonthKey(i.date) === monthStr)
      .map((i) => ({ amount: i.amount, currency: i.currency }))
  );
  const primaryIncome = primaryTotal
    ? monthIncomeTotals.find((g) => g.currency === primaryTotal.currency)
    : undefined;
  const incomeShare = primaryTotal && primaryIncome && primaryIncome.total > 0
    ? Math.round((primaryTotal.total / primaryIncome.total) * 100)
    : 0;

  // Monthly-equivalent commitments per kind — the "where does it all go" line
  const typeTotals = TYPES
    .map((tp) => {
      const items = activeItems.filter((r) => r.type === tp.value);
      return {
        ...tp,
        count: items.length,
        text: formatCurrencyTotals(groupByCurrency(asMonthly(items)), { sign: '-', fallback: currency }),
      };
    })
    .filter((tp) => tp.count > 0);

  const headerTotals = (
    <>
      <div style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1, color: 'hsl(var(--destructive))' }}>
        {primaryTotal ? `-${formatAmount(primaryTotal.total, primaryTotal.currency)}` : formatAmount(0, currency)}
      </div>
      {(otherTotals.length > 0 || incomeShare > 0) && (
        <p style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
          {otherTotals.length > 0 && formatCurrencyTotals(otherTotals, { sign: '-', fallback: currency })}
          {otherTotals.length > 0 && incomeShare > 0 && ' · '}
          {incomeShare > 0 && `${incomeShare}% ${t('recurring.ofIncome')}`}
        </p>
      )}
    </>
  );

  const typeBreakdown = typeTotals.length > 1 ? (
    <div className="flex flex-wrap gap-1.5" style={{ marginTop: 10 }}>
      {typeTotals.map((tp) => (
        <span
          key={tp.value}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
        >
          <StickerIcon icon={tp.icon} color="hsl(var(--muted-foreground))" className="h-3.5 w-3.5" />
          <span>{tp.label}</span>
          <span className="tabular-nums text-foreground">{tp.text}</span>
        </span>
      ))}
    </div>
  ) : null;

  const listItems = list.map((item) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    const days = daysUntil(item.nextDueDate);
    const typeObj = TYPES.find((tp) => tp.value === item.type);
    const typeText = item.type === 'custom' && item.typeLabel ? item.typeLabel : typeObj?.label;
    const isSelected = formMode?.mode === 'edit' && formMode.item.id === item.id;
    const borderColor = cat?.color ?? 'hsl(var(--muted-foreground))';
    // Fixed-term progress (credits/installments): which payment is pending of how many
    const termTotal = item.endDate
      ? countOccurrences(parseISO(item.startDate), parseISO(item.endDate), item.frequency)
      : 0;
    const termCompleted = item.endDate ? isScheduleCompleted(item.nextDueDate, item.endDate) : false;
    const termPending = termTotal > 0 && !termCompleted
      ? termTotal - paymentsLeft(item.nextDueDate, item.endDate!, item.frequency) + 1
      : 0;
    return (
      <div
        key={item.id}
        className={cn(
          'flex w-full items-center gap-3 pl-3 pr-4 py-3.5 hover:bg-muted/30 transition-colors',
          !item.isActive && 'opacity-50',
          isSelected && 'bg-primary/5'
        )}
        style={{ borderLeft: `4px solid ${borderColor}` }}
      >
        <div className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer" onClick={() => setFormMode({ mode: 'edit', item })}>
          {cat ? <CategoryIcon icon={cat.icon} color={cat.color} size="md" /> : <CategoryIcon icon={typeObj?.icon ?? 'refund'} color={borderColor} size="md" />}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-semibold truncate leading-snug">{item.name}</p>
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
              {typeText && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground whitespace-nowrap">
                  <StickerIcon icon={typeObj?.icon ?? 'refund'} color="hsl(var(--muted-foreground))" className="h-3 w-3" />
                  {typeText}
                </span>
              )}
              <span style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, color: borderColor }}>
                {FREQ.find((f) => f.value === item.frequency)?.label}
              </span>
              <span className="text-muted-foreground/40">·</span>
              {termCompleted ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(152 60% 32%)' }}>{t('recurring.completed')}</span>
              ) : days < 0 ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--destructive))' }}>{t('recurring.overdueDays', { n: -days })}</span>
              ) : days === 0 ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--destructive))' }}>{t('recurring.dueToday')}</span>
              ) : days <= 3 ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(38 80% 36%)' }}>{t('recurring.inDays').replace('{n}', String(days))}</span>
              ) : (
                <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{format(parseISO(item.nextDueDate), 'd MMM', { locale: dfLocale })}</span>
              )}
              {termPending > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>
                    {t('recurring.paymentNofM', { n: termPending, m: termTotal })}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {payEdit?.id !== item.id && (
            <span style={{ fontSize: 18, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em' }}>
              {item.amount > 0 ? '-' : ''}{formatAmount(item.amount, item.currency)}
            </span>
          )}
          {item.isActive && days <= 0 && (
            payEdit?.id === item.id ? (
              <div className="flex items-center gap-1">
                <input
                  type="number" inputMode="decimal" min="0" step="0.01" autoFocus
                  value={payEdit.value}
                  onChange={(e) => setPayEdit({ id: item.id, value: e.target.value })}
                  className="w-20 min-h-11 rounded-xl border border-border bg-background px-2 text-right text-sm font-extrabold tabular-nums outline-none focus:border-primary"
                />
                <button
                  onClick={() => handleMarkPaid(item, parseFloat(payEdit.value) || 0)}
                  disabled={!(parseFloat(payEdit.value) > 0)}
                  aria-label={t('recurring.markPaid')}
                  className="min-h-11 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 text-sm font-bold hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                >✓</button>
                <button
                  onClick={() => setPayEdit(null)}
                  aria-label={t('recurring.cancel')}
                  className="min-h-11 w-9 rounded-xl bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors"
                >✕</button>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleMarkPaid(item)}
                  className="min-h-11 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-3 text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
                >
                  {t('recurring.markPaid')}
                </button>
                <button
                  onClick={() => setPayEdit({ id: item.id, value: String(item.amount) })}
                  className="min-h-11 rounded-xl bg-muted px-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {t('recurring.payDifferent')}
                </button>
                {days < 0 && (
                  <button
                    onClick={() => handleSkip(item)}
                    className="min-h-11 rounded-xl bg-muted px-3 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {t('recurring.skip')}
                  </button>
                )}
              </div>
            )
          )}
          <button
            onClick={() => handleToggle(item)}
            role="switch"
            aria-checked={item.isActive}
            className={`relative h-11 w-14 rounded-full transition-colors flex-shrink-0 ${item.isActive ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`absolute top-2.5 h-6 w-6 rounded-full bg-white shadow transition-all ${item.isActive ? 'left-7' : 'left-1.5'}`} />
          </button>
          <button onClick={() => handleDelete(item)} className="fb-touch-target flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={t('common.delete')}>✕</button>
        </div>
      </div>
    );
  });

  // Detected subscription-shaped merchants — suggestion only, adding opens
  // the prefilled form for explicit confirmation
  const candidatesBlock = candidates.length > 0 ? (
    <div className="px-4 pt-3 lg:px-0">
      <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-muted-foreground mb-1.5 px-0.5">
        {t('recurring.detectedTitle')}
      </p>
      <div className="flex flex-col gap-1.5">
        {candidates.map((c) => (
          <div key={c.key} className="flex items-center gap-3 rounded-[14px] border border-dashed border-border bg-card/60 px-3 py-2.5">
            <StickerIcon icon={RECURRING_TYPE_ICONS.subscription} color="hsl(var(--primary))" className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{c.displayName}</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                ~{formatAmount(c.amount, c.currency)}{t('recurring.perMonthShort')} · ×{c.occurrences}
              </p>
            </div>
            <button
              onClick={() => openCandidateForm(c)}
              className="min-h-11 shrink-0 rounded-xl bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/15 transition-colors"
            >
              {t('recurring.detectedAdd')}
            </button>
            <button
              onClick={() => dismissCandidate(c.key)}
              aria-label={t('common.close')}
              className="fb-touch-target flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const formPanel = formMode ? (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{formMode.mode === 'edit' ? t('recurring.editTitle') : t('recurring.newTitle')}</h2>
        <button onClick={closeForm} className="fb-touch-target flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={t('common.close')}>✕</button>
      </div>
      <RecurringForm
        initial={formMode.mode === 'edit' ? formMode.item : undefined}
        prefill={formMode.mode === 'add' ? formMode.prefill : undefined}
        onSave={handleSave} onCancel={closeForm}
        onFinish={formMode.mode === 'edit' && formMode.item.isActive ? () => handleFinish(formMode.item) : undefined}
        currency={currency} freq={FREQ} types={TYPES}
      />
    </div>
  ) : (
    <div className="hidden lg:flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center gap-3">
      <StickerIcon icon="refund" color="hsl(var(--muted-foreground))" className="h-8 w-8" />
      <p className="text-sm text-muted-foreground">{t('recurring.selectToEdit')}</p>
      <button
        onClick={openAddForm}
        className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        + {t('recurring.add')}
      </button>
    </div>
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="lg:hidden flex flex-col gap-0 pt-5 pb-24">
        <div className="px-4 pb-4" style={{ borderBottom: '2px solid hsl(var(--foreground))', background: 'hsl(var(--card))' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
            {t('recurring.title')}
          </p>
          {list.length > 0 && headerTotals}
          {typeBreakdown}
        </div>

        {candidatesBlock}

        {loading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>}
        {!loading && list.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <StickerIcon icon="refund" color="hsl(var(--muted-foreground))" className="mb-3 h-10 w-10" />
            <p className="font-medium">{t('recurring.noItems')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('recurring.noItemsHint')}</p>
          </div>
        )}
        {list.length > 0 && (
          <div className="divide-y divide-border/20 border-b border-border/30">{listItems}</div>
        )}

        {/* FAB */}
        <button
          onClick={openAddForm}
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
          style={{ background: 'hsl(var(--primary))' }}
        >
          <Plus size={24} color="white" />
        </button>

        {/* Full-screen overlay form */}
        {formMode && (
          <RecurringForm
            initial={formMode.mode === 'edit' ? formMode.item : undefined}
            prefill={formMode.mode === 'add' ? formMode.prefill : undefined}
            onSave={handleSave} onCancel={closeForm}
            onFinish={formMode.mode === 'edit' && formMode.item.isActive ? () => handleFinish(formMode.item) : undefined}
            currency={currency} freq={FREQ} types={TYPES}
          />
        )}
      </div>

      {/* ── DESKTOP — 2-col ── */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start pb-6">
        <div className="col-span-2 flex flex-col gap-0">
          <div className="pb-4 mb-4" style={{ borderBottom: '2px solid hsl(var(--foreground))', background: 'hsl(var(--card))' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'hsl(var(--muted-foreground))', marginBottom: 8 }}>
                  {t('recurring.title')}
                </p>
                {list.length > 0 && headerTotals}
                {typeBreakdown}
              </div>
              <button onClick={openAddForm} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
                {t('recurring.add')}
              </button>
            </div>
          </div>

          {candidatesBlock && <div className="mb-4">{candidatesBlock}</div>}

          {loading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>}
          {!loading && list.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <StickerIcon icon="refund" color="hsl(var(--muted-foreground))" className="mb-3 h-10 w-10" />
              <p className="font-medium">{t('recurring.noItems')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('recurring.noItemsHint')}</p>
            </div>
          )}
          {list.length > 0 && (
            <div className="divide-y divide-border/20 border-b border-border/30">{listItems}</div>
          )}
        </div>

        <div className="sticky top-6">{formPanel}</div>
      </div>
    </>
  );
}

// ── RecurringForm ─────────────────────────────────────────────────────────────

function RecurringForm({ initial, prefill, onSave, onCancel, onFinish, currency, freq, types }: {
  initial?: SerializableRecurringPayment;
  /** Seed values for add mode (detected-subscription card) */
  prefill?: RecurringPrefill;
  onSave: (d: Omit<AddRecurringInput, 'userId'>) => Promise<void>;
  onCancel: () => void;
  /** Terminate the payment (edit mode, active items only) */
  onFinish?: () => void;
  currency: string;
  freq: { value: RecurringFrequency; label: string }[];
  types: { value: RecurringType; label: string; icon: string }[];
}) {
  const t = useT();
  const language = useAppSelector((s) => s.ui.language);
  const dfLocale = useDateFnsLocale();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const allExpCats = useAppSelector((s) => s.categories.expense);
  const expenseFolders = useAppSelector((s) => s.categories.folders.expense ?? []);
  const { groups: expenseCatGroups, getCatsInGroup, getGroupOf } = useCategoryGroups('expense');
  const folderSuggestions = getFolderLibraryBlueprints('expense').map((b) => folderBlueprintToSuggestion(b, language));
  const categorySuggestions = getCategoryLibraryBlueprints('expense').map((b) => categoryBlueprintToSuggestion(b, language));

  const [name, setName] = useState(initial?.name ?? prefill?.name ?? '');
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : prefill ? String(prefill.amount) : '0'
  );
  const [cur, setCur] = useState<Currency>((initial?.currency ?? prefill?.currency ?? currency) as Currency);
  const symbol = getCurrencySymbol(cur);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? prefill?.categoryId ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? prefill?.frequency ?? 'monthly');
  const [type, setType] = useState<RecurringType>(initial?.type ?? prefill?.type ?? 'subscription');
  const [typeLabel, setTypeLabel] = useState(initial?.typeLabel ?? '');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    const seedCatId = initial?.categoryId ?? prefill?.categoryId;
    if (!seedCatId) return '';
    const cat = allExpCats.find((c) => c.id === seedCatId);
    return getGroupOf(cat) || (cat?.id ?? '');
  });
  const [startDate, setStartDate] = useState(() => {
    const seedStart = initial?.startDate ?? prefill?.startDate;
    return seedStart ? format(parseISO(seedStart), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
  });
  // Fixed term as a payment count; '' = open-ended. endDate is derived on save.
  const [payments, setPayments] = useState(() =>
    initial?.endDate
      ? String(countOccurrences(parseISO(initial.startDate), parseISO(initial.endDate), initial.frequency))
      : ''
  );
  const [reminderDays, setReminderDays] = useState(initial?.reminderDays ?? 3);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [showComment, setShowComment] = useState(!!initial?.comment);
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showFolderEditor, setShowFolderEditor] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [showCatPicker, setShowCatPicker] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  // Term applies to debt-like kinds; subscriptions stay open-ended by design
  const isTermType = type === 'credit' || type === 'installment' || type === 'mortgage';
  const paymentsNum = Math.max(0, Math.floor(parseFloat(payments) || 0));
  const lastPaymentDate = isTermType && paymentsNum >= 1
    ? occurrenceDate(parseLocalDate(startDate), frequency, paymentsNum)
    : null;
  const category = allExpCats.find((c) => c.id === categoryId);
  const selectedGroupCat = expenseCatGroups.find((g) => g.id === selectedGroupId);
  const catsInGroup = selectedGroupId ? getCatsInGroup(selectedGroupId) : [];
  const catColor = selectedGroupCat?.color ?? category?.color ?? '#E07A5F';
  const categoryValidationError = t('categories.selectCategory');
  const visibleError = categoryId && error === categoryValidationError ? '' : error;

  // Canonical category trigger — opens the folder-first picker sheet
  const categoryTriggerCard = (
    <button
      type="button"
      onClick={() => setShowCatPicker(true)}
      className="bg-card rounded-[16px] p-3 flex items-center gap-3 w-full text-left flex-shrink-0"
      style={{
        boxShadow: '0 1px 3px rgba(61,44,31,.06)',
        border: category ? '1.5px solid transparent' : '1.5px solid hsl(var(--destructive))',
      }}
    >
      <CategoryIcon icon={category?.icon ?? selectedGroupCat?.icon ?? 'box'} color={catColor} size="md" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-extrabold text-foreground truncate">
          {category ? t.cat(category.name) : t('categories.selectCategory')}
        </div>
        <div className="text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">
          {selectedGroupCat ? t.cat(selectedGroupCat.name) : t('expense.tapToPick')}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );

  function tap(key: NumKey) { setAmount((cur) => applyKey(cur, String(key))); }

  const selectCategory = useCallback((nextCategory: Category | undefined) => {
    const nextCategoryId = nextCategory?.id ?? '';
    setCategoryId(nextCategoryId);
    setSelectedGroupId(nextCategory ? getGroupOf(nextCategory) : '');
    if (nextCategoryId) setError('');
  }, [getGroupOf]);

  useEffect(() => {
    if (!categoryId) return;
    const current = allExpCats.find((entry) => entry.id === categoryId && !entry.archived);
    if (!current) return;
    const groupId = getGroupOf(current);
    if (groupId !== selectedGroupId) setSelectedGroupId(groupId);
    if (error === categoryValidationError) setError('');
  }, [allExpCats, categoryId, categoryValidationError, error, getGroupOf, selectedGroupId]);

  const attachCategoryToFolder = (current: Category, folderId?: string) => {
    if (!folderId || current.folderId === folderId || current.extraFolderIds?.includes(folderId)) {
      return current;
    }
    if (!current.folderId) {
      return { ...current, folderId };
    }
    return {
      ...current,
      extraFolderIds: [...new Set([...(current.extraFolderIds ?? []), folderId])],
    };
  };

  async function handleSaveFolder(
    data: Omit<CategoryFolder, 'id' | 'userId'> & { id?: string; presetId?: string },
  ) {
    if (!user) return;
    const { presetId, ...rest } = data;
    const preset = findFolderBlueprint('expense', { id: presetId, name: rest.name });
    const existing = expenseFolders.find((folder) => (
      folder.id === preset?.id || normalizeNameKey(folder.name) === normalizeNameKey(rest.name)
    ));
    if (existing) {
      setSelectedGroupId(existing.id);
      setCategoryId('');
      setShowFolderEditor(false);
      if (error === categoryValidationError) setError('');
      if (getCatsInGroup(existing.id).length === 0) {
        requestAnimationFrame(() => setShowCategoryEditor(true));
      }
      return;
    }

    const created = preset
      ? await addFolderWithId(user.id, preset.id, {
          ...rest,
          name: preset.ru ?? preset.name,
          icon: preset.icon,
          color: preset.color,
        })
      : await addFolderToDb(user.id, rest);

    dispatch(addFolderAction(created));
    setSelectedGroupId(created.id);
    setCategoryId('');
    setShowFolderEditor(false);
    requestAnimationFrame(() => setShowCategoryEditor(true));
  }

  async function handleSaveCategory(
    data: Omit<Category, 'id' | 'userId'> & { id?: string; presetId?: string },
  ) {
    if (!user) return;
    const { presetId, ...rest } = data;
    const preset = findCategoryBlueprint('expense', { id: presetId, name: rest.name });
    const existing = allExpCats.find((entry) => !entry.archived && (
      entry.id === preset?.id || normalizeNameKey(entry.name) === normalizeNameKey(rest.name)
    ));

    if (existing) {
      const attached = attachCategoryToFolder(existing, rest.folderId ?? undefined);
      if (
        attached.folderId !== existing.folderId ||
        JSON.stringify(attached.extraFolderIds ?? []) !== JSON.stringify(existing.extraFolderIds ?? [])
      ) {
        await updateCategoryInDb(user.id, attached);
        dispatch(updateCategoryAction(attached));
      }
      selectCategory(attached);
      setShowCategoryEditor(false);
      return;
    }

    const order = rest.folderId
      ? allExpCats.filter((entry) => entry.folderId === rest.folderId).length
      : allExpCats.length;

    const created = preset
      ? await addCategoryWithId(user.id, preset.id, {
          ...rest,
          name: preset.ru ?? preset.name,
          icon: preset.icon,
          color: preset.color,
          order,
        })
      : await addCategoryToDb(user.id, {
          ...rest,
          order,
        });

    dispatch(addCategoryAction(created));
    selectCategory(created);
    setShowCategoryEditor(false);
  }

  async function handleSubmit() {
    if (!name.trim()) { setError(t('recurring.nameRequired')); return; }
    if (amountNum <= 0 || saving) return;

    if (!categoryId) {
      setError(categoryValidationError);
      return;
    }

    setError(''); setSaving(true);
    try {
      await onSave({
        name: name.trim(), amount: amountNum, currency: cur,
        categoryId, frequency, startDate: parseLocalDate(startDate),
        endDate: lastPaymentDate ?? undefined,
        type, typeLabel: type === 'custom' ? typeLabel.trim() || undefined : undefined,
        reminderDays, comment: comment.trim() || undefined,
      });
    } catch {
      setError(t('recurring.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ── Mobile: full-screen overlay ── */}
      <div
        className="fb-sheet-enter lg:hidden fixed inset-0 z-50 flex flex-col bg-background"
        style={{ height: '100dvh', maxHeight: '100dvh' }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
          <button onClick={onCancel} className="fb-touch-target flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted transition-colors" aria-label={t('common.close')}>
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
            {initial ? t('recurring.editTitle') : t('recurring.newTitle')}
          </div>
          <div className="w-8" />
        </div>

        {/* Name input */}
        <div className="mx-4 mt-1.5 flex-shrink-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('recurring.namePlaceholder')}
            autoFocus
            className="block w-full px-4 py-2.5 rounded-[14px] text-sm font-bold bg-card border border-border outline-none focus:border-primary transition-colors"
          />
          {visibleError && <p className="text-[11px] text-destructive mt-1 px-1">{visibleError}</p>}
        </div>

        {/* Amount row */}
        <div className="mx-4 mt-1.5 px-4 py-1.5 rounded-[18px] flex items-baseline justify-between flex-shrink-0 border-[1.5px] border-primary bg-primary/10">
          <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
            {t('recurring.amount')}
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-muted-foreground">{symbol}</span>
            <span className="text-[32px] font-black text-foreground tracking-[-0.03em] leading-none tabular-nums">
              {amount}
            </span>
          </div>
        </div>

        {/* Currency chips — per-template currency, no FX conversion */}
        <div className="mx-4 mt-1 flex gap-1.5 flex-shrink-0">
          {CURRENCIES.map((c) => {
            const sel = cur === c;
            return (
              <button
                key={c}
                onClick={() => setCur(c)}
                className="min-h-9 flex-1 rounded-xl text-xs font-bold transition-all border"
                style={{
                  background: sel ? 'hsl(var(--primary) / .12)' : 'hsl(var(--card))',
                  borderColor: sel ? 'hsl(var(--primary))' : 'transparent',
                  color: sel ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                }}
              >
                {getCurrencySymbol(c)} {c}
              </button>
            );
          })}
        </div>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto px-3.5 py-1.5 flex flex-col gap-2 min-h-0 [scrollbar-width:none]">

          {/* Date row */}
          <div className="rounded-[14px] overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}>
            <button
              onClick={() => { setShowDate((v) => !v); setShowComment(false); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all"
              style={{ background: showDate ? catColor + '14' : 'hsl(var(--card))' }}
            >
              <div className="h-8 w-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: catColor + '20' }}>
                <Calendar className="h-4 w-4" style={{ color: catColor }} />
              </div>
              <span className="flex-1 text-left text-[13px] font-bold text-foreground">
                {(() => {
                  const d = parseISO(startDate);
                  if (isToday(d)) return t('common.today');
                  if (isYesterday(d)) return t('common.yesterday');
                  return format(d, 'd MMMM yyyy', { locale: dfLocale });
                })()}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            {showDate && (
              <div style={{ borderTop: `1px solid ${catColor}22` }}>
                <MiniCalendar value={startDate} onChange={(d) => { setStartDate(d); setShowDate(false); }} color={catColor} />
              </div>
            )}
          </div>

          {/* Comment row */}
          <div className="rounded-[14px] overflow-hidden flex-shrink-0" style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}>
            <button
              onClick={() => { setShowComment((v) => !v); setShowDate(false); }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 transition-all"
              style={{ background: (showComment || comment) ? catColor + '14' : 'hsl(var(--card))' }}
            >
              <div className="h-8 w-8 rounded-[10px] flex items-center justify-center flex-shrink-0" style={{ background: catColor + '20' }}>
                <MessageSquare className="h-4 w-4" style={{ color: catColor }} />
              </div>
              <span className="flex-1 text-left text-[13px] font-bold" style={{ color: comment ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))' }}>
                {comment || t('expense.commentPlaceholder')}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            {showComment && (
              <div className="px-3.5 pb-3" style={{ borderTop: `1px solid ${catColor}22` }}>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={t('expense.commentPlaceholder')}
                  autoFocus
                  className="mt-2 block w-full px-3 py-2 rounded-xl text-sm bg-background border border-border outline-none focus:border-primary transition-colors"
                />
              </div>
            )}
          </div>

          {/* Frequency chips */}
          <div>
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
              {t('recurring.frequency')}
            </p>
            <div className="flex gap-1.5">
              {freq.map((f) => {
                const sel = frequency === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setFrequency(f.value)}
                    className="min-h-11 flex-1 rounded-xl text-xs font-bold transition-all border"
                    style={{
                      background: sel ? catColor + '18' : 'hsl(var(--card))',
                      borderColor: sel ? catColor : 'transparent',
                      color: sel ? catColor : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kind of payment: subscription / credit / installment / … */}
          <div>
            <p className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
              {t('recurring.type')}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {types.map((tp) => {
                const sel = type === tp.value;
                return (
                  <button
                    key={tp.value}
                    onClick={() => setType(tp.value)}
                    className="min-h-9 rounded-xl px-3 text-xs font-bold transition-all border inline-flex items-center gap-1"
                    style={{
                      background: sel ? catColor + '18' : 'hsl(var(--card))',
                      borderColor: sel ? catColor : 'transparent',
                      color: sel ? catColor : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    <StickerIcon icon={tp.icon} color={sel ? catColor : 'hsl(var(--muted-foreground))'} className="h-4 w-4" />
                    <span>{tp.label}</span>
                  </button>
                );
              })}
            </div>
            {type === 'custom' && (
              <input
                type="text"
                value={typeLabel}
                onChange={(e) => setTypeLabel(e.target.value)}
                placeholder={t('recurring.customTypePlaceholder')}
                className="mt-1.5 block w-full px-3 py-2 rounded-xl text-sm bg-card border border-border outline-none focus:border-primary transition-colors"
              />
            )}
          </div>

          {/* Fixed term for debt-like kinds */}
          {isTermType && (
            <div
              className="bg-card rounded-[14px] px-3.5 py-2.5 flex-shrink-0"
              style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-bold text-foreground">{t('recurring.termPayments')}</p>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  placeholder="∞"
                  value={payments}
                  onChange={(e) => setPayments(e.target.value)}
                  className="w-20 rounded-xl border border-border bg-background px-3 py-1.5 text-right text-sm font-extrabold tabular-nums outline-none focus:border-primary transition-colors"
                />
              </div>
              <div className="flex gap-1.5 mt-2">
                {[3, 6, 12, 24].map((n) => (
                  <button
                    key={n}
                    onClick={() => setPayments(String(n))}
                    className="min-h-9 flex-1 rounded-xl text-xs font-bold transition-all border"
                    style={{
                      background: paymentsNum === n ? catColor + '18' : 'hsl(var(--muted))',
                      borderColor: paymentsNum === n ? catColor : 'transparent',
                      color: paymentsNum === n ? catColor : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    ×{n}
                  </button>
                ))}
              </div>
              {lastPaymentDate && (
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  {t('recurring.lastPaymentOn', { date: format(lastPaymentDate, 'd MMMM yyyy', { locale: dfLocale }) })}
                </p>
              )}
            </div>
          )}

          {/* Category — canonical folder-first picker */}
          <div>
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
              {t('recurring.section')}
            </p>
            {categoryTriggerCard}
          </div>

          {/* Reminder */}
          <div
            className="bg-card rounded-[14px] px-3.5 py-2.5 flex items-center justify-between flex-shrink-0"
            style={{ boxShadow: '0 1px 3px rgba(61,44,31,.06)' }}
          >
            <p className="text-[12.5px] font-bold text-foreground">{t('recurring.remind')}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setReminderDays(Math.max(0, reminderDays - 1))}
                className="fb-touch-target h-11 w-11 rounded-xl bg-muted text-muted-foreground text-lg font-bold flex items-center justify-center"
              >−</button>
              <span className="w-12 text-center text-sm font-extrabold tabular-nums">
                {t('recurring.remindDays').replace('{n}', String(reminderDays))}
              </span>
              <button
                onClick={() => setReminderDays(Math.min(14, reminderDays + 1))}
                className="fb-touch-target h-11 w-11 rounded-xl bg-muted text-muted-foreground text-lg font-bold flex items-center justify-center"
              >+</button>
            </div>
          </div>

          {/* Terminate: «я отменил эту подписку» */}
          {onFinish && (
            <button
              onClick={onFinish}
              className="min-h-11 rounded-[14px] border border-border bg-card text-sm font-bold text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex-shrink-0"
            >
              🏁 {t('recurring.finish')}
            </button>
          )}
        </div>

        {/* Numpad */}
        <div className="px-3 pt-0.5 grid grid-cols-3 flex-shrink-0" style={{ gridAutoRows: '44px', gap: '4px' }}>
          {NUMPAD_KEYS.map((k) => (
            <button
              key={String(k)}
              onClick={() => tap(k)}
              className="bg-card rounded-xl font-extrabold transition-colors active:bg-muted border-0"
              style={{
                fontSize: typeof k === 'number' ? 20 : 16,
                color: k === '⌫' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                boxShadow: '0 1px 2px rgba(61,44,31,.05)',
              }}
            >
              {k}
            </button>
          ))}
        </div>

        {/* Save bar */}
        <div className="px-4 pt-1.5 flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
          <button
            onClick={handleSubmit}
            disabled={saving || amountNum <= 0 || !categoryId}
            className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-white transition-opacity disabled:opacity-50 border-0"
            style={{ background: catColor, boxShadow: `0 12px 24px ${catColor}60` }}
          >
            <StickerIcon icon="refund" color="#fff" className="h-4 w-4" />
            <span>
              {saving
                ? t('recurring.saving')
                : initial
                  ? `${t('recurring.saveChanges')} · ${symbol}\u202F${amount}`
                  : `${t('recurring.save')} · ${symbol}\u202F${amount}`}
            </span>
          </button>
        </div>
      </div>

      {/* ── Desktop: compact form ── */}
      <form
        onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        className="hidden lg:flex flex-col gap-4 px-4 pb-6 pt-2 max-h-[70vh] overflow-y-auto"
      >
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground mb-1 block">{t('recurring.name')}</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('recurring.namePlaceholder')}
            className="w-full bg-transparent text-sm font-medium outline-none" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground mb-1 block">{t('recurring.amount')} ({cur})</label>
          <input
            type="number" min="0" step="0.01" placeholder="0.00"
            value={amountNum === 0 ? '' : String(amountNum)}
            onChange={(e) => setAmount(e.target.value || '0')}
            className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums text-destructive"
          />
          <div className="flex gap-1.5 mt-2">
            {CURRENCIES.map((c) => (
              <button key={c} type="button" onClick={() => setCur(c)}
                className={`flex-1 rounded-xl py-1.5 text-xs font-semibold border transition-colors ${cur === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                {getCurrencySymbol(c)} {c}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground mb-2 block">{t('recurring.frequency')}</label>
          <div className="grid grid-cols-2 gap-2">
            {freq.map((f) => (
              <button key={f.value} type="button" onClick={() => setFrequency(f.value)}
                className={`rounded-xl py-2 text-sm font-medium border transition-colors ${frequency === f.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground mb-2 block">{t('recurring.type')}</label>
          <div className="grid grid-cols-2 gap-2">
            {types.map((tp) => (
              <button key={tp.value} type="button" onClick={() => setType(tp.value)}
                className={`rounded-xl py-2 px-2 text-sm font-medium border transition-colors inline-flex items-center justify-center gap-1.5 ${type === tp.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
                <StickerIcon icon={tp.icon} color={type === tp.value ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'} className="h-4 w-4" />
                <span className="truncate">{tp.label}</span>
              </button>
            ))}
          </div>
          {type === 'custom' && (
            <input
              type="text"
              value={typeLabel}
              onChange={(e) => setTypeLabel(e.target.value)}
              placeholder={t('recurring.customTypePlaceholder')}
              className="mt-2 block w-full px-3 py-2 rounded-xl text-sm bg-background border border-border outline-none focus:border-primary transition-colors"
            />
          )}
        </div>
        {isTermType && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-medium">{t('recurring.termPayments')}</label>
              <input
                type="number" inputMode="numeric" min="1" step="1" placeholder="∞"
                value={payments}
                onChange={(e) => setPayments(e.target.value)}
                className="w-24 rounded-lg border border-border bg-background px-3 py-1.5 text-right text-sm font-semibold tabular-nums outline-none focus:border-primary"
              />
            </div>
            {lastPaymentDate && (
              <p className="text-xs text-muted-foreground mt-2">
                {t('recurring.lastPaymentOn', { date: format(lastPaymentDate, 'd MMMM yyyy', { locale: dfLocale }) })}
              </p>
            )}
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground mb-2 block">{t('recurring.section')}</label>
          {categoryTriggerCard}
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground mb-1 block">{t('recurring.nextDue')}</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-transparent text-sm font-medium outline-none" />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between">
          <label className="text-sm font-medium">{t('recurring.remind')}</label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setReminderDays(Math.max(0, reminderDays - 1))}
              className="h-8 w-8 rounded-lg border border-border text-muted-foreground">−</button>
            <span className="w-12 text-center text-sm font-semibold">{t('recurring.remindDays').replace('{n}', String(reminderDays))}</span>
            <button type="button" onClick={() => setReminderDays(Math.min(14, reminderDays + 1))}
              className="h-8 w-8 rounded-lg border border-border text-muted-foreground">+</button>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground mb-1 block">{t('recurring.comment')}</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('recurring.commentPlaceholder')}
            className="w-full bg-transparent text-sm outline-none" />
        </div>
        {visibleError && <p className="text-xs text-destructive px-1">{visibleError}</p>}
        {onFinish && (
          <button type="button" onClick={onFinish}
            className="rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
            🏁 {t('recurring.finish')}
          </button>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground">
            {t('recurring.cancel')}
          </button>
          <button type="submit" disabled={saving || amountNum <= 0 || !categoryId} className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            {saving ? t('recurring.saving') : initial ? t('recurring.saveChanges') : t('recurring.save')}
          </button>
        </div>
      </form>

      {showCatPicker && (
        <CategoryFolderPickerSheet
          open={showCatPicker}
          title={t('categories.selectCategory')}
          mode="single"
          folders={expenseCatGroups}
          categories={allExpCats.filter((c) => !c.archived)}
          selectedCategoryIds={categoryId ? [categoryId] : []}
          suggestedCategoryIds={[]}
          initialFolderId={selectedGroupId || null}
          accentColor={catColor}
          onClose={() => setShowCatPicker(false)}
          onSelectCategory={(cat) => { selectCategory(cat); setShowCatPicker(false); }}
          onCreateFolder={() => { setShowCatPicker(false); setShowFolderEditor(true); }}
          onCreateCategory={(folderId) => {
            setShowCatPicker(false);
            setSelectedGroupId(folderId ?? '');
            setShowCategoryEditor(true);
          }}
        />
      )}

      <FolderEditorSheet
        open={showFolderEditor}
        onClose={() => setShowFolderEditor(false)}
        type="expense"
        onSave={handleSaveFolder}
        availableFolders={expenseFolders}
        suggestions={folderSuggestions}
      />

      <CategoryEditorSheet
        open={showCategoryEditor}
        onClose={() => setShowCategoryEditor(false)}
        type="expense"
        folderId={selectedGroupId || undefined}
        initial={{ folderId: selectedGroupId || undefined }}
        availableFolders={expenseFolders}
        onSave={handleSaveCategory}
        suggestions={categorySuggestions}
      />
    </>
  );
}
