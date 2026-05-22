'use client';
/**
 * LAYER: expense input flow orchestrator.
 *
 * Single hook that coordinates all concerns of the expense input flow:
 *   parsing → ranking → stage inference → draft → save → memory recording
 *
 * Responsibilities:
 *   - Input text parsing (quickAddParser)
 *   - Suggestion computation (suggestionEngine)
 *   - Stage inference and transitions (inputSessionSlice)
 *   - Draft preparation (draftSlice)
 *   - Expense persistence + Redux update (expensesService + expensesSlice)
 *   - Memory recording after save (suggestionMemorySlice)
 *   - Recent context queries (recentContextEngine)
 *
 * Components that use this hook should:
 *   - Render based on { session, suggestions, stage, saving, recentMerchants }
 *   - Call { processInput, saveWithCategory, openSplitEditor, requestSplit, clear }
 *   - NOT import slices, engines, or parsers directly
 *
 * Architecture invariant: orchestration logic lives HERE, not in components.
 *
 * Internal layer (useInputSession) is NOT exported from this file.
 * New components should import useExpenseInputFlow, not useInputSession.
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setSession, advanceStage, markSaved, clearSession } from '../store/inputSessionSlice';
import type { InputStage, ExpenseInputSession } from '../store/inputSessionSlice';
import { computeSuggestions, type ScoredSuggestion } from '../engine/suggestionEngine';
import { parseQuickAdd } from '../utils/quickAddParser';
import { inferStage } from './useInputSession';
import { recordExpense } from '../store/suggestionMemorySlice';
import type { SplitComboEntry } from '../store/suggestionMemorySlice';
import { setDraft, clearDraft } from '../store/draftSlice';
import { addExpense } from '../services/expensesService';
import { prependExpense } from '../store/expensesSlice';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import {
  getRecentMerchants,
  getRecentCategories,
  getRecentSplitCombos,
  hasUsageContext,
  type RecentMerchant,
  type RecentCategoryEntry,
} from '../engine/recentContextEngine';

// ── Return type ───────────────────────────────────────────────────────────────

export interface ExpenseInputFlow {
  /** Current session — null when idle. */
  session: ExpenseInputSession | null;
  /** Ranked suggestions from the engine (empty array when idle). */
  suggestions: ScoredSuggestion[];
  /** Current UX stage. */
  stage: InputStage;
  /** True while a save is in flight — disables save buttons. */
  saving: boolean;

  /** Recent merchants for context hints. */
  recentMerchants: RecentMerchant[];
  /** Recent categories for cold-start defaults. */
  recentCategories: RecentCategoryEntry[];
  /** Recent split combos for current merchant — for one-tap split reuse. */
  recentSplitCombos: SplitComboEntry[];
  /** False on first use — can be used to show onboarding hints. */
  hasContext: boolean;

  /**
   * Process a free-text input string.
   * Parses merchant + amount, computes suggestions, infers stage.
   * Clears session when input is empty.
   */
  processInput(rawInput: string): void;

  /**
   * Save an expense with the given category, using the current session's
   * amount and merchant.
   * Transitions to 'saved' stage for UX feedback, then auto-clears session.
   */
  saveWithCategory(categoryId: string): Promise<void>;

  /**
   * Writes draft to Redux and navigates to the full expense editor (FastExpenseEntry).
   * Used when the user needs split editing or more detail.
   * Optionally pre-selects a category.
   */
  openSplitEditor(categoryId?: string): void;

  /**
   * Writes a split combo preset to the draft and opens the split editor.
   * Distributes amount evenly across combo categories as starting point.
   */
  openSplitEditorWithCombo(combo: SplitComboEntry): void;

  /** Explicitly transition to split stage. */
  requestSplit(): void;

  /** Clear the session and draft (discard without saving). */
  clear(): void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExpenseInputFlow(): ExpenseInputFlow {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const session = useAppSelector((s) => s.inputSession.session);
  const memory = useAppSelector((s) => s.suggestionMemory);
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const { groups: folders } = useCategoryGroups('expense');

  const [saving, setSaving] = useState(false);

  const suggestions = useMemo(
    () => session?.suggestions ?? [],
    [session],
  );

  const stage: InputStage = session?.stage ?? 'idle';

  const recentMerchants = useMemo(() => getRecentMerchants(memory, 5), [memory]);
  const recentCategories = useMemo(() => getRecentCategories(memory, 5), [memory]);
  const recentSplitCombos = useMemo(
    () => getRecentSplitCombos(session?.detectedMerchant, memory, 3),
    [session?.detectedMerchant, memory],
  );
  const hasContext = useMemo(() => hasUsageContext(memory), [memory]);

  const processInput = useCallback(
    (rawInput: string) => {
      if (!rawInput.trim()) {
        dispatch(clearSession());
        return;
      }
      const parsed = parseQuickAdd(rawInput);
      const scored = computeSuggestions({
        merchant: parsed.merchant ?? rawInput.trim(),
        items: folders,
        memory,
      });
      const nextStage = inferStage(parsed.amount, scored);
      dispatch(setSession({
        rawInput,
        detectedMerchant: parsed.merchant,
        detectedAmount: parsed.amount,
        suggestions: scored,
        stage: nextStage,
      }));
    },
    [dispatch, folders, memory],
  );

  const saveWithCategory = useCallback(
    async (categoryId: string) => {
      if (!user || !session?.detectedAmount || saving) return;
      setSaving(true);
      const today = new Date().toISOString().slice(0, 10);
      try {
        const exp = await addExpense({
          userId: user.id,
          currency,
          amount: session.detectedAmount,
          categoryId,
          date: new Date(),
          paymentMethod: 'card',
          tags: [],
          privacy: 'regular',
          splits: [],
          ...(session.detectedMerchant ? { store: session.detectedMerchant } : {}),
        });
        dispatch(prependExpense(exp));
        dispatch(recordExpense({
          merchant: session.detectedMerchant,
          categoryId,
          date: today,
        }));
        dispatch(markSaved());
        setTimeout(() => dispatch(clearSession()), 1200);
      } finally {
        setSaving(false);
      }
    },
    [dispatch, user, currency, session, saving],
  );

  const openSplitEditor = useCallback(
    (categoryId?: string) => {
      const today = new Date().toISOString().slice(0, 10);
      dispatch(setDraft({
        amount: session?.detectedAmount,
        merchant: session?.detectedMerchant,
        categoryId,
        categorySuggestions: suggestions.map((s) => s.categoryId),
        splits: [],
        date: today,
        paymentMethod: 'card',
      }));
      const params = new URLSearchParams();
      if (session?.detectedAmount) params.set('amount', String(session.detectedAmount));
      if (session?.detectedMerchant) params.set('storeName', session.detectedMerchant);
      router.push(`/expenses/new?${params.toString()}`);
      dispatch(clearSession());
    },
    [dispatch, router, session, suggestions],
  );

  const openSplitEditorWithCombo = useCallback(
    (combo: SplitComboEntry) => {
      const amount = session?.detectedAmount ?? 0;
      const share = amount > 0 ? Math.round((amount / combo.categoryIds.length) * 100) / 100 : 0;
      const today = new Date().toISOString().slice(0, 10);
      dispatch(setDraft({
        amount,
        merchant: session?.detectedMerchant,
        categoryId: combo.categoryIds[0],
        categorySuggestions: combo.categoryIds,
        splits: combo.categoryIds.map((id) => ({ categoryId: id, amount: share })),
        date: today,
        paymentMethod: 'card',
      }));
      const params = new URLSearchParams();
      if (amount) params.set('amount', String(amount));
      if (session?.detectedMerchant) params.set('storeName', session.detectedMerchant);
      router.push(`/expenses/new?${params.toString()}`);
      dispatch(clearSession());
    },
    [dispatch, router, session],
  );

  const requestSplit = useCallback(() => {
    dispatch(advanceStage('split'));
  }, [dispatch]);

  const clear = useCallback(() => {
    dispatch(clearSession());
    dispatch(clearDraft());
  }, [dispatch]);

  return {
    session,
    suggestions,
    stage,
    saving,
    recentMerchants,
    recentCategories,
    hasContext,
    processInput,
    saveWithCategory,
    openSplitEditor,
    requestSplit,
    clear,
  };
}
