'use client';
/**
 * LAYER: expense input flow orchestrator.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  ORCHESTRATION BOUNDARY                                             │
 * │                                                                     │
 * │  This hook is the single coordination point for all input flow      │
 * │  concerns. Logic that crosses more than one sub-system lives here.  │
 * │                                                                     │
 * │  Sub-systems it coordinates:                                        │
 * │    quickAddParser     — text → amount/merchant                      │
 * │    suggestionEngine   — ranking pipeline (deterministic)            │
 * │    inputSessionSlice  — stage machine + session state               │
 * │    draftSlice         — transient draft for split editor            │
 * │    expensesService    — Firestore persistence                       │
 * │    expensesSlice      — optimistic Redux update                     │
 * │    suggestionMemory   — post-save memory recording                  │
 * │    recentContextEngine — context queries (pure read)                │
 * │                                                                     │
 * │  Components that use this hook MUST:                                │
 * │    - Render based on { session, suggestions, stage, saving }        │
 * │    - Call { processInput, saveWithCategory, openSplitEditor, clear }│
 * │    - NOT import slices, engines, or parsers directly                │
 * └─────────────────────────────────────────────────────────────────────┘
 */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setSession, advanceStage, markSaved, clearSession } from '../store/inputSessionSlice';
import type { InputStage, ExpenseInputSession } from '../store/inputSessionSlice';
import {
  computeSuggestions,
  isHabitSuggestion,
  getConfidenceLevel,
  type ScoredSuggestion,
  type ConfidenceLevel,
} from '../engine/suggestionEngine';
import { parseQuickAdd } from '../utils/quickAddParser';
import { detectIntent, INTENT_ROUTE, type DetectedIntent } from '../engine/intentDetector';
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
  /** Stage that preceded the most recent branch transition (split/confirm from clarification). */
  previousStage: InputStage | undefined;
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
   * Top suggestion that fired the habit signal — null if no habit pattern detected.
   * Used for proactive "как обычно" UX in confirm/clarification stages.
   */
  habitSuggestion: ScoredSuggestion | null;

  /**
   * UX confidence level for the confirm stage.
   * 'high'   → fast-path single button (habit or dominant winner)
   * 'medium' → two-chip choice UI
   * 'low'    → full clarification panel
   * Always 'low' for non-confirm stages.
   */
  confidenceLevel: ConfidenceLevel;

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

  /**
   * Navigate to the appropriate entry page for the detected non-expense intent.
   * No-op when detectedIntent is null or has no route (transfer).
   * Clears the session after routing.
   */
  redirectToIntent(): void;
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
  const previousStage: InputStage | undefined = session?.previousStage;

  const recentMerchants = useMemo(() => getRecentMerchants(memory, 5), [memory]);
  const recentCategories = useMemo(() => getRecentCategories(memory, 5), [memory]);
  const recentSplitCombos = useMemo(
    () => getRecentSplitCombos(session?.detectedMerchant, memory, 3),
    [session?.detectedMerchant, memory],
  );
  const hasContext = useMemo(() => hasUsageContext(memory), [memory]);

  const habitSuggestion = useMemo(
    () => suggestions.find(isHabitSuggestion) ?? null,
    [suggestions],
  );

  const confidenceLevel: ConfidenceLevel = useMemo(
    () => (stage === 'confirm' ? getConfidenceLevel(suggestions) : 'low'),
    [stage, suggestions],
  );

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
      const intent = detectIntent(rawInput);
      dispatch(setSession({
        rawInput,
        detectedMerchant: parsed.merchant,
        detectedAmount: parsed.amount,
        suggestions: scored,
        stage: nextStage,
        detectedIntent: intent,
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

  const redirectToIntent = useCallback(() => {
    const intent = session?.detectedIntent;
    if (!intent) return;
    const route = INTENT_ROUTE[intent.intent];
    if (!route) return;
    const params = new URLSearchParams();
    if (session?.detectedAmount) params.set('amount', String(session.detectedAmount));
    if (session?.detectedMerchant) params.set('description', session.detectedMerchant);
    const qs = params.toString();
    router.push(qs ? `${route}?${qs}` : route);
    dispatch(clearSession());
  }, [dispatch, router, session]);

  const clear = useCallback(() => {
    dispatch(clearSession());
    dispatch(clearDraft());
  }, [dispatch]);

  return {
    session,
    suggestions,
    stage,
    previousStage,
    saving,
    recentMerchants,
    recentCategories,
    recentSplitCombos,
    hasContext,
    habitSuggestion,
    confidenceLevel,
    processInput,
    saveWithCategory,
    openSplitEditor,
    openSplitEditorWithCombo,
    requestSplit,
    clear,
  };
}
