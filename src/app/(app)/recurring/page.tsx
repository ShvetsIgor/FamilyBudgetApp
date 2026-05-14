'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useAppSelector, useAppDispatch } from '@/store/store';
import {
  setRecurring, addRecurringItem, removeRecurringItem, updateRecurringItem, toggleRecurringItem,
} from '@/features/recurring/store/recurringSlice';
import {
  fetchRecurring, addRecurring, updateRecurring, deleteRecurring, toggleRecurring,
  markAsPaid, advanceToNextFutureDue,
  type AddRecurringInput,
} from '@/features/recurring/services/recurringService';
import { addExpense } from '@/features/expenses/services/expensesService';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { CategoryPicker } from '@/features/categories/components/CategoryPicker';
import { CategoryIcon } from '@/features/categories/components/CategoryIcon';
import { formatAmount, blockInvalidAmountKeys, parseLocalDate } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import type { RecurringFrequency, RecurringType, SerializableRecurringPayment } from '@/shared/types';

function daysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

type FormMode = { mode: 'add' } | { mode: 'edit'; item: SerializableRecurringPayment };

export default function RecurringPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const categories = useAppSelector((s) => s.categories.expense);
  const { list, status } = useAppSelector((s) => s.recurring);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [loading, setLoading] = useState(false);
  const t = useT();

  const FREQ: { value: RecurringFrequency; label: string }[] = [
    { value: 'monthly', label: t('recurring.monthly') },
    { value: 'weekly', label: t('recurring.weekly') },
    { value: 'yearly', label: t('recurring.yearly') },
    { value: 'daily', label: t('recurring.daily') },
  ];

  const TYPES: { value: RecurringType; label: string; icon: string }[] = [
    { value: 'subscription', label: t('recurring.subscription'), icon: '📺' },
    { value: 'rent', label: t('recurring.rent'), icon: '🏠' },
    { value: 'utility', label: t('recurring.utility'), icon: '💡' },
    { value: 'credit', label: t('recurring.credit'), icon: '💳' },
    { value: 'mortgage', label: t('recurring.mortgage'), icon: '🏦' },
    { value: 'custom', label: t('recurring.custom'), icon: '🔄' },
  ];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try { dispatch(setRecurring(await fetchRecurring(user.id))); } finally { setLoading(false); }
  }, [user, dispatch]);

  useEffect(() => { if (status === 'idle') load(); }, [status, load]);

  async function handleSave(data: Omit<AddRecurringInput, 'userId'>) {
    if (!user) return;
    if (formMode?.mode === 'edit') {
      await updateRecurring(user.id, formMode.item.id, data);
      dispatch(updateRecurringItem({
        ...formMode.item, ...data,
        startDate: data.startDate.toISOString(),
        nextDueDate: new Date(data.startDate).toISOString(),
        currency: data.currency,
      }));
    } else {
      const added = await addRecurring({ ...data, userId: user.id });
      const isPast = data.startDate < new Date();
      if (isPast) {
        if (data.categoryId) {
          const exp = await addExpense({
            userId: user.id, amount: data.amount, currency: data.currency,
            categoryId: data.categoryId, date: data.startDate,
            paymentMethod: 'card', splits: [], tags: ['recurring'], privacy: 'regular',
            comment: data.name + (data.comment ? ' · ' + data.comment : '') || undefined,
          });
          dispatch(prependExpense(exp));
        }
        dispatch(addRecurringItem(await advanceToNextFutureDue(user.id, added)));
      } else {
        dispatch(addRecurringItem(added));
      }
    }
    setFormMode(null);
  }

  async function handleMarkPaid(item: SerializableRecurringPayment) {
    if (!user) return;
    if (item.categoryId) {
      const exp = await addExpense({
        userId: user.id, amount: item.amount, currency: item.currency,
        categoryId: item.categoryId, date: parseISO(item.nextDueDate),
        paymentMethod: 'card', splits: [], tags: ['recurring'], privacy: 'regular',
        comment: item.name + (item.comment ? ' · ' + item.comment : '') || undefined,
      });
      dispatch(prependExpense(exp));
    }
    dispatch(updateRecurringItem(await markAsPaid(user.id, item)));
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

  const monthlyTotal = list
    .filter((r) => r.isActive)
    .reduce((s, r) => {
      const m = r.frequency === 'monthly' ? 1 : r.frequency === 'yearly' ? 1 / 12 : r.frequency === 'weekly' ? 4.33 : 30;
      return s + r.amount * m;
    }, 0);

  // ── List items ───────────────────────────────────────────────────────────────
  const listItems = list.map((item) => {
    const cat = categories.find((c) => c.id === item.categoryId);
    const days = daysUntil(item.nextDueDate);
    const typeObj = TYPES.find((tp) => tp.value === item.type);
    const isSelected = formMode?.mode === 'edit' && formMode.item.id === item.id;
    return (
      <div
        key={item.id}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors',
          !item.isActive && 'opacity-50',
          isSelected && 'bg-primary/5'
        )}
      >
        <div className="flex flex-1 items-center gap-3 min-w-0 cursor-pointer" onClick={() => setFormMode({ mode: 'edit', item })}>
          {cat ? <CategoryIcon icon={cat.icon} color={cat.color} size="md" /> : <span className="text-2xl shrink-0">{typeObj?.icon ?? '🔄'}</span>}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {FREQ.find((f) => f.value === item.frequency)?.label}{' · '}
              {days <= 0 ? (
                <span className="text-destructive font-medium">{t('recurring.dueToday')}</span>
              ) : days <= 3 ? (
                <span className="text-amber-500 font-medium">{t('recurring.inDays').replace('{n}', String(days))}</span>
              ) : (
                <span>{t('recurring.due')}: {format(parseISO(item.nextDueDate), 'MMM d')}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums">{item.amount > 0 ? '-' : ''}{formatAmount(item.amount, item.currency)}</span>
          {item.isActive && days <= 0 && (
            <button
              onClick={() => handleMarkPaid(item)}
              className="rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              {t('recurring.markPaid')}
            </button>
          )}
          <button
            onClick={() => handleToggle(item)}
            className={`relative h-5 w-9 rounded-full transition-colors flex-shrink-0 ${item.isActive ? 'bg-primary' : 'bg-muted'}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${item.isActive ? 'left-[18px]' : 'left-0.5'}`} />
          </button>
          <button onClick={() => handleDelete(item)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
        </div>
      </div>
    );
  });

  const formPanel = formMode ? (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{formMode.mode === 'edit' ? t('recurring.editTitle') : t('recurring.newTitle')}</h2>
        <button onClick={() => setFormMode(null)} className="text-muted-foreground text-xs hover:text-foreground">✕</button>
      </div>
      <RecurringForm
        initial={formMode.mode === 'edit' ? formMode.item : undefined}
        onSave={handleSave} onCancel={() => setFormMode(null)}
        currency={currency} freq={FREQ} types={TYPES} t={t}
      />
    </div>
  ) : (
    <div className="hidden lg:flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center gap-3">
      <p className="text-3xl">🔄</p>
      <p className="text-sm text-muted-foreground">{t('recurring.selectToEdit')}</p>
      <button
        onClick={() => setFormMode({ mode: 'add' })}
        className="mt-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        + {t('recurring.add')}
      </button>
    </div>
  );

  return (
    <>
      {/* ── MOBILE ── */}
      <div className="lg:hidden flex flex-col gap-4 px-4 pt-5 pb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('recurring.title')}</h1>
          {formMode ? (
            <button onClick={() => setFormMode(null)} className="text-sm text-muted-foreground">{t('recurring.back')}</button>
          ) : (
            <button onClick={() => setFormMode({ mode: 'add' })} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
              {t('recurring.add')}
            </button>
          )}
        </div>

        {formMode ? (
          <RecurringForm
            initial={formMode.mode === 'edit' ? formMode.item : undefined}
            onSave={handleSave} onCancel={() => setFormMode(null)}
            currency={currency} freq={FREQ} types={TYPES} t={t}
          />
        ) : (
          <>
            {list.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">{t('recurring.monthlyTotal')}</p>
                <p className="text-2xl font-bold tabular-nums mt-1 text-destructive">
                  {monthlyTotal > 0 ? '-' : ''}{formatAmount(monthlyTotal, currency)}
                </p>
              </div>
            )}
            {loading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>}
            {!loading && list.length === 0 && (
              <div className="flex flex-col items-center py-12 text-center">
                <p className="text-4xl mb-3">🔄</p>
                <p className="font-medium">{t('recurring.noItems')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('recurring.noItemsHint')}</p>
              </div>
            )}
            {list.length > 0 && (
              <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">{listItems}</div>
            )}
          </>
        )}
      </div>

      {/* ── DESKTOP — 2-col ── */}
      <div className="hidden lg:grid lg:grid-cols-3 lg:gap-6 lg:items-start pb-6">
        <div className="col-span-2 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">{t('recurring.title')}</h1>
            <button onClick={() => setFormMode({ mode: 'add' })} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">
              {t('recurring.add')}
            </button>
          </div>

          {list.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{t('recurring.monthlyTotal')}</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-destructive">
                {monthlyTotal > 0 ? '-' : ''}{formatAmount(monthlyTotal, currency)}
              </p>
            </div>
          )}

          {loading && <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" /></div>}
          {!loading && list.length === 0 && (
            <div className="flex flex-col items-center py-12 text-center">
              <p className="text-4xl mb-3">🔄</p>
              <p className="font-medium">{t('recurring.noItems')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('recurring.noItemsHint')}</p>
            </div>
          )}
          {list.length > 0 && (
            <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">{listItems}</div>
          )}
        </div>

        <div className="sticky top-6">{formPanel}</div>
      </div>
    </>
  );
}

// ── RecurringForm ─────────────────────────────────────────────────────────────

function RecurringForm({ initial, onSave, onCancel, currency, freq, types, t }: {
  initial?: SerializableRecurringPayment;
  onSave: (d: Omit<AddRecurringInput, 'userId'>) => Promise<void>;
  onCancel: () => void;
  currency: string;
  freq: { value: RecurringFrequency; label: string }[];
  types: { value: RecurringType; label: string; icon: string }[];
  t: (key: string) => string;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial?.amount.toString() ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? 'monthly');
  const [type, setType] = useState<RecurringType>(initial?.type ?? 'subscription');
  const [startDate, setStartDate] = useState(
    initial ? format(parseISO(initial.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [reminderDays, setReminderDays] = useState(initial?.reminderDays ?? 3);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const num = parseFloat(amount);
    if (!name.trim() || !num || num <= 0) { setError(t('common.error')); return; }
    setError(''); setSaving(true);
    try {
      await onSave({ name: name.trim(), amount: num, currency: currency as never, categoryId, frequency, startDate: parseLocalDate(startDate), type, reminderDays, comment: comment.trim() || undefined });
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pb-6 pt-2 max-h-[70vh] overflow-y-auto lg:max-h-none">
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">{t('recurring.name')}</label>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('recurring.namePlaceholder')}
          className="w-full bg-transparent text-sm font-medium outline-none" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-1 block">{t('recurring.amount')} ({currency})</label>
        <input type="number" min="0" step="0.01" placeholder="0.00" value={amount}
          onChange={(e) => setAmount(e.target.value)} onKeyDown={blockInvalidAmountKeys}
          className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums text-destructive" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs text-muted-foreground mb-2 block">{t('recurring.type')}</label>
        <div className="grid grid-cols-3 gap-2">
          {types.map((tp) => (
            <button key={tp.value} type="button" onClick={() => setType(tp.value)}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs border transition-colors ${type === tp.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
              <span>{tp.icon}</span><span>{tp.label}</span>
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
        <label className="text-xs text-muted-foreground mb-2 block">{t('recurring.category')}</label>
        <CategoryPicker type="expense" value={categoryId} onChange={setCategoryId} parentsOnly />
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
      {error && <p className="text-xs text-destructive px-1">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded-2xl border border-border py-3 text-sm font-medium text-muted-foreground">
          {t('recurring.cancel')}
        </button>
        <button type="submit" disabled={saving} className="flex-1 rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">
          {saving ? t('recurring.saving') : initial ? t('recurring.saveChanges') : t('recurring.save')}
        </button>
      </div>
    </form>
  );
}
