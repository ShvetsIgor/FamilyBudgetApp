'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, Calendar, ChevronLeft, Scissors, ChevronRight, Plus } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { removeMessage as removeChatMessage } from '@/features/chat/store/chatSlice';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { prependExpense, updateExpense as updateExpenseAction } from '@/features/expenses/store/expensesSlice';
import { addExpense, updateExpense } from '@/features/expenses/services/expensesService';
import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { normalizeName } from '@/shared/utils/normalizeName';
import type { Category, SerializableExpense, SplitItem } from '@/shared/types';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { recordExpense, recordSplitExpense, recordTagAssociation, recordMerchantContext, extractTags, normalizeTag } from '@/features/expenses/store/suggestionMemorySlice';
import { buildExpenseDraft } from '@/features/expenses/engine/buildExpenseDraft';
import { useSplitEditor, applyKey, type SplitRow } from '@/features/expenses/hooks/useSplitEditor';
import { addCategory as addCategoryFirestore } from '@/features/categories/services/categoriesService';
import { addCategory as addCategoryAction, addFolder as addFolderAction } from '@/features/categories/store/categoriesSlice';
import { addFolder as addFolderToDb } from '@/features/categories/services/categoryFoldersService';
import { FolderEditorSheet } from '@/features/categories/components/FolderEditorSheet';
import { CategoryEditorSheet } from '@/features/categories/components/CategoryEditorSheet';
import type { CategoryFolder } from '@/shared/types';
import {
  categoryBlueprintToSuggestion,
  folderBlueprintToSuggestion,
  getCategoryLibraryBlueprints,
  getFolderLibraryBlueprints,
} from '@/features/categories/utils/libraryLookup';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];


interface Props {
  initialExpense?: SerializableExpense;
  /** true when opened from chat clarify card ("Разбить") */
  fromChat?: boolean;
  initialAmount?: number;
  initialStore?: string;
  initialStoreId?: string;
  initialStoreGroup?: string;
  /** When set: auto-open split picker filtered to this folder (from chat tag-learning flow) */
  initialFolderId?: string;
  initialFolderName?: string;
  /** ISO date string from chat parser (e.g. "вчера", "15 мая") — pre-fills the date field */
  initialDate?: string;
  /** Chat user-message id, when entry was opened from the chat flow.
   *  Used to (a) link the saved expense back to the originating chat bubble,
   *  (b) clean up the chat bubble if the user dismisses Split without saving. */
  initialUserMsgId?: string;
}

export function FastExpenseEntry({
  initialExpense,
  fromChat = false,
  initialAmount,
  initialStore,
  initialStoreId,
  initialStoreGroup,
  initialFolderId,
  initialFolderName,
  initialDate,
  initialUserMsgId,
}: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const language = useAppSelector((s) => s.ui.language);
  const allCats = useAppSelector((s) => s.categories.expense);
  const memory = useAppSelector((s) => s.suggestionMemory);
  const { groups: folderGroups, getCatsInGroup } = useCategoryGroups('expense');
  const t = useT();
  const symbol = getCurrencySymbol(currency);
  const isEdit = !!initialExpense;

  // Plural receipt count — avoids broken t() key lookup for _one/_few/_many variants
  const fmtCount = (n: number) => {
    if (language === 'ru') {
      if (n === 1) return `1 позиция`;
      if (n >= 2 && n <= 4) return `${n} позиции`;
      return `${n} позиций`;
    }
    return n === 1 ? `1 item` : `${n} items`;
  };

  // Folders for split picker first level (UI grouping only — never saved as categoryId)
  const baseTopFolders = useMemo(
    () => folderGroups.filter((g) => g.name !== 'Savings'),
    [folderGroups],
  );

  // Real active expense categories — used for main selector, suggestions, and save
  const activeExpCats = useMemo(
    () => allCats.filter((c) => !c.archived && c.name !== 'Savings'),
    [allCats]
  );
  const folderSuggestions = useMemo(
    () => getFolderLibraryBlueprints('expense').map(folderBlueprintToSuggestion),
    [],
  );
  const categorySuggestions = useMemo(
    () => getCategoryLibraryBlueprints('expense').map(categoryBlueprintToSuggestion),
    [],
  );

  function initSelectedCatId() {
    if (!initialExpense) {
      return activeExpCats[0]?.id ?? '';
    }
    // Edit mode: use existing real category ID if it's still active
    const cat = allCats.find((c) => c.id === initialExpense.categoryId);
    if (cat && !cat.archived) return cat.id;
    return activeExpCats[0]?.id ?? '';
  }

  function initSplits(): SplitRow[] {
    const source = initialExpense?.splits?.length
      ? initialExpense.splits.map((sp: SplitItem) => ({ categoryId: sp.categoryId, amount: sp.amount }))
      : [];

    return source
      .map((sp) => {
        const cat = allCats.find((c) => c.id === sp.categoryId);
        if (!cat) return null;
        // Look up the folder for display purposes (folder ID is never saved as categoryId)
        const folder = baseTopFolders.find((f) => f.id === cat.folderId);
        return {
          categoryId: sp.categoryId,
          groupCatId: folder?.id ?? cat.id,
          name: cat.name,
          groupName: folder?.name ?? cat.name,
          icon: cat.icon,
          color: folder?.color ?? cat.color,
          amount: String(sp.amount),
        };
      })
      .filter(Boolean) as SplitRow[];
  }

  const startTotal = initialAmount != null ? String(initialAmount) : (initialExpense ? String(initialExpense.amount) : '0');

  const [total, setTotal] = useState(startTotal);
  const [selectedCatId, setSelectedCatId] = useState(initSelectedCatId);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'other'>(
    initialExpense?.paymentMethod ?? 'card'
  );
  const [comment, setComment] = useState(initialExpense?.comment ?? '');
  const [showComment, setShowComment] = useState(!!initialExpense?.comment);
  const [dateStr, setDateStr] = useState(
    toDateInput(
      initialExpense ? new Date(initialExpense.date) :
      initialDate ? new Date(initialDate + 'T12:00:00') :
      new Date()
    )
  );
  const [showDate, setShowDate] = useState(false);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const entryContextRef = useRef('');

  // Folder/category editor state (used inside split picker)
  const [showFolderEditor, setShowFolderEditor] = useState(false);
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);
  const [inlineCreating, setInlineCreating] = useState(false);

  const selectedCat = allCats.find((c) => c.id === selectedCatId);

  /** Unified expense draft — single source of truth for all suggestion/context decisions. */
  const draft = useMemo(
    () => buildExpenseDraft({ merchant: initialStore }, activeExpCats, memory),
    [initialStore, activeExpCats, memory],
  );

  const { shouldSuggestSplit, splitPresets } = draft;
  const suggestedCatIds = useMemo(
    () => (isEdit ? [] : draft.suggestedCategories.slice(0, 4).map((s) => s.categoryId)),
    [isEdit, draft.suggestedCategories],
  );
  // Only categories that were the MAIN category for this merchant (not split-only items).
  // Used for initial selectedCatId — prevents split-history categories from silently
  // becoming the leftover row when the user opens a new expense for a known merchant.
  const mainCatSuggestion = useMemo(
    () => draft.suggestedCategories.find((s) =>
      s.reasons.some((r) => r.kind === 'merchant_history' || r.kind === 'habit')
    ),
    [draft.suggestedCategories],
  );
  const historyCategoryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const id of suggestedCatIds) ids.add(id);
    for (const preset of splitPresets) {
      for (const id of preset.categoryIds) ids.add(id);
    }
    return ids;
  }, [suggestedCatIds, splitPresets]);

  const getCategoryHistoryRank = useCallback((categoryId: string) => {
    if (!historyCategoryIds.has(categoryId)) return 0;
    const suggestionIndex = suggestedCatIds.indexOf(categoryId);
    const suggestionBoost = suggestionIndex >= 0 ? 100 - suggestionIndex : 0;
    const splitBoost = splitPresets.reduce(
      (score, preset, index) => (
        preset.categoryIds.includes(categoryId)
          ? Math.max(score, 70 + preset.count * 5 - index)
          : score
      ),
      0,
    );
    return Math.max(suggestionBoost, splitBoost);
  }, [historyCategoryIds, suggestedCatIds, splitPresets]);

  const sortCategoriesByHistory = useCallback(
    (categories: Category[]) =>
      [...categories].sort((a, b) =>
        getCategoryHistoryRank(b.id) - getCategoryHistoryRank(a.id) ||
        a.name.localeCompare(b.name),
      ),
    [getCategoryHistoryRank],
  );

  // Folders this tag/merchant was previously assigned to — sort them to the top.
  const tagFolderContext = useMemo(() => {
    if (!initialStore) return {} as Record<string, number>;
    return memory.merchantContextStats[normalizeTag(initialStore)] ?? {};
  }, [initialStore, memory.merchantContextStats]);

  const topFolders = useMemo(
    () =>
      [...baseTopFolders].sort((a, b) => {
        const aCtx = tagFolderContext[a.id] ?? 0;
        const bCtx = tagFolderContext[b.id] ?? 0;
        if (aCtx !== bCtx) return bCtx - aCtx;
        const aRank = Math.max(0, ...activeExpCats
          .filter((cat) => cat.folderId === a.id || cat.extraFolderIds?.includes(a.id))
          .map((cat) => getCategoryHistoryRank(cat.id)));
        const bRank = Math.max(0, ...activeExpCats
          .filter((cat) => cat.folderId === b.id || cat.extraFolderIds?.includes(b.id))
          .map((cat) => getCategoryHistoryRank(cat.id)));
        return bRank - aRank || a.name.localeCompare(b.name);
      }),
    [baseTopFolders, activeExpCats, getCategoryHistoryRank, tagFolderContext],
  );
  const noFolders = topFolders.length === 0;

  const totalNum = parseFloat(total) || 0;

  // Compute initial splits once at mount
  const [initialSplitsOnce] = useState(initSplits);

  const splitEditor = useSplitEditor({
    totalNum,
    topFolders,
    selectedCatId,
    selectedCat,
    initialSplits: initialSplitsOnce,
    onSplitAdded: () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }),
  });
  const {
    splits, editing, setEditing, pickerOpen, pickerGroupId, setPickerGroupId,
    addSplit, removeSplit, openPicker, closePicker, tapOnSplit,
    splitsSum, remainder, splitsOverflow, posCount,
  } = splitEditor;

  // Track selected folder for the chat tag-learning flow
  const [activeFolderId, setActiveFolderId] = useState<string | null>(initialFolderId ?? null);
  const activeFolder = useMemo(
    () => (activeFolderId ? topFolders.find((folder) => folder.id === activeFolderId) ?? null : null),
    [activeFolderId, topFolders],
  );
  const activeFolderCats = useMemo(
    () => (activeFolderId ? sortCategoriesByHistory(getCatsInGroup(activeFolderId)) : []),
    [activeFolderId, getCatsInGroup, sortCategoriesByHistory],
  );

  useEffect(() => {
    if (initialExpense) return;

    const entryContextKey = `${initialStore ?? ''}|${initialFolderId ?? ''}`;
    if (entryContextRef.current === entryContextKey) return;
    entryContextRef.current = entryContextKey;

    setActiveFolderId(initialFolderId ?? null);

    if (initialFolderId) {
      setSelectedCatId('');
      if (getCatsInGroup(initialFolderId).length === 0) {
        openPicker();
        setPickerGroupId(initialFolderId);
      }
      return;
    }

    if (fromChat && initialStore) {
      setSelectedCatId('');
      return;
    }

    const mainId = mainCatSuggestion && activeExpCats.some((c) => c.id === mainCatSuggestion.categoryId)
      ? mainCatSuggestion.categoryId
      : '';
    setSelectedCatId(mainId || activeExpCats[0]?.id || '');
  }, [initialExpense, initialStore, initialFolderId, fromChat, mainCatSuggestion, activeExpCats, getCatsInGroup, openPicker, setPickerGroupId]);

  const handleFolderSwitch = useCallback((folderId: string) => {
    setActiveFolderId(folderId);
    setSelectedCatId('');
    if (getCatsInGroup(folderId).length === 0) {
      openPicker();
      setPickerGroupId(folderId);
    }
  }, [getCatsInGroup, openPicker, setPickerGroupId]);

  function tap(key: NumKey) {
    if (editing === 'total') {
      setTotal((cur) => applyKey(cur, String(key)));
    } else {
      tapOnSplit(editing, String(key));
    }
  }

  // Cancel from chat-driven Split → remove originating chat bubble (saves nothing)
  const handleClose = useCallback(async () => {
    if (fromChat && initialUserMsgId && user) {
      dispatch(removeChatMessage(initialUserMsgId));
      try {
        const { deleteMessage } = await import('@/features/chat/services/messagesService');
        await deleteMessage(user.id, initialUserMsgId);
      } catch { /* ignore */ }
    }
    router.back();
  }, [fromChat, initialUserMsgId, user, dispatch, router]);

  function changeCategory(id: string) {
    setSelectedCatId(id);
    setEditing('total');
  }

  async function handleSave() {
    if (!user || totalNum <= 0 || saving) return;
    if (splitsOverflow) {
      window.alert(t('expense.splitExceedsTotal'));
      return;
    }

    const splitItems: SplitItem[] = splits
      .filter((sp) => parseFloat(sp.amount) > 0)
      // Guard: only include splits whose categoryId is a real active category
      .filter((sp) => activeExpCats.some((c) => c.id === sp.categoryId))
      .map((sp) => ({ categoryId: sp.categoryId, amount: parseFloat(sp.amount) }));

    const selectedCatValid = activeExpCats.some((c) => c.id === selectedCatId);
    const selectedCatInActiveFolder = activeFolderId
      ? activeFolderCats.some((cat) => cat.id === selectedCatId)
      : true;
    const needsExplicitCategoryForRemainder =
      splits.length > 0 && remainder > 0.01 && (!selectedCatValid || !selectedCatInActiveFolder);

    if (needsExplicitCategoryForRemainder) {
      window.alert(t('expense.selectRemainderCategory'));
      return;
    }

    const splitFullyCoversTotal = splitItems.length > 0 && remainder <= 0.01;
    const effectiveCatId = (
      splitFullyCoversTotal && (!selectedCatValid || !selectedCatInActiveFolder)
        ? (splitItems[0]?.categoryId ?? '')
        : activeFolderId
        ? (
            selectedCatValid && selectedCatInActiveFolder
              ? selectedCatId
              : (splitItems[0]?.categoryId ?? '')
          )
        : (
            selectedCatValid
              ? selectedCatId
              : (mainCatSuggestion?.categoryId || activeExpCats[0]?.id || '')
          )
    );
    if (!effectiveCatId) return;

    setSaving(true);

    const base = {
      userId: user.id,
      currency,
      date: new Date(dateStr),
      paymentMethod,
      tags: [] as string[],
      privacy: 'regular' as const,
      comment: normalizeName(comment) || undefined,
      amount: totalNum,
      categoryId: effectiveCatId,
      splits: splitItems,
      ...(initialStore ? { store: normalizeName(initialStore) } : {}),
      ...(initialStoreId ? { storeId: initialStoreId } : {}),
      ...(initialStoreGroup ? { storeGroup: initialStoreGroup } : {}),
    };

    try {
      if (isEdit && initialExpense) {
        const updated = await updateExpense({ ...base, id: initialExpense.id, previousExpense: initialExpense });
        dispatch(updateExpenseAction(updated));
        router.push(`/expenses/${initialExpense.id}`);
      } else {
        const exp = await addExpense(base);
        dispatch(prependExpense(exp));
        const effectiveCat = activeExpCats.find((c) => c.id === effectiveCatId);
        dispatch(recordExpense({
          merchant: initialStore,
          categoryId: effectiveCatId,
          folderId: effectiveCat?.folderId ?? undefined,
          date: dateStr,
        }));
        if (splitItems.length > 0) {
          const allSplitCatIds = Array.from(new Set([effectiveCatId, ...splitItems.map((s) => s.categoryId)]));
          dispatch(recordSplitExpense({
            merchant: initialStore,
            categoryIds: allSplitCatIds,
            folderIds: allSplitCatIds.map((id) => activeExpCats.find((c) => c.id === id)?.folderId ?? undefined),
            date: dateStr,
          }));
          const tags = initialStore ? extractTags(initialStore) : [];
          if (tags.length > 0) {
            for (const catId of allSplitCatIds) {
              dispatch(recordTagAssociation({ tags, categoryId: catId, date: dateStr, source: 'split' }));
            }
          }
        }
        if (initialStore && initialFolderId) {
          dispatch(recordMerchantContext({ merchant: initialStore, folderId: initialFolderId, date: dateStr }));
        }
        if (fromChat) {
          // Link the originating chat bubble to the saved expense
          const { addMessage, updateMessage } = await import('@/features/chat/services/messagesService');
          if (initialUserMsgId) {
            try {
              await updateMessage(user.id, initialUserMsgId, { expenseId: exp.id, status: 'saved' });
            } catch { /* non-blocking */ }
          }
          // Add bot "split saved" message to chat
          const symMap: Record<string, string> = { ILS: '₪', USD: '$', CAD: 'CA$', RUB: '₽' };
          const sym = symMap[currency] ?? currency;
          const storeLabel = initialStore ? ` · ${initialStore}` : '';
          await addMessage({
            userId: user.id,
            senderId: 'bot',
            kind: 'bot',
            text: `Сохранено${storeLabel} · ${sym}\u202F${totalNum}`,
            status: 'saved',
            expenseId: exp.id,
            card: {
              kind: 'saved',
              data: {
                icon: effectiveCat?.icon ?? activeFolder?.icon ?? 'box',
                color: effectiveCat?.color ?? activeFolder?.color ?? '#E07A5F',
                title: initialStore ?? t.cat(effectiveCat?.name ?? selectedCat?.name ?? activeFolder?.name ?? ''),
                catName: null,
                groupName: null,
                hint: posCount > 1 ? `сплит · ${posCount} поз.` : undefined,
                amount: totalNum,
                currency: sym,
                expenseId: exp.id,
                ...(initialUserMsgId ? { userMsgId: initialUserMsgId } : {}),
              },
            },
          });
          router.push('/home');
        } else {
          router.push('/expenses');
        }
      }
    } catch {
      setSaving(false);
    }
  }

  if (!user) return null;

  const displayIcon = selectedCat?.icon ?? activeFolder?.icon ?? 'box';
  // Merchant tag from chat always wins as the title; selecting a section/category
  // only feeds learning (it does not rename "Даббах 1000" into "Супермаркет").
  const displayName = initialStore
    ? initialStore
    : selectedCat
      ? t.cat(selectedCat.name)
      : activeFolder
        ? t.cat(activeFolder.name)
        : t('expense.category');
  const catColor = selectedCat?.color ?? activeFolder?.color ?? '#E07A5F';
  const selectedCatInActiveFolderForUi = activeFolderId
    ? activeFolderCats.some((cat) => cat.id === selectedCatId)
    : true;
  const missingRemainderCategory =
    splits.length > 0 && remainder > 0.01 && (!selectedCat || !selectedCatInActiveFolderForUi);

  // Picker: folder → real categories in that folder
  // pickerGroupId is a folder ID — look up in topFolders, NOT allCats
  const pickerGroupFolder = pickerGroupId ? topFolders.find((f) => f.id === pickerGroupId) : null;
  const pickerGroupCats = pickerGroupId ? sortCategoriesByHistory(getCatsInGroup(pickerGroupId)) : [];

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:bg-black/50 lg:backdrop-blur-sm">
    <div className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }} suppressHydrationWarning>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
          {isEdit
            ? t('expense.numpadEdit')
            : fromChat && initialStore
              ? t('expense.numpadReceipt', { store: initialStore })
              : fmtCount(splits.length + 1)}
        </div>
        <div className="w-8" />
      </div>

      {/* ── Total ── */}
      <div
        onClick={() => { setEditing('total'); setShowDate(false); setShowComment(false); }}
        className={cn(
          'mx-4 px-4 py-1.5 rounded-[18px] cursor-pointer flex items-baseline justify-between flex-shrink-0 transition-all border-[1.5px]',
          editing === 'total' ? 'bg-primary/10 border-primary' : 'bg-transparent border-transparent'
        )}
      >
        <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t('expense.numpadTotal')}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-muted-foreground">{symbol}</span>
          <span className="text-[32px] font-black text-foreground tracking-[-0.03em] leading-none tabular-nums">
            {total}
          </span>
        </div>
      </div>

      {initialFolderId ? (
        /* ── Разделы chips (chat tag-learning flow) ── */
        <div className="px-3.5 pb-2 flex-shrink-0">
          <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-[.08em] mb-1.5">
            Разделы
          </div>
          {topFolders.length === 0 ? (
            <button
              onClick={() => {/* handled by CategoriesHub */}}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold border-2 border-dashed"
              style={{ borderColor: catColor + '77', color: catColor }}
            >
              <Plus size={12} strokeWidth={2.5} />
              Создать раздел
            </button>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {topFolders.map((f) => {
                const sel = f.id === activeFolderId;
                const fc = f.color ?? '#E07A5F';
                return (
                  <button
                    key={f.id}
                    onClick={() => handleFolderSwitch(f.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all"
                    style={{
                      background: sel ? fc : fc + '18',
                      color: sel ? '#fff' : fc,
                      border: `1.5px solid ${sel ? fc : fc + '44'}`,
                    }}
                  >
                    <StickerIcon icon={f.icon ?? 'box'} color={sel ? '#fff' : fc} className="h-3 w-3" />
                    {t.cat(f.name)}
                  </button>
                );
              })}
            </div>
          )}

        </div>
      ) : (
        /* ── Category grid (main category for leftover) — real categories, never folder IDs ── */
        <div className="overflow-x-auto px-3.5 py-2 flex-shrink-0 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          <div className="grid grid-rows-2 grid-flow-col gap-1.5" style={{ gridAutoColumns: '64px' }}>
            {sortCategoriesByHistory(activeExpCats).map((cat) => {
              const sel = cat.id === selectedCatId;
              const cc = cat.color ?? '#E07A5F';
              return (
                <button
                  key={cat.id}
                  onClick={() => changeCategory(cat.id)}
                  className="w-[64px] h-[46px] rounded-[12px] flex flex-col items-center justify-center gap-0.5 transition-all border-0"
                  style={{
                    background: sel ? cc : 'hsl(var(--card))',
                    boxShadow: sel ? `0 3px 8px ${cc}55` : '0 1px 3px rgba(61,44,31,.06)',
                  }}
                >
                  <StickerIcon icon={cat.icon ?? 'box'} color={sel ? '#fff' : cc} className="h-4 w-4" />
                  <span
                    className="text-[9px] font-extrabold leading-tight text-center px-0.5 line-clamp-1"
                    style={{ color: sel ? '#fff' : 'hsl(var(--foreground))' }}
                  >
                    {t.cat(cat.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Split table ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-1.5 min-h-0 [scrollbar-width:none]"
      >
        {/* Parent/leftover row */}
        <div
          className="bg-card rounded-[14px] p-3 flex items-center gap-3 flex-shrink-0"
          style={{
            boxShadow: '0 1px 3px rgba(61,44,31,.06)',
            border: splitsOverflow ? '1.5px solid hsl(var(--destructive))' : '1.5px solid transparent',
          }}
        >
          <CategoryIcon icon={displayIcon} color={catColor} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-extrabold text-foreground">
              {displayName}
              {splits.length > 0 && (
                <span className="text-xs font-semibold text-muted-foreground ml-1">· общее</span>
              )}
            </div>
            {activeFolderId && !selectedCat && splits.length === 0 && (
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">{t('categories.selectCategory')}</div>
            )}
            {missingRemainderCategory ? (
              <div className="text-[11px] text-destructive font-semibold mt-0.5">{t('expense.selectRemainderCategory')}</div>
            ) : splits.length > 0 && (
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">остаток после уточнений</div>
            )}
            {splitsOverflow && (
              <div className="text-[9px] font-bold text-destructive mt-0.5">
                превышено на {symbol}{(splitsSum - totalNum).toFixed(2)}
              </div>
            )}
          </div>
          <span className="text-lg font-black text-foreground tabular-nums">
            {symbol}{splits.length > 0 ? remainder : total}
          </span>
        </div>

        {/* Split rows */}
        {splits.map((sp, i) => {
          const isEditing = editing === i;
          return (
            <div
              key={i}
              onClick={() => setEditing(i)}
              className="rounded-xl px-3 py-2 flex items-center gap-2.5 cursor-pointer transition-all border-[1.5px] flex-shrink-0"
              style={{
                marginLeft: 18,
                background: isEditing ? sp.color + '18' : 'hsl(var(--card))',
                borderColor: isEditing ? sp.color : 'transparent',
                boxShadow: '0 1px 2px rgba(61,44,31,.05)',
              }}
            >
              <div
                className="h-[26px] w-[26px] rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: sp.color + '22' }}
              >
                <StickerIcon icon={sp.icon} color={sp.color} className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground">{t.cat(sp.name)}</div>
                {sp.groupName && sp.groupCatId !== selectedCatId && (
                  <div className="text-[10px] text-muted-foreground font-semibold">{t.cat(sp.groupName)}</div>
                )}
              </div>
              <span className="text-sm font-black text-foreground tabular-nums">{symbol}{sp.amount}</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeSplit(i); }}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm px-1"
              >
                ✕
              </button>
            </div>
          );
        })}

        {/* Add split button row */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => {
              if (activeFolderId) setPickerGroupId(activeFolderId);
              openPicker();
            }}
            className="flex-1 rounded-[14px] py-2.5 flex items-center justify-center gap-1.5 text-sm font-extrabold transition-all border-2 border-dashed"
            style={{ borderColor: catColor + '77', color: catColor, background: 'transparent' }}
          >
            <span className="text-lg leading-none">＋</span>
            {initialFolderId
              ? 'Уточнить позицию'
              : shouldSuggestSplit && splits.length === 0
                ? 'Разбить на позиции'
                : 'Уточнить позицию'}
          </button>
        </div>

        {/* Group category picker */}
        {pickerOpen && (
          <div
            className="bg-card rounded-[14px] p-2.5 flex-shrink-0"
            style={{ boxShadow: '0 1px 3px rgba(61,44,31,.08)' }}
          >
            {/* Picker header — when inside a folder the back arrow + label is
                one large tap target (44px high) so it works on small phones. */}
            <div className="flex items-center gap-1 pb-2">
              {pickerGroupId ? (
                <button
                  type="button"
                  onClick={() => setPickerGroupId(null)}
                  aria-label="Назад к разделам"
                  className="flex min-h-[44px] flex-1 items-center gap-1.5 rounded-[10px] px-2 -ml-1 active:bg-muted/60 transition-colors"
                  style={{ color: pickerGroupFolder?.color ?? 'hsl(var(--muted-foreground))' }}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                  <span className="text-[11px] font-extrabold uppercase tracking-[.08em]">
                    {t.cat(pickerGroupFolder?.name ?? '')}
                  </span>
                </button>
              ) : (
                <div
                  className="flex min-h-[44px] flex-1 items-center px-2 text-[11px] font-extrabold uppercase tracking-[.08em]"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                >
                  Разделы
                </div>
              )}
              <button
                type="button"
                onClick={() => closePicker()}
                aria-label="Закрыть"
                className="flex h-11 w-11 items-center justify-center rounded-[10px] text-muted-foreground hover:text-foreground active:bg-muted/60 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {noFolders ? (
              /* Fallback: no folders loaded — show all active categories directly,
                 and always expose "Create section" so a fresh user is not stuck. */
              <div>
                {activeExpCats.length > 0 ? (
                  <div className="grid grid-cols-4 gap-1.5">
                    {activeExpCats.map((cat) => {
                      const selected = !!splits.find((x) => x.categoryId === cat.id);
                      const c = cat.color ?? '#E07A5F';
                      return (
                        <button
                          key={cat.id}
                          onClick={() => selected ? removeSplit(splits.findIndex((x) => x.categoryId === cat.id)) : addSplit(cat)}
                          className="flex flex-col items-center gap-0.5 px-0.5 py-1.5 rounded-[9px] text-[9px] font-extrabold text-foreground border transition-all"
                          style={{ background: selected ? c + '30' : c + '14', borderColor: selected ? c : 'transparent' }}
                        >
                          <StickerIcon icon={cat.icon ?? 'box'} color={c} className="h-3.5 w-3.5" />
                          <span className="leading-tight text-center line-clamp-1">{t.cat(cat.name)}</span>
                          {selected && <span className="text-[8px]" style={{ color: c }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground py-3">
                    Пока нет разделов — создайте первый, чтобы продолжить.
                  </p>
                )}
                <button
                  onClick={() => setShowFolderEditor(true)}
                  className="mt-1 flex w-full min-h-[44px] items-center justify-center gap-1.5 rounded-[10px] border border-dashed text-[11px] font-extrabold"
                  style={{ borderColor: catColor + '55', color: catColor }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Создать раздел
                </button>
              </div>
            ) : pickerGroupId === null ? (
              /* Show folders — tap a folder to see real categories inside */
              <div>
                {/* Folder tiles */}
                <div className="grid grid-cols-4 gap-1.5">
                  {topFolders.map((folder) => {
                    const c = folder.color ?? '#E07A5F';
                    return (
                      <button
                        key={folder.id}
                        onClick={() => setPickerGroupId(folder.id)}
                        className="flex flex-col items-center gap-0.5 px-0.5 py-2 rounded-[9px] text-[9px] font-extrabold text-foreground border transition-all"
                        style={{ background: c + '18', borderColor: 'transparent' }}
                      >
                        <StickerIcon icon={folder.icon ?? 'box'} color={c} className="h-4 w-4" />
                        <span className="leading-tight text-center line-clamp-1">{t.cat(folder.name)}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Create new section button */}
                <button
                  onClick={() => setShowFolderEditor(true)}
                  className="col-span-4 flex items-center justify-center gap-1 py-1.5 rounded-[9px] text-[9px] font-extrabold border border-dashed mt-1"
                  style={{ borderColor: catColor + '55', color: catColor }}
                >
                  <Plus size={10} strokeWidth={2.5} />
                  Создать раздел
                </button>
              </div>
            ) : (
              /* Show categories in selected folder group */
              <div className="grid grid-cols-4 gap-1.5">
                {pickerGroupCats.map((s) => {
                  const selected = !!splits.find((x) => x.categoryId === s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() =>
                        selected
                          ? removeSplit(splits.findIndex((x) => x.categoryId === s.id))
                          : addSplit(s)
                      }
                      className="flex flex-col items-center gap-0.5 px-0.5 py-1.5 rounded-[9px] text-[9px] font-extrabold text-foreground border transition-all"
                      style={{
                        background: selected ? (pickerGroupFolder?.color ?? catColor) + '30' : (pickerGroupFolder?.color ?? catColor) + '14',
                        borderColor: selected ? (pickerGroupFolder?.color ?? catColor) : 'transparent',
                      }}
                    >
                      <StickerIcon icon={s.icon} color={pickerGroupFolder?.color ?? catColor} className="h-3.5 w-3.5" />
                      <span className="leading-tight text-center line-clamp-1">{t.cat(s.name)}</span>
                      {selected && <span className="text-[8px]" style={{ color: pickerGroupFolder?.color ?? catColor }}>✓</span>}
                    </button>
                  );
                })}
                {/* Open CategoryEditorSheet for inline category creation */}
                <button
                  onClick={() => setShowCategoryEditor(true)}
                  className="col-span-4 flex items-center justify-center gap-1 py-1.5 rounded-[9px] text-[9px] font-extrabold border border-dashed mt-0.5"
                  style={{ borderColor: (pickerGroupFolder?.color ?? catColor) + '55', color: pickerGroupFolder?.color ?? catColor }}
                  disabled={inlineCreating}
                >
                  <Plus size={10} strokeWidth={2.5} />
                  {inlineCreating ? '…' : 'Создать категорию'}
                </button>
              </div>
            )}
          </div>
        )}

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
                const d = parseISO(dateStr);
                if (isToday(d)) return 'Сегодня';
                if (isYesterday(d)) return 'Вчера';
                return format(d, 'd MMMM yyyy', { locale: ru });
              })()}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {showDate && (
            <div style={{ borderTop: `1px solid ${catColor}22` }}>
              <MiniCalendar value={dateStr} onChange={(d) => { setDateStr(d); setShowDate(false); }} color={catColor} />
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

      </div>

      {/* ── Payment method ── */}
      <div className="px-3 pb-1 flex gap-2 flex-shrink-0">
        {(['card', 'cash', 'other'] as const).map((m) => {
          const icons = { card: '💳', cash: '💵', other: '🔄' };
          const labels = { card: t('expense.card'), cash: t('expense.cash'), other: t('expense.other') };
          const sel = paymentMethod === m;
          return (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[11px] font-bold transition-all border"
              style={{
                background: sel ? catColor + '18' : 'hsl(var(--card))',
                borderColor: sel ? catColor : 'transparent',
                color: sel ? catColor : 'hsl(var(--muted-foreground))',
              }}
            >
              <span>{icons[m]}</span>
              <span>{labels[m]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Numpad ── */}
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

      {/* ── Save bar ── */}
      <div className="px-4 pt-1.5 pb-safe flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button
          onClick={handleSave}
          disabled={saving || totalNum <= 0 || splitsOverflow}
          className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-primary-foreground transition-opacity disabled:opacity-50 border-0"
          style={{
            background: catColor,
            boxShadow: `0 12px 24px ${catColor}60`,
          }}
        >
          <StickerIcon icon={displayIcon} color="#fff" className="h-5 w-5" />
          <span>{saving ? t('expense.numpadSaving') : isEdit ? t('expense.numpadSaveEdit', { symbol, total }) : t('expense.numpadSave', { symbol, total })}</span>
          {!isEdit && <span className="opacity-75 font-bold text-[13px]">· {fmtCount(posCount)}</span>}
        </button>
      </div>
    </div>
    </div>

    {/* ── FolderEditorSheet: create new section from split picker ── */}
    <FolderEditorSheet
      open={showFolderEditor}
      onClose={() => setShowFolderEditor(false)}
      type="expense"
      suggestions={folderSuggestions}
      onSave={async (data: Omit<CategoryFolder, 'id' | 'userId'> & { id?: string }) => {
        if (!user) return;
        const { id: _id, ...rest } = data;
        const newFolder = await addFolderToDb(user.id, rest);
        dispatch(addFolderAction(newFolder));
        setPickerGroupId(newFolder.id);
        setActiveFolderId(newFolder.id);
        setSelectedCatId('');
        setShowCategoryEditor(true);
        setShowFolderEditor(false);
      }}
    />

    {/* ── CategoryEditorSheet: create new category from split picker ── */}
    <CategoryEditorSheet
      open={showCategoryEditor}
      onClose={() => setShowCategoryEditor(false)}
      type="expense"
      folderId={pickerGroupId ?? undefined}
      initial={{ folderId: pickerGroupId ?? undefined }}
      availableFolders={topFolders as unknown as CategoryFolder[]}
      suggestions={categorySuggestions}
      onSave={async (catData) => {
        const name = catData.name?.trim();
        if (!name || !user || inlineCreating) return;
        setInlineCreating(true);
        try {
          const color = catData.color ?? pickerGroupFolder?.color ?? '#94A3B8';
          const newCat = await addCategoryFirestore(user.id, {
            name,
            icon: catData.icon ?? 'box',
            color,
            folderId: catData.folderId ?? pickerGroupId ?? undefined,
            isPrivate: catData.isPrivate ?? false,
            order: 99,
            type: 'expense',
            ...(catData.tags ? { tags: catData.tags } : {}),
          });
          dispatch(addCategoryAction(newCat));
          addSplit(newCat);
        } finally {
          setInlineCreating(false);
          setShowCategoryEditor(false);
        }
      }}
    />
    </>
  );
}
