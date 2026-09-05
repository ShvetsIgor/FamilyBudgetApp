'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronDown } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { closeQuickAdd } from '@/features/quickadd/store/quickAddSlice';
import { prependExpense } from '@/features/expenses/store/expensesSlice';
import { addExpense } from '@/features/expenses/services/expensesService';
import { resolveExpensePrivacy } from '@/features/expenses/utils/expensePrivacy';
import { StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol, parseLocalDate } from '@/shared/utils/currency';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { useT } from '@/shared/hooks/useT';
import { paymentMethodIcon } from '@/shared/config/domainIcons';
import { useDateFnsLocale } from '@/shared/hooks/useDateFnsLocale';
import { recordExpense, recordSplitExpense } from '@/features/expenses/store/suggestionMemorySlice';
import { recordSavedCard, buildEntryDateHint } from '@/features/chat/services/savedCardService';
import { cn } from '@/shared/utils/cn';
import { normalizeName } from '@/shared/utils/normalizeName';
import type { Category, SplitItem } from '@/shared/types';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { CategoryEditorSheet } from '@/features/categories/components/CategoryEditorSheet';
import { addCategory as addCategoryFirestore } from '@/features/categories/services/categoriesService';
import { addCategory as addCategoryAction } from '@/features/categories/store/categoriesSlice';
import { categoryBlueprintToSuggestion, getCategoryLibraryBlueprints } from '@/features/categories/utils/libraryLookup';
import type { CategoryFolder } from '@/shared/types';

interface SplitRow {
  categoryId: string;
  name: string;
  icon: string;
  amount: string;
}

const PAYMENT_METHODS = [
  { value: 'card'  as const, label: 'expense.card' },
  { value: 'cash'  as const, label: 'expense.cash' },
  { value: 'other' as const, label: 'expense.other' },
];

export function ExpenseDrawerForm({ accent }: { accent: string }) {
  const dispatch = useAppDispatch();
  const t = useT();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const allCats = useAppSelector((s) => s.categories.expense);
  const { groups: expCatGroups, getCatsInGroup } = useCategoryGroups('expense');
  const symbol = getCurrencySymbol(currency);
  const dfLocale = useDateFnsLocale();

  const groups = expCatGroups.filter((g) => g.name !== 'Savings');

  const [amount, setAmount] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(groups[0]?.id ?? '');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [activeField, setActiveField] = useState<'total' | number>('total');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'other'>('card');
  const [comment, setComment] = useState('');
  const [dateStr, setDateStr] = useState(toDateInput(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const language = useAppSelector((st) => st.ui.language);
  const categorySuggestions = useMemo(
    () => getCategoryLibraryBlueprints('expense').map((b) => categoryBlueprintToSuggestion(b, language)),
    [language],
  );

  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    amountRef.current?.focus();
  }, []);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const catsInGroup = getCatsInGroup(selectedGroupId);
  const totalNum = parseFloat(amount) || 0;
  const splitsSum = splits.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
  const remainder = Math.max(0, totalNum - splitsSum);
  const splitsOverflow = splits.length > 0 && splitsSum > totalNum + 0.01;
  const posCount = splits.filter((s) => parseFloat(s.amount) > 0).length + (remainder > 0 ? 1 : 0);
  const catColor = selectedGroup?.color ?? accent;
  const selectedCategory = catsInGroup.find((cat) => cat.id === selectedCategoryId)
    ?? allCats.find((cat) => cat.id === selectedCategoryId);
  const needsRemainderCategory = splits.length > 0 && remainder > 0.01 && !selectedCategory;
  const canSave = totalNum > 0 && !splitsOverflow && (
    selectedCategoryId !== '' || (splits.length > 0 && remainder <= 0.01)
  );

  function addSplit(sub: Category) {
    if (splits.find((s) => s.categoryId === sub.id)) return;
    setSplits((prev) => {
      const next = [...prev, { categoryId: sub.id, name: sub.name, icon: sub.icon, amount: '' }];
      setActiveField(next.length - 1);
      return next;
    });
    setPickerOpen(false);
  }

  function removeSplit(i: number) {
    setSplits((prev) => prev.filter((_, j) => j !== i));
    setActiveField('total');
  }

  function changeGroup(id: string) {
    setSelectedGroupId(id);
    setSelectedCategoryId('');
    setSplits([]);
    setActiveField('total');
    setPickerOpen(false);
  }

  async function handleSave() {
    if (!user || totalNum <= 0 || saving) return;
    const splitItems: SplitItem[] = splits
      .filter((sp) => parseFloat(sp.amount) > 0)
      .map((sp) => ({ categoryId: sp.categoryId, amount: parseFloat(sp.amount) }));
    const splitFullyCoversTotal = splitItems.length > 0 && remainder <= 0.01;
    const effectiveCategoryId = selectedCategoryId || (splitFullyCoversTotal ? splitItems[0]?.categoryId ?? '' : '');
    if (!effectiveCategoryId || splitsOverflow || needsRemainderCategory) return;

    setSaving(true);
    try {
      const exp = await addExpense({
        userId: user.id, currency, date: parseLocalDate(dateStr),
        paymentMethod, tags: [],
        // Private category (main or split) → owner-only secret
        privacy: resolveExpensePrivacy({
          categories: allCats,
          categoryId: effectiveCategoryId,
          splitCategoryIds: splitItems.map((sp) => sp.categoryId),
        }),
        comment: normalizeName(comment) || undefined,
        amount: totalNum, categoryId: effectiveCategoryId, splits: splitItems,
      });
      dispatch(prependExpense(exp));
      // Feed the shared deterministic memory, same as mobile fast entry
      const effectiveCat = allCats.find((c) => c.id === effectiveCategoryId);
      dispatch(recordExpense({
        categoryId: effectiveCategoryId,
        folderId: effectiveCat?.folderId ?? undefined,
        date: dateStr,
      }));
      if (splitItems.length > 0) {
        const allSplitCatIds = Array.from(new Set([effectiveCategoryId, ...splitItems.map((sp) => sp.categoryId)]));
        dispatch(recordSplitExpense({
          categoryIds: allSplitCatIds,
          folderIds: allSplitCatIds.map((id) => allCats.find((c) => c.id === id)?.folderId ?? undefined),
          date: dateStr,
        }));
      }
      // Secondary chat-history write — must not undo the saved expense or
      // block closing the drawer (a retry would duplicate the expense).
      try {
        const hint = [
          buildEntryDateHint(dateStr, t, dfLocale),
          posCount > 1 ? `${t('expense.split2')} · ${posCount}` : undefined,
        ].filter(Boolean).join(' · ') || undefined;
        await recordSavedCard({
          userId: user.id,
          text: `${t('home.saved')} · ${symbol} ${totalNum}`,
          icon: effectiveCat?.icon ?? 'box',
          color: effectiveCat?.color ?? catColor,
          title: t.cat(effectiveCat?.name ?? selectedGroup?.name ?? ''),
          hint,
          amount: totalNum,
          currencySymbol: symbol,
          expenseId: exp.id,
        });
      } catch (err) {
        console.error('chat card write failed (expense already saved)', err);
      }
      dispatch(closeQuickAdd());
    } catch {
      // Only the FINANCIAL write reaches here — re-enable retry.
      setSaving(false);
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
      if (e.key === 's' || e.key === 'S') { if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setPickerOpen((v) => !v); } }
      if (e.key === 'd' || e.key === 'D') { if (!(e.target instanceof HTMLInputElement)) { e.preventDefault(); setShowDatePicker((v) => !v); } }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });


  const today = toDateInput(new Date());
  const dateLabel = dateStr === today ? t('common.today') : format(parseLocalDate(dateStr), 'd MMM yyyy');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3 scrollbar-none">

        {/* ── Category grid ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">{t('categories.pickerPlaceholder')}</span>
            <span className="text-[11px] font-bold" style={{ color: catColor }}>{selectedGroup ? t.cat(selectedGroup.name) : ''}</span>
          </div>
          {groups.length === 0 && (
            <div className="flex flex-col items-center gap-2 rounded-[12px] border border-dashed border-border py-6 text-center">
              <span className="text-2xl">🗂️</span>
              <p className="text-sm font-bold text-foreground">{t('quickadd.emptyTitle')}</p>
              <p className="text-xs text-muted-foreground px-6">{t('quickadd.emptyHint')}</p>
              <button
                onClick={() => setShowCategoryEditor(true)}
                className="mt-1 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
              >
                {t('categories.hub.createManual')}
              </button>
            </div>
          )}
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {groups.map((cat) => {
              const sel = cat.id === selectedGroupId;
              const c = cat.color ?? '#E07A5F';
              return (
                <button
                  key={cat.id}
                  onClick={() => changeGroup(cat.id)}
                  className="h-[68px] rounded-[12px] flex flex-col items-center justify-center gap-1 transition-all border-0"
                  style={{
                    background: sel ? c : 'hsl(var(--card))',
                    boxShadow: sel ? `0 3px 10px ${c}55` : '0 1px 3px rgba(61,44,31,.06)',
                  }}
                >
                  <StickerIcon icon={cat.icon ?? 'box'} color={sel ? '#fff' : c} className="h-5 w-5" />
                  <span className="text-[11px] font-extrabold leading-tight text-center px-1 line-clamp-1"
                    style={{ color: sel ? '#fff' : 'hsl(var(--foreground))' }}>
                    {t.cat(cat.name)}
                  </span>
                </button>
              );
            })}
            {groups.length > 0 && (
              <button
                onClick={() => setShowCategoryEditor(true)}
                className="h-[68px] rounded-[12px] flex flex-col items-center justify-center gap-1 border border-dashed border-border bg-transparent text-muted-foreground transition-colors hover:text-foreground"
              >
                <span className="text-lg font-black leading-none">＋</span>
                <span className="text-[10px] font-extrabold leading-tight text-center px-1">{t('categories.newCategory')}</span>
              </button>
            )}
          </div>
        </div>

        {catsInGroup.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5 px-0.5">
              <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest">{t('expense.category')}</span>
              {needsRemainderCategory && (
                <span className="text-[10px] font-bold text-destructive">{t('expense.selectRemainderCategory')}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {catsInGroup.map((cat) => {
                const sel = selectedCategoryId === cat.id;
                const c = cat.color ?? catColor;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(sel ? '' : cat.id)}
                    className="h-[34px] rounded-[10px] px-3 flex items-center gap-1.5 text-[10px] font-extrabold transition-all border-0"
                    style={{
                      background: sel ? c : c + '18',
                      color: sel ? '#fff' : 'hsl(var(--foreground))',
                    }}
                  >
                    <StickerIcon icon={cat.icon ?? 'box'} color={sel ? '#fff' : c} className="h-3.5 w-3.5" />
                    {t.cat(cat.name)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Amount input ── */}
        <div
          className="bg-card rounded-[14px] px-4 py-3 flex items-center gap-3 border-2 transition-all"
          style={{ borderColor: activeField === 'total' ? catColor : catColor + '44' }}
          onClick={() => { setActiveField('total'); amountRef.current?.focus(); }}
        >
          <span className="text-xl font-bold text-muted-foreground">{symbol}</span>
          <input
            ref={amountRef}
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onFocus={() => setActiveField('total')}
            placeholder="0"
            className="flex-1 bg-transparent text-[32px] font-black text-foreground outline-hidden tabular-nums placeholder:text-muted-foreground/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-xs font-bold text-muted-foreground/50 uppercase">{currency}</span>
        </div>

        {/* ── Split list ── */}
        <div className="bg-card rounded-[14px] overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(61,44,31,.06)' }}>
          {/* Selected group row */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: catColor + '22' }}>
              <StickerIcon icon={selectedGroup?.icon ?? 'box'} color={catColor} className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-foreground">
                {selectedGroup ? t.cat(selectedGroup.name) : ''}
                {splits.length > 0 && <span className="text-xs font-semibold text-muted-foreground ml-1">{t('quickadd.totalHint')}</span>}
              </div>
              {needsRemainderCategory ? (
                <div className="text-[10px] text-destructive">{t('expense.selectRemainderCategory')}</div>
              ) : splits.length > 0 && (
                <div className="text-[10px] text-muted-foreground">{t('quickadd.remainderAfterSplits')}</div>
              )}
              {splitsOverflow && (
                <div className="text-[10px] text-destructive">{t('expense.splitExceedsTotal')}</div>
              )}
            </div>
            <span className="text-base font-black tabular-nums" style={{ color: catColor }}>
              {symbol}{splits.length > 0 ? remainder.toFixed(2).replace(/\.00$/, '') : (amount || '0')}
            </span>
          </div>

          {/* Split rows */}
          {splits.map((sp, i) => {
            const isActive = activeField === i;
            return (
              <div key={i}>
                <div className="h-px mx-4" style={{ background: catColor + '22' }} />
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all"
                  style={{ background: isActive ? catColor + '0e' : 'transparent', paddingLeft: 28 }}
                  onClick={() => { setActiveField(i); }}
                >
                  <div className="h-[22px] w-[22px] rounded-[6px] flex items-center justify-center shrink-0" style={{ background: catColor + '28' }}>
                    <StickerIcon icon={sp.icon} color={catColor} className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs font-bold text-foreground">{t.cat(sp.name)}</div>
                  {isActive ? (
                    <input
                      autoFocus
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={sp.amount}
                      onChange={(e) => setSplits((prev) => prev.map((s, j) => j === i ? { ...s, amount: e.target.value } : s))}
                      className="w-24 text-right bg-transparent text-sm font-black text-foreground outline-hidden tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />
                  ) : (
                    <span className="text-sm font-black tabular-nums text-foreground">{symbol}{sp.amount || '0'}</span>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeSplit(i); }} className="text-muted-foreground hover:text-foreground text-xs px-1 transition-colors">✕</button>
                </div>
              </div>
            );
          })}

          {/* Add split CTA */}
          {catsInGroup.length > 0 && (
            <>
              <div className="h-px mx-4 border-t border-dashed" style={{ borderColor: catColor + '44' }} />
              <button
                onClick={() => setPickerOpen(!pickerOpen)}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold transition-colors"
                style={{ color: catColor }}
              >
                <span className="text-base leading-none">＋</span>
                {t('quickadd.refineItem')}
                <kbd className="ml-1 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-mono">S</kbd>
              </button>
            </>
          )}

          {/* Folder category picker */}
          {pickerOpen && catsInGroup.length > 0 && (
            <div className="border-t border-border px-3 py-2.5">
              <div className="grid grid-cols-4 gap-1.5">
                {catsInGroup.map((s) => {
                  const sel = !!splits.find((x) => x.categoryId === s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => sel ? removeSplit(splits.findIndex((x) => x.categoryId === s.id)) : addSplit(s)}
                      className="flex flex-col items-center gap-1 py-2 rounded-[9px] text-[11px] font-extrabold transition-all border"
                      style={{ background: sel ? catColor + '28' : catColor + '10', borderColor: sel ? catColor : 'transparent' }}
                    >
                      <StickerIcon icon={s.icon} color={catColor} className="h-4 w-4" />
                      <span className="leading-tight text-center line-clamp-1 px-0.5">{t.cat(s.name)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Form rows ── */}
        <div className="bg-card rounded-[14px] overflow-hidden divide-y divide-border" style={{ boxShadow: '0 1px 4px rgba(61,44,31,.06)' }}>
          {/* Date */}
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setShowDatePicker(!showDatePicker)}>
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">{t('quickadd.date')}</span>
            <span className="flex-1 text-sm font-bold text-foreground">{dateLabel}</span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-mono">D</kbd>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          {showDatePicker && (
            <div className="px-4 py-3">
              <MiniCalendar value={dateStr} onChange={(d) => { setDateStr(d); setShowDatePicker(false); }} color={catColor} />
            </div>
          )}

          {/* Payment */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">{t('quickadd.payment')}</span>
            <div className="flex gap-1.5 flex-1">
              {PAYMENT_METHODS.map((m) => {
                const sel = paymentMethod === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border"
                    style={{
                      background: sel ? catColor + '18' : 'transparent',
                      borderColor: sel ? catColor : 'hsl(var(--border))',
                      color: sel ? catColor : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    <StickerIcon icon={paymentMethodIcon(m.value)} color="currentColor" className="h-4 w-4" /><span>{t(m.label)}</span>
                  </button>
                );
              })}
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[9px] font-mono">P</kbd>
          </div>

          {/* Note */}
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest w-[72px] shrink-0">{t('quickadd.note')}</span>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('quickadd.optionalPlaceholder')}
              className="flex-1 bg-transparent text-sm text-foreground outline-hidden placeholder:text-muted-foreground/40"
            />
          </div>
        </div>
      </div>

      {/* ── Save bar ── */}
      <div className="shrink-0 border-t border-border px-5 py-4 flex items-center gap-3 bg-background">
        <button
          onClick={() => dispatch(closeQuickAdd())}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors border border-border"
        >
          {t('expense.numpadCancel')} <kbd className="ml-1 text-[9px] font-mono opacity-50">Esc</kbd>
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !canSave}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50"
          style={{ background: catColor, boxShadow: `0 8px 20px ${catColor}55` }}
        >
          <StickerIcon icon={selectedCategory?.icon ?? selectedGroup?.icon ?? 'box'} color="#fff" className="h-4 w-4" />
          <span>{saving ? t('expense.numpadSaving') : t('expense.numpadSave', { symbol, total: amount || '0' })}</span>
          {posCount > 0 && <span className="opacity-70 text-xs">· {t('expense.numpadPos', { count: posCount })}</span>}
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-white/20 text-[9px] font-mono">⌘↵</kbd>
        </button>
      </div>

      {/* ── Inline category creation ── */}
      <CategoryEditorSheet
        open={showCategoryEditor}
        onClose={() => setShowCategoryEditor(false)}
        type="expense"
        folderId={selectedGroupId || undefined}
        initial={{ folderId: selectedGroupId || undefined }}
        availableFolders={groups as unknown as CategoryFolder[]}
        suggestions={categorySuggestions}
        onSave={async (catData) => {
          const name = catData.name?.trim();
          if (!name || !user || creatingCategory) return;
          setCreatingCategory(true);
          try {
            const primaryFolderId = catData.folderId ?? (selectedGroupId || undefined);
            const targetFolder = groups.find((g) => g.id === primaryFolderId) ?? null;
            const newCat = await addCategoryFirestore(user.id, {
              name,
              icon: catData.icon ?? 'box',
              color: catData.color ?? targetFolder?.color ?? '#94A3B8',
              folderId: primaryFolderId,
              extraFolderIds: catData.extraFolderIds?.filter((id) => id !== primaryFolderId) ?? [],
              isPrivate: catData.isPrivate ?? false,
              order: 99,
              type: 'expense',
              ...(catData.tags ? { tags: catData.tags } : {}),
            });
            dispatch(addCategoryAction(newCat));
            if (newCat.folderId) setSelectedGroupId(newCat.folderId);
            setSelectedCategoryId(newCat.id);
          } finally {
            setCreatingCategory(false);
            setShowCategoryEditor(false);
          }
        }}
      />
    </div>
  );
}
