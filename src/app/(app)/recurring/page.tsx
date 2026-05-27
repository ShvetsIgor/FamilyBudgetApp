'use client';

import { useEffect, useState, useCallback } from 'react';
import { format, parseISO, differenceInDays, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, Calendar, MessageSquare, Plus, ChevronRight } from 'lucide-react';
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
import { CategoryEditorSheet } from '@/features/categories/components/CategoryEditorSheet';
import { FolderEditorSheet } from '@/features/categories/components/FolderEditorSheet';
import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
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
import { getCurrencySymbol } from '@/shared/utils/currency';
import { MiniCalendar } from '@/shared/components/MiniCalendar';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
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

function applyKey(cur: string, key: NumKey): string {
  if (key === '.') {
    if (cur.includes('.')) return cur;
    return cur + '.';
  }
  if (key === '⌫') { const s = cur.slice(0, -1); return s === '' ? '0' : s; }
  if (cur === '0') return String(key);
  return cur + String(key);
}

function daysUntil(dateStr: string): number {
  return differenceInDays(parseISO(dateStr), new Date());
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
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
    { value: 'installment', label: t('recurring.installment'), icon: '📦' },
    { value: 'custom', label: t('recurring.custom'), icon: '🔄' },
  ];

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const items = await fetchRecurring(user.id);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const advanced = await Promise.all(
        items.map((item) =>
          item.isActive && parseISO(item.nextDueDate) < today
            ? advanceToNextFutureDue(user.id, item)
            : item
        )
      );
      dispatch(setRecurring(advanced));
    } finally { setLoading(false); }
  }, [user, dispatch]);

  useEffect(() => { if (status === 'idle') load(); }, [status, load]);

  async function handleSave(data: Omit<AddRecurringInput, 'userId'>) {
    if (!user) return;
    try {
      if (formMode?.mode === 'edit') {
        const { nextDueDate } = await updateRecurring(user.id, formMode.item.id, data);
        dispatch(updateRecurringItem({
          ...formMode.item, ...data,
          startDate: data.startDate.toISOString(),
          nextDueDate,
          currency: data.currency,
        }));
      } else {
        const added = await addRecurring({ ...data, userId: user.id });
        const isPast = data.startDate < new Date();
        if (isPast) {
          if (data.categoryId) {
            try {
              const exp = await addExpense({
                userId: user.id, amount: data.amount, currency: data.currency,
                categoryId: data.categoryId, date: data.startDate,
                paymentMethod: 'card', splits: [], tags: ['recurring'], privacy: 'regular',
                store: data.name, comment: data.comment || undefined,
                recurringId: added.id,
              });
              dispatch(prependExpense(exp));
            } catch { /* non-critical — recurring still saved */ }
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
      setFormMode(null);
    } catch (e) {
      console.error('handleSave error:', e);
      throw e;
    }
  }

  async function handleMarkPaid(item: SerializableRecurringPayment) {
    if (!user) return;
    try {
      if (item.categoryId) {
        const exp = await addExpense({
          userId: user.id, amount: item.amount, currency: item.currency,
          categoryId: item.categoryId, date: parseISO(item.nextDueDate),
          paymentMethod: 'card', splits: [], tags: ['recurring'], privacy: 'regular',
          store: item.name,
          comment: item.comment || undefined,
          recurringId: item.id,
        });
        dispatch(prependExpense(exp));
      }
      dispatch(updateRecurringItem(await markAsPaid(user.id, item)));
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

  const monthlyTotal = list
    .filter((r) => r.isActive)
    .reduce((s, r) => {
      const m = r.frequency === 'monthly' ? 1 : r.frequency === 'yearly' ? 1 / 12 : r.frequency === 'weekly' ? 4.33 : 30;
      return s + r.amount * m;
    }, 0);

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
                <span>{t('recurring.due')}: {format(parseISO(item.nextDueDate), 'd MMM', { locale: ru })}</span>
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
        currency={currency} freq={FREQ}
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
      <div className="lg:hidden flex flex-col gap-4 px-4 pt-5 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('recurring.title')}</h1>
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

        {/* FAB */}
        <button
          onClick={() => setFormMode({ mode: 'add' })}
          className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
          style={{ background: 'hsl(var(--primary))' }}
        >
          <Plus size={24} color="white" />
        </button>

        {/* Full-screen overlay form */}
        {formMode && (
          <RecurringForm
            initial={formMode.mode === 'edit' ? formMode.item : undefined}
            onSave={handleSave} onCancel={() => setFormMode(null)}
            currency={currency} freq={FREQ}
          />
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

function RecurringForm({ initial, onSave, onCancel, currency, freq }: {
  initial?: SerializableRecurringPayment;
  onSave: (d: Omit<AddRecurringInput, 'userId'>) => Promise<void>;
  onCancel: () => void;
  currency: string;
  freq: { value: RecurringFrequency; label: string }[];
}) {
  const t = useT();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const allExpCats = useAppSelector((s) => s.categories.expense);
  const expenseFolders = useAppSelector((s) => s.categories.folders.expense ?? []);
  const { groups: expenseCatGroups, getCatsInGroup, getGroupOf } = useCategoryGroups('expense');
  const symbol = getCurrencySymbol(currency as Parameters<typeof getCurrencySymbol>[0]);
  const folderSuggestions = getFolderLibraryBlueprints('expense').map(folderBlueprintToSuggestion);
  const categorySuggestions = getCategoryLibraryBlueprints('expense').map(categoryBlueprintToSuggestion);

  const [name, setName] = useState(initial?.name ?? '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '0');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? 'monthly');
  const [type, setType] = useState<RecurringType>(initial?.type ?? 'subscription');
  const [typeLabel, setTypeLabel] = useState(initial?.typeLabel ?? '');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(() => {
    if (!initial?.categoryId) return '';
    const cat = allExpCats.find((c) => c.id === initial.categoryId);
    return getGroupOf(cat) || (cat?.id ?? '');
  });
  const [startDate, setStartDate] = useState(
    initial ? format(parseISO(initial.startDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [reminderDays, setReminderDays] = useState(initial?.reminderDays ?? 3);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [showComment, setShowComment] = useState(!!initial?.comment);
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showFolderEditor, setShowFolderEditor] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const category = allExpCats.find((c) => c.id === categoryId);
  const selectedGroupCat = expenseCatGroups.find((g) => g.id === selectedGroupId);
  const catsInGroup = selectedGroupId ? getCatsInGroup(selectedGroupId) : [];
  const catColor = selectedGroupCat?.color ?? category?.color ?? '#E07A5F';

  function tap(key: NumKey) { setAmount((cur) => applyKey(cur, key)); }

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
      folder.id === preset?.id || normalizeLabel(folder.name) === normalizeLabel(rest.name)
    ));
    if (existing) {
      setSelectedGroupId(existing.id);
      setCategoryId('');
      setShowFolderEditor(false);
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
  }

  async function handleSaveCategory(
    data: Omit<Category, 'id' | 'userId'> & { id?: string; presetId?: string },
  ) {
    if (!user) return;
    const { presetId, ...rest } = data;
    const preset = findCategoryBlueprint('expense', { id: presetId, name: rest.name });
    const existing = allExpCats.find((entry) => !entry.archived && (
      entry.id === preset?.id || normalizeLabel(entry.name) === normalizeLabel(rest.name)
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
      setSelectedGroupId(rest.folderId ?? attached.folderId ?? '');
      setCategoryId(attached.id);
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
    setSelectedGroupId(created.folderId ?? '');
    setCategoryId(created.id);
    setShowCategoryEditor(false);
  }

  async function handleSubmit() {
    if (!name.trim()) { setError('Введите название'); return; }
    if (amountNum <= 0 || saving) return;

    setError(''); setSaving(true);
    try {
      await onSave({
        name: name.trim(), amount: amountNum, currency: currency as never,
        categoryId, frequency, startDate: parseLocalDate(startDate),
        type, typeLabel: type === 'custom' ? typeLabel.trim() || undefined : undefined,
        reminderDays, comment: comment.trim() || undefined,
      });
    } catch {
      setError('Ошибка сохранения. Попробуйте ещё раз.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* ── Mobile: full-screen overlay ── */}
      <div
        className="lg:hidden fixed inset-0 z-50 flex flex-col bg-background"
        style={{ height: '100dvh', maxHeight: '100dvh' }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
          <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
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
          {error && <p className="text-[11px] text-destructive mt-1 px-1">{error}</p>}
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
                  if (isToday(d)) return 'Сегодня';
                  if (isYesterday(d)) return 'Вчера';
                  return format(d, 'd MMMM yyyy', { locale: ru });
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
                {comment || 'Заметка…'}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
            {showComment && (
              <div className="px-3.5 pb-3" style={{ borderTop: `1px solid ${catColor}22` }}>
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Заметка…"
                  autoFocus
                  className="mt-2 block w-full px-3 py-2 rounded-xl text-sm bg-background border border-border outline-none focus:border-primary transition-colors"
                />
              </div>
            )}
          </div>

          {/* Frequency chips */}
          <div>
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
              {t('recurring.frequency')}
            </p>
            <div className="flex gap-1.5">
              {freq.map((f) => {
                const sel = frequency === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setFrequency(f.value)}
                    className="flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all border"
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

          {/* Category grid — two-level */}
          <div>
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider mb-1.5 px-0.5">
              {t('recurring.category')}
            </p>
            {/* Parent row */}
            <div className="flex flex-wrap gap-1.5">
              {expenseCatGroups.map((cat) => {
                const sel = selectedGroupId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (sel) { setSelectedGroupId(''); setCategoryId(''); }
                      else { setSelectedGroupId(cat.id); setCategoryId(''); }
                    }}
                    className="w-[64px] h-[46px] rounded-[12px] flex flex-col items-center justify-center gap-0.5 transition-all border-0"
                    style={{
                      background: sel ? (cat.color ?? '#E07A5F') : 'hsl(var(--card))',
                      boxShadow: sel ? `0 3px 8px ${cat.color ?? '#E07A5F'}55` : '0 1px 3px rgba(61,44,31,.06)',
                    }}
                  >
                    <StickerIcon icon={cat.icon ?? 'box'} color={sel ? '#fff' : (cat.color ?? '#E07A5F')} className="h-4 w-4" />
                    <span className="text-[9px] font-extrabold leading-tight text-center px-0.5 line-clamp-1"
                      style={{ color: sel ? '#fff' : 'hsl(var(--foreground))' }}>
                      {t.cat(cat.name)}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Folder category row */}
            {catsInGroup.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 pl-2" style={{ borderLeft: `2px solid ${catColor}44` }}>
                {catsInGroup.map((sub) => {
                  const sel = categoryId === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setCategoryId(sel ? '' : sub.id)}
                      className="h-[36px] px-3 rounded-[10px] flex items-center gap-1.5 transition-all border-0 text-[10px] font-extrabold"
                      style={{
                        background: sel ? catColor : catColor + '18',
                        color: sel ? '#fff' : 'hsl(var(--foreground))',
                        boxShadow: sel ? `0 2px 6px ${catColor}44` : 'none',
                      }}
                    >
                      <StickerIcon icon={sub.icon} color={sel ? '#fff' : catColor} className="h-3.5 w-3.5" />
                      {t.cat(sub.name)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowFolderEditor(true)}
                className="flex-1 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                + {t('chat.clarify.newFolder')}
              </button>
              <button
                type="button"
                onClick={() => setShowCategoryEditor(true)}
                className="flex-1 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground"
              >
                + {t('categories.newCategory')}
              </button>
            </div>
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
                className="h-7 w-7 rounded-lg bg-muted text-muted-foreground text-lg font-bold flex items-center justify-center"
              >−</button>
              <span className="w-12 text-center text-sm font-extrabold tabular-nums">
                {t('recurring.remindDays').replace('{n}', String(reminderDays))}
              </span>
              <button
                onClick={() => setReminderDays(Math.min(14, reminderDays + 1))}
                className="h-7 w-7 rounded-lg bg-muted text-muted-foreground text-lg font-bold flex items-center justify-center"
              >+</button>
            </div>
          </div>
        </div>

        {/* Numpad */}
        <div className="px-3 pt-0.5 grid grid-cols-3 flex-shrink-0" style={{ gridAutoRows: '40px', gap: '4px' }}>
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
            disabled={saving || amountNum <= 0}
            className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-white transition-opacity disabled:opacity-50 border-0"
            style={{ background: catColor, boxShadow: `0 12px 24px ${catColor}60` }}
          >
            <span className="text-base leading-none">🔄</span>
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
          <label className="text-xs text-muted-foreground mb-1 block">{t('recurring.amount')} ({currency})</label>
          <input
            type="number" min="0" step="0.01" placeholder="0.00"
            value={amountNum === 0 ? '' : String(amountNum)}
            onChange={(e) => setAmount(e.target.value || '0')}
            className="w-full bg-transparent text-2xl font-bold outline-none tabular-nums text-destructive"
          />
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
          <CategoryPicker
            type="expense"
            value={categoryId}
            onChange={(nextId) => {
              setCategoryId(nextId);
              const nextCat = allExpCats.find((entry) => entry.id === nextId);
              setSelectedGroupId(nextCat?.folderId ?? getGroupOf(nextCat) ?? '');
            }}
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setShowFolderEditor(true)}
              className="flex-1 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              + {t('chat.clarify.newFolder')}
            </button>
            <button
              type="button"
              onClick={() => setShowCategoryEditor(true)}
              className="flex-1 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              + {t('categories.newCategory')}
            </button>
          </div>
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
