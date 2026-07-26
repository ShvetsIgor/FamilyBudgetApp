'use client';

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, MessageSquare, Calendar, ChevronRight } from 'lucide-react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { getDateFnsLocale } from '@/shared/utils/dateLocale';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { removeMessage as removeChatMessage } from '@/features/chat/store/chatSlice';
import { MiniCalendar, toDateInput } from '@/shared/components/MiniCalendar';
import { prependExpense, updateExpense as updateExpenseAction } from '@/features/expenses/store/expensesSlice';
import { addExpense, updateExpense } from '@/features/expenses/services/expensesService';
import { resolveExpensePrivacy } from '@/features/expenses/utils/expensePrivacy';
import { CategoryIcon, StickerIcon } from '@/features/categories/components/CategoryIcon';
import { getCurrencySymbol } from '@/shared/utils/currency';
import { cn } from '@/shared/utils/cn';
import { useT } from '@/shared/hooks/useT';
import { recordSavedCard, buildEntryDateHint } from '@/features/chat/services/savedCardService';
import { normalizeName, normalizeNameKey } from '@/shared/utils/normalizeName';
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
import { CategoryFolderPickerSheet, type CategoryPickerFolder } from '@/features/categories/components/CategoryFolderPickerSheet';
import { EntryKindTabs } from '@/features/quickadd/components/EntryKindTabs';
import { paymentMethodIcon } from '@/shared/config/domainIcons';
import { haptic } from '@/shared/utils/haptics';
import {
  categoryBlueprintToSuggestion,
  folderBlueprintToSuggestion,
  getCategoryLibraryBlueprints,
  getFolderLibraryBlueprints,
} from '@/features/categories/utils/libraryLookup';

const NUMPAD_KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, '⌫'] as const;
type NumKey = (typeof NUMPAD_KEYS)[number];
type EntryMode = 'single' | 'split';


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
  /** Opens the compact flow directly in split mode after explicit user choice. */
  initialMode?: EntryMode;
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
  initialMode,
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
  const dfLocale = getDateFnsLocale(language);
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
    () => getFolderLibraryBlueprints('expense').map((b) => folderBlueprintToSuggestion(b, language)),
    [language],
  );
  const categorySuggestions = useMemo(
    () => getCategoryLibraryBlueprints('expense').map((b) => categoryBlueprintToSuggestion(b, language)),
    [language],
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
  const [entryMode, setEntryMode] = useState<EntryMode>(
    initialExpense?.splits?.length ? 'split' : initialMode ?? 'single',
  );
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
  const [categorySheetMode, setCategorySheetMode] = useState<EntryMode | null>(
    fromChat && initialMode === 'split' ? 'split' : null,
  );
  const [newCategoryFolderId, setNewCategoryFolderId] = useState<string | null>(null);
  const [returnToCategorySheetMode, setReturnToCategorySheetMode] = useState<EntryMode | null>(null);
  const [amountEditorTarget, setAmountEditorTarget] = useState<'total' | number | null>(null);

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
    return memory.merchantContextStats?.[normalizeTag(initialStore)] ?? {};
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
    splits, editing, setEditing,
    addSplit, removeSplit, tapOnSplit,
    splitsSum, remainder, splitsOverflow, posCount,
  } = splitEditor;

  // Track selected folder for the chat tag-learning flow
  const [activeFolderId, setActiveFolderId] = useState<string | null>(initialFolderId ?? null);
  const activeFolder = useMemo(
    () => (activeFolderId ? topFolders.find((folder) => folder.id === activeFolderId) ?? null : null),
    [activeFolderId, topFolders],
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
        setCategorySheetMode('single');
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
    // Fall back to the most recently used category, not the first in list —
    // a blind "amount → save" should land in the user's usual category
    const recentId = suggestedCatIds.find((id) => activeExpCats.some((c) => c.id === id)) ?? '';
    setSelectedCatId(mainId || recentId || activeExpCats[0]?.id || '');
  }, [initialExpense, initialStore, initialFolderId, fromChat, mainCatSuggestion, suggestedCatIds, activeExpCats, getCatsInGroup]);

  function tap(key: NumKey) {
    if (editing === 'total') {
      setTotal((cur) => applyKey(cur, String(key)));
    } else {
      tapOnSplit(editing, String(key));
    }
  }

  function openAmountEditor(target: 'total' | number) {
    setEditing(target);
    setAmountEditorTarget(target);
    setShowDate(false);
    setShowComment(false);
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

  function changeCategory(cat: Category, folder?: CategoryPickerFolder | null) {
    setSelectedCatId(cat.id);
    setActiveFolderId(folder?.id ?? cat.folderId ?? null);
    setEditing('total');
  }

  function handleCategorySheetSelect(cat: Category, folder?: CategoryPickerFolder | null) {
    if (categorySheetMode === 'split') {
      const existingIndex = splits.findIndex((split) => split.categoryId === cat.id);
      const targetIndex = existingIndex >= 0 ? existingIndex : splits.length;
      addSplit(cat, folder);
      openAmountEditor(targetIndex);
      setCategorySheetMode(null);
      return;
    }
    changeCategory(cat, folder);
    setCategorySheetMode(null);
    openAmountEditor('total');
  }

  function openCreateCategory(folderId: string | null) {
    setReturnToCategorySheetMode(categorySheetMode ?? entryMode);
    setCategorySheetMode(null);
    setNewCategoryFolderId(folderId);
    setShowCategoryEditor(true);
  }

  function openCreateFolder() {
    setReturnToCategorySheetMode(categorySheetMode ?? entryMode);
    setCategorySheetMode(null);
    setShowFolderEditor(true);
  }

  function closeCategoryEditor() {
    setShowCategoryEditor(false);
    setNewCategoryFolderId(null);
    if (returnToCategorySheetMode) {
      setCategorySheetMode(returnToCategorySheetMode);
      setReturnToCategorySheetMode(null);
    }
  }

  async function handleSave() {
    if (!user || totalNum <= 0 || saving) return;
    if (splitsOverflow) {
      window.alert(t('expense.splitExceedsTotal'));
      return;
    }

    const splitItems: SplitItem[] = entryMode === 'split'
      ? splits
      .filter((sp) => parseFloat(sp.amount) > 0)
      // Guard: only include splits whose categoryId is a real active category
      .filter((sp) => activeExpCats.some((c) => c.id === sp.categoryId))
        .map((sp) => ({ categoryId: sp.categoryId, amount: parseFloat(sp.amount) }))
      : [];

    const selectedCatValid = activeExpCats.some((c) => c.id === selectedCatId);
    if (entryMode === 'single' && !selectedCatValid) {
      window.alert(t('categories.selectCategory'));
      return;
    }

    if (entryMode === 'split') {
      const validSplitSum = splitItems.reduce((sum, item) => sum + item.amount, 0);
      if (splitItems.length === 0 || Math.abs(totalNum - validSplitSum) > 0.01) {
        window.alert(t('expense.splitDistributeAll'));
        return;
      }
    }

    const effectiveCatId = entryMode === 'split'
      ? [...splitItems].sort((a, b) => b.amount - a.amount)[0]?.categoryId ?? ''
      : selectedCatId;
    if (!effectiveCatId) return;

    setSaving(true);

    const base = {
      userId: user.id,
      currency,
      date: new Date(dateStr),
      paymentMethod,
      // Editing must not wipe tags like 'savings'/'recurring'.
      tags: (isEdit && initialExpense?.tags ? initialExpense.tags : []) as string[],
      // Private category (main or any split) → owner-only secret; an existing
      // secret is never silently downgraded on edit.
      privacy: resolveExpensePrivacy({
        categories: activeExpCats,
        categoryId: effectiveCatId,
        splitCategoryIds: splitItems.map((item) => item.categoryId),
        previousPrivacy: isEdit ? initialExpense?.privacy : undefined,
      }),
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
        haptic('success');
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
        // Secondary chat-history write: MUST NOT undo the saved expense or
        // block navigation. A failure here is logged and swallowed, otherwise
        // the form would stay open and a retry would duplicate the expense.
        try {
          if (initialUserMsgId) {
            const { updateMessage } = await import('@/features/chat/services/messagesService');
            await updateMessage(user.id, initialUserMsgId, { expenseId: exp.id, status: 'saved' });
          }
          const storeLabel = initialStore ? ` · ${initialStore}` : '';
          const splitHint = posCount > 1 ? `${t('expense.split2')} · ${fmtCount(posCount)}` : undefined;
          const combinedHint = [buildEntryDateHint(dateStr, t, dfLocale), splitHint].filter(Boolean).join(' · ') || undefined;
          await recordSavedCard({
            userId: user.id,
            text: `${t('home.saved')}${storeLabel} · ${symbol}\u202F${totalNum}`,
            icon: effectiveCat?.icon ?? activeFolder?.icon ?? 'box',
            color: effectiveCat?.color ?? activeFolder?.color ?? '#E07A5F',
            title: initialStore ?? t.cat(effectiveCat?.name ?? selectedCat?.name ?? activeFolder?.name ?? ''),
            hint: combinedHint,
            amount: totalNum,
            currencySymbol: symbol,
            expenseId: exp.id,
            ...(initialUserMsgId ? { userMsgId: initialUserMsgId } : {}),
          });
        } catch (err) {
          console.error('chat card write failed (expense already saved)', err);
        }
        router.push(fromChat ? '/home' : '/expenses');
      }
    } catch {
      // Only the FINANCIAL write reaches here — re-enable retry.
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
  const selectedCategoryIdsForSheet = entryMode === 'split'
    ? splits.map((sp) => sp.categoryId)
    : selectedCatId
      ? [selectedCatId]
      : [];
  const splitModeInvalid = entryMode === 'split' && (
    splits.length === 0 ||
    splitsOverflow ||
    remainder > 0.01
  );
  const saveDisabled =
    saving ||
    totalNum <= 0 ||
    splitsOverflow ||
    (entryMode === 'single' && !selectedCat) ||
    splitModeInvalid;
  const amountEditorSplit = typeof amountEditorTarget === 'number'
    ? splits[amountEditorTarget] ?? null
    : null;
  const amountEditorOpen = amountEditorTarget === 'total' || !!amountEditorSplit;
  const amountEditorIcon = amountEditorSplit?.icon ?? displayIcon;
  const amountEditorColor = amountEditorSplit?.color ?? catColor;
  const amountEditorTitle = amountEditorSplit
    ? t.cat(amountEditorSplit.name)
    : entryMode === 'single' && selectedCat
      ? t.cat(selectedCat.name)
      : t('expense.numpadTotal');
  const amountEditorValue = amountEditorTarget === 'total'
    ? total
    : amountEditorSplit?.amount ?? '0';

  return (
    <>
    <div className="fb-sheet-enter fixed inset-0 z-50 flex items-end lg:items-center justify-center lg:bg-black/50 lg:backdrop-blur-sm">
    <div className="flex flex-col bg-background w-full lg:max-w-[440px] lg:rounded-2xl lg:shadow-2xl overflow-hidden" style={{ height: '100dvh', maxHeight: '100dvh' }} suppressHydrationWarning>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 pt-1 pb-0.5 flex-shrink-0">
        <button type="button" onClick={handleClose} className="fb-touch-target flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted transition-colors" aria-label={t('common.close')}>
          <X className="h-5 w-5" />
        </button>
        {/* Plain add mode gets the expense/income switch; edit and
            chat-receipt modes keep their descriptive title */}
        {!isEdit && !(fromChat && initialStore) && splits.length === 0 ? (
          <EntryKindTabs active="expense" />
        ) : (
          <div className="flex-1 text-center text-[11px] font-extrabold text-muted-foreground uppercase tracking-[.08em]">
            {isEdit
              ? t('expense.numpadEdit')
              : fromChat && initialStore
                ? t('expense.numpadReceipt', { store: initialStore })
                : fmtCount(splits.length + 1)}
          </div>
        )}
        <div className="w-8" />
      </div>

      {/* ── Total ── */}
      <button
        type="button"
        onClick={() => openAmountEditor('total')}
        className={cn(
          'mx-4 min-h-11 px-4 py-1.5 rounded-[18px] cursor-pointer flex items-baseline justify-between flex-shrink-0 transition-all border-[1.5px] text-left',
          amountEditorTarget === 'total' ? 'bg-primary/10 border-primary' : 'bg-transparent border-transparent'
        )}
      >
        <span className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{t('expense.numpadTotal')}</span>
        <div className="flex items-baseline gap-1">
          <span className="text-base font-bold text-muted-foreground">{symbol}</span>
          <span className="text-[32px] font-black text-foreground tracking-[-0.03em] leading-none tabular-nums">
            {total}
          </span>
        </div>
      </button>

      {/* ── Mode ── */}
      <div className="mx-4 mb-2 grid grid-cols-2 rounded-[16px] bg-muted p-1 flex-shrink-0">
        {(['single', 'split'] as EntryMode[]).map((mode) => {
          const selected = entryMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setEntryMode(mode);
                setEditing(mode === 'single' ? 'total' : editing);
                setAmountEditorTarget(null);
              }}
              className={cn(
                'min-h-11 rounded-[12px] text-sm font-black transition-all',
                selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
              )}
            >
              {mode === 'single' ? t('expense.singleMode') : t('expense.splitMode')}
            </button>
          );
        })}
      </div>

      {/* ── Entry rows ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-2 flex flex-col gap-1.5 min-h-0 [scrollbar-width:none]"
      >
        {entryMode === 'single' ? (
          <button
            type="button"
            onClick={() => setCategorySheetMode('single')}
            className="bg-card rounded-[16px] p-3 flex items-center gap-3 flex-shrink-0 text-left"
            style={{
              boxShadow: '0 1px 3px rgba(61,44,31,.06)',
              border: selectedCat ? '1.5px solid transparent' : '1.5px solid hsl(var(--destructive))',
            }}
          >
            <CategoryIcon icon={displayIcon} color={catColor} size="md" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extrabold text-foreground truncate">
                {selectedCat ? t.cat(selectedCat.name) : t('categories.selectCategory')}
              </div>
              <div className="text-[11px] text-muted-foreground font-semibold mt-0.5 truncate">
                {initialStore ? displayName : activeFolder ? t.cat(activeFolder.name) : t('expense.tapToPick')}
              </div>
            </div>
            <span className="text-lg font-black text-foreground tabular-nums">{symbol}{total}</span>
          </button>
        ) : (
          <>
            <div
              className="rounded-[16px] px-3 py-2.5 flex items-center gap-3 flex-shrink-0"
              style={{
                background: remainder > 0.01 || splitsOverflow ? catColor + '12' : 'hsl(var(--card))',
                border: splitsOverflow ? '1.5px solid hsl(var(--destructive))' : `1.5px solid ${remainder > 0.01 ? catColor + '55' : 'transparent'}`,
              }}
            >
              <div className="h-9 w-9 rounded-[12px] flex items-center justify-center flex-shrink-0" style={{ background: catColor + '20' }}>
                <StickerIcon icon={displayIcon} color={catColor} className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-extrabold text-foreground">{t('expense.remainderTitle')}</div>
                <div className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                  {splits.length === 0 ? t('expense.addFromFolders') : t('expense.sumMustMatch')}
                </div>
                {splitsOverflow && (
                  <div className="text-[9px] font-bold text-destructive mt-0.5">
                    {t('expense.overBy')} {symbol}{(splitsSum - totalNum).toFixed(2)}
                  </div>
                )}
              </div>
              <span className="text-lg font-black text-foreground tabular-nums">{symbol}{remainder.toFixed(2)}</span>
            </div>

            {splits.map((sp, i) => {
              const isEditing = amountEditorTarget === i;
              return (
            <div
              key={i}
              onClick={() => openAmountEditor(i)}
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
                onClick={(e) => {
                  e.stopPropagation();
                  if (amountEditorTarget === i) setAmountEditorTarget(null);
                  removeSplit(i);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm px-1"
              >
                ✕
              </button>
            </div>
              );
            })}

            <button
              type="button"
              onClick={() => setCategorySheetMode('split')}
              className="flex-1 rounded-[14px] py-2.5 flex items-center justify-center gap-1.5 text-sm font-extrabold transition-all border-2 border-dashed"
              style={{ borderColor: catColor + '77', color: catColor, background: 'transparent' }}
            >
              <span className="text-lg leading-none">＋</span>
              {shouldSuggestSplit && splits.length === 0 ? t('expense.addCategories') : t('expense.addCategory')}
            </button>
          </>
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
                if (isToday(d)) return t('common.today');
                if (isYesterday(d)) return t('common.yesterday');
                return format(d, 'd MMMM yyyy', { locale: dfLocale });
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
              {comment || t('expense.notePlaceholder')}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          {showComment && (
            <div className="px-3.5 pb-3" style={{ borderTop: `1px solid ${catColor}22` }}>
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('expense.notePlaceholder')}
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
          const labels = { card: t('expense.card'), cash: t('expense.cash'), other: t('expense.other') };
          const sel = paymentMethod === m;
          return (
            <button
              key={m}
              onClick={() => setPaymentMethod(m)}
              className="flex-1 min-h-11 flex items-center justify-center gap-1 rounded-xl text-xs font-bold transition-all border"
              style={{
                background: sel ? catColor + '18' : 'hsl(var(--card))',
                borderColor: sel ? catColor : 'transparent',
                color: sel ? catColor : 'hsl(var(--muted-foreground))',
              }}
              aria-pressed={sel}
            >
              <StickerIcon icon={paymentMethodIcon(m)} color={sel ? catColor : 'hsl(var(--muted-foreground))'} className="h-4 w-4" />
              <span>{labels[m]}</span>
            </button>
          );
        })}
      </div>

      {/* ── Save bar ── */}
      <div className="px-4 pt-1.5 pb-safe flex-shrink-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}>
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          className="w-full py-[12px] rounded-[16px] flex items-center justify-center gap-2 text-[14px] font-black text-primary-foreground transition-opacity disabled:opacity-50 border-0"
          style={{
            background: 'hsl(var(--primary))',
            boxShadow: 'var(--shadow-primary)',
          }}
        >
          <StickerIcon icon={displayIcon} color="#fff" className="h-5 w-5" />
          <span>{saving ? t('expense.numpadSaving') : isEdit ? t('expense.numpadSaveEdit', { symbol, total }) : t('expense.numpadSave', { symbol, total })}</span>
          {!isEdit && <span className="opacity-75 font-bold text-[13px]">· {fmtCount(posCount)}</span>}
        </button>
      </div>
    </div>
    </div>

    {amountEditorOpen && (
      <div
        className="fixed inset-0 z-[65] flex items-end justify-center bg-black/35 lg:items-center lg:p-6"
        onClick={() => setAmountEditorTarget(null)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={amountEditorTitle}
          className="w-full rounded-t-[24px] bg-background px-4 pb-safe pt-4 shadow-2xl lg:max-w-[360px] lg:rounded-[24px]"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 14px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]" style={{ background: amountEditorColor + '20' }}>
              <StickerIcon icon={amountEditorIcon} color={amountEditorColor} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black text-foreground">{amountEditorTitle}</div>
              <div className="text-[11px] font-bold text-muted-foreground">
                {amountEditorTarget === 'total' ? t('expense.receiptTotal') : t('expense.categoryAmount')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAmountEditorTarget(null)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t('expense.closeAmountAria')}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="mb-3 flex min-h-[64px] items-baseline justify-end rounded-[18px] border px-4 py-3"
            style={{ borderColor: amountEditorColor + '55', background: amountEditorColor + '10' }}
          >
            <span className="mr-1 text-base font-bold text-muted-foreground">{symbol}</span>
            <span className="text-[34px] font-black leading-none text-foreground tabular-nums">{amountEditorValue}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5" style={{ gridAutoRows: '44px' }}>
            {NUMPAD_KEYS.map((k) => (
              <button
                key={String(k)}
                onClick={() => tap(k)}
                className="rounded-xl bg-card font-extrabold transition-colors active:bg-muted"
                style={{
                  fontSize: typeof k === 'number' ? 21 : 16,
                  color: k === '⌫' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
                  boxShadow: '0 1px 2px rgba(61,44,31,.06)',
                }}
              >
                {k}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAmountEditorTarget(null)}
            className="mt-3 w-full rounded-[16px] py-3 text-sm font-black text-primary-foreground"
            style={{ background: amountEditorColor }}
          >
            {t('common.done')}
          </button>
        </div>
      </div>
    )}

    <CategoryFolderPickerSheet
      open={categorySheetMode !== null}
      title={categorySheetMode === 'split' ? t('expense.addCategory') : t('categories.selectCategory')}
      mode={categorySheetMode ?? 'single'}
      merchantLabel={initialStore}
      folders={topFolders}
      categories={activeExpCats}
      selectedCategoryIds={selectedCategoryIdsForSheet}
      suggestedCategoryIds={Array.from(historyCategoryIds)}
      initialFolderId={activeFolderId}
      accentColor={catColor}
      onClose={() => setCategorySheetMode(null)}
      onSelectCategory={handleCategorySheetSelect}
      onCreateFolder={openCreateFolder}
      onCreateCategory={openCreateCategory}
    />

    {/* ── FolderEditorSheet: create new section from split picker ── */}
    <FolderEditorSheet
      open={showFolderEditor}
      onClose={() => setShowFolderEditor(false)}
      type="expense"
      suggestions={folderSuggestions}
      onSave={async (data: Omit<CategoryFolder, 'id' | 'userId'> & { id?: string }) => {
        if (!user) return;
        const { id: _id, ...rest } = data;
        // Reuse an existing folder with the same name instead of creating a duplicate
        const duplicate = folderGroups.find((g) => normalizeNameKey(g.name) === normalizeNameKey(rest.name));
        let folderId: string;
        if (duplicate) {
          folderId = duplicate.id;
        } else {
          const newFolder = await addFolderToDb(user.id, rest);
          dispatch(addFolderAction(newFolder));
          folderId = newFolder.id;
        }
        setNewCategoryFolderId(folderId);
        setActiveFolderId(folderId);
        setSelectedCatId('');
        setShowFolderEditor(false);
        const hasCategories = activeExpCats.some(
          (c) => c.folderId === folderId || c.extraFolderIds?.includes(folderId),
        );
        if (hasCategories) {
          // Existing folder reused — back to the picker scoped to it
          setCategorySheetMode(returnToCategorySheetMode ?? entryMode);
          setReturnToCategorySheetMode(null);
        } else {
          // Fresh empty folder — go straight to category creation inside it
          // (returnToCategorySheetMode stays set for the editor's save/cancel)
          setShowCategoryEditor(true);
        }
      }}
    />

    {/* ── CategoryEditorSheet: create new category from split picker ── */}
    <CategoryEditorSheet
      open={showCategoryEditor}
      onClose={closeCategoryEditor}
      type="expense"
      folderId={newCategoryFolderId ?? undefined}
      initial={{ folderId: newCategoryFolderId ?? undefined }}
      availableFolders={topFolders as unknown as CategoryFolder[]}
      suggestions={categorySuggestions}
      onSave={async (catData) => {
        const name = catData.name?.trim();
        if (!name || !user || inlineCreating) return;
        setInlineCreating(true);
        try {
          const primaryFolderId = catData.folderId ?? newCategoryFolderId ?? undefined;
          const targetFolder = primaryFolderId
            ? topFolders.find((folder) => folder.id === primaryFolderId) ?? null
            : null;
          const color = catData.color ?? targetFolder?.color ?? '#94A3B8';
          const newCat = await addCategoryFirestore(user.id, {
            name,
            icon: catData.icon ?? 'box',
            color,
            folderId: primaryFolderId,
            extraFolderIds: catData.extraFolderIds?.filter((id) => id !== primaryFolderId) ?? [],
            isPrivate: catData.isPrivate ?? false,
            order: 99,
            type: 'expense',
            ...(catData.tags ? { tags: catData.tags } : {}),
          });
          dispatch(addCategoryAction(newCat));
          setActiveFolderId(primaryFolderId ?? null);
          const targetMode = returnToCategorySheetMode ?? entryMode;
          if (targetMode === 'split') {
            const newIdx = splits.length;
            addSplit(newCat, targetFolder ? { id: targetFolder.id, name: targetFolder.name, color: targetFolder.color } : null);
            setAmountEditorTarget(newIdx);
            setEditing(newIdx);
            setCategorySheetMode(null);
          } else {
            changeCategory(newCat, targetFolder ? { id: targetFolder.id, name: targetFolder.name, color: targetFolder.color, icon: targetFolder.icon } : null);
            setCategorySheetMode(null);
          }
          setReturnToCategorySheetMode(null);
        } finally {
          setInlineCreating(false);
          setShowCategoryEditor(false);
          setNewCategoryFolderId(null);
        }
      }}
    />
    </>
  );
}
