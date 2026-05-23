'use client';
/**
 * LAYER: income quick-confirm — intent-aware income flow for QuickAddBar.
 *
 * Part of the UNIFIED INPUT PLATFORM:
 * When `useExpenseInputFlow` detects an income intent, this hook provides
 * income-specific ranking and save logic using the SAME shared pipeline:
 *   - parseQuickAdd (via session)
 *   - computeSuggestions (income categories)
 *   - suggestionMemory (shared, feeds back into future suggestions)
 *
 * This hook does NOT manage a stage machine — income quick-confirm is simpler:
 *   idle → confirm (when intent detected + amount) → saved (briefly) → idle
 *
 * Architecture invariant:
 *   - This hook is the only place income is saved via QuickAddBar
 *   - Uses the same suggestion engine as expense (shared ranking pipeline)
 *   - Records income categories to shared memory (ranking continuity)
 *   - Components using this hook must NOT import incomeService directly
 */

import { useState, useMemo, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';
import { computeSuggestions, type ScoredSuggestion } from '../engine/suggestionEngine';
import { clearSession } from '../store/inputSessionSlice';
import { recordExpense } from '../store/suggestionMemorySlice';
import { addIncome } from '@/features/income/services/incomeService';
import { prependIncome } from '@/features/income/store/incomeSlice';
import type { ExpenseInputSession } from '../store/inputSessionSlice';

// ── Return type ───────────────────────────────────────────────────────────────

export interface IncomeConfirmFlow {
  /** Ranked income category suggestions. Empty when no income intent or no amount. */
  suggestions: ScoredSuggestion[];
  /** True while save is in-flight. */
  saving: boolean;
  /** True briefly after successful save — for UX feedback. Auto-clears after 1200ms. */
  saved: boolean;
  /**
   * Save income with the given category.
   * Dispatches to Redux + Firestore + shared memory.
   * Clears the expense session after 1200ms.
   */
  saveAsIncome(categoryId: string): Promise<void>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Income quick-confirm flow hook.
 *
 * Takes the current expense input session as the data source — no separate parsing.
 * Activates only when session.detectedIntent.intent === 'income' with a detected amount.
 *
 * @param session - The current expense input session from useExpenseInputFlow.
 */
export function useIncomeConfirm(session: ExpenseInputSession | null): IncomeConfirmFlow {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const currency = useAppSelector((s) => s.ui.currency);
  const memory = useAppSelector((s) => s.suggestionMemory);
  const { groups: incomeItems } = useCategoryGroups('income');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Rank income categories using the shared suggestion engine.
  // Uses the matched keyword (e.g. "salary", "зарплат") as merchant hint for name_match signal.
  const suggestions = useMemo((): ScoredSuggestion[] => {
    if (session?.detectedIntent?.intent !== 'income') return [];
    if (!session.detectedAmount || session.detectedAmount <= 0) return [];
    const hint = session.detectedMerchant ?? session.detectedIntent.matchedKeyword;
    return computeSuggestions({ merchant: hint, items: incomeItems, memory });
  }, [session, incomeItems, memory]);

  const saveAsIncome = useCallback(async (categoryId: string): Promise<void> => {
    if (!user || !session?.detectedAmount || saving) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const inc = await addIncome({
        userId: user.id,
        currency,
        amount: session.detectedAmount,
        categoryId,
        date: new Date(),
        method: 'card',
        privacy: 'regular',
        ...(session.detectedMerchant ? { comment: session.detectedMerchant } : {}),
      });

      // Optimistic Redux update
      dispatch(prependIncome(inc));

      // Record to shared suggestion memory — feeds back into income category ranking.
      // No merchant key for income (income isn't merchant-based).
      dispatch(recordExpense({ categoryId, date: today }));

      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        dispatch(clearSession());
      }, 1200);
    } finally {
      setSaving(false);
    }
  }, [dispatch, user, currency, session, saving]);

  return { suggestions, saving, saved, saveAsIncome };
}
