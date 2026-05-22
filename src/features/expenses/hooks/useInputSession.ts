'use client';
/**
 * LAYER: input session coordinator hook — INTERNAL.
 *
 * @internal
 * New components should use useExpenseInputFlow instead.
 * This hook is kept for:
 *   1. inferStage and SPLIT_AMOUNT_THRESHOLD exports (consumed by tests + useExpenseInputFlow)
 *   2. Backward compatibility with any existing callers
 *
 * useExpenseInputFlow is the public orchestration API.
 *
 * LAYER: input session coordinator hook.
 *
 * Owns the transition logic between input stages.
 * Coordinates: parsing → suggestion engine → stage inference → Redux session.
 *
 * All stage-transition rules live here — not in components or slices.
 *
 * Stage transition rules:
 *   - No amount detected         → 'parsing'
 *   - Amount + confident winner  → 'confirm'   (topScore ≥ 30)
 *   - Amount + ambiguous signal  → 'clarification'
 *   - Amount + no memory signal  → 'editing'   (user picks manually)
 *   - Large amount (≥ 500) with no confident winner → 'split'
 */

import { useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setSession, advanceStage, clearSession, type InputStage } from '../store/inputSessionSlice';
import { computeSuggestions, hasConfidentSuggestion, isSuggestionAmbiguous, type ScoredSuggestion } from '../engine/suggestionEngine';
import { parseQuickAdd } from '../utils/quickAddParser';
import { useCategoryGroups } from '@/features/categories/hooks/useCategoryGroups';

export const SPLIT_AMOUNT_THRESHOLD = 500;

/**
 * Pure stage inference — exported for tests.
 * All stage-decision logic lives here, nowhere else.
 */
export function inferStage(
  amount: number | undefined,
  suggestions: ScoredSuggestion[],
): InputStage {
  if (!amount || amount <= 0) return 'parsing';

  const topScore = suggestions[0]?.score ?? 0;
  const hasFallbackOnly = topScore === 0;

  if (amount >= SPLIT_AMOUNT_THRESHOLD && !hasConfidentSuggestion(suggestions)) {
    return 'split';
  }
  if (hasConfidentSuggestion(suggestions)) return 'confirm';
  if (isSuggestionAmbiguous(suggestions)) return 'clarification';
  if (hasFallbackOnly) return 'editing';
  return 'clarification';
}

export function useInputSession() {
  const dispatch = useAppDispatch();
  const session = useAppSelector((s) => s.inputSession.session);
  const memory = useAppSelector((s) => s.suggestionMemory);
  const { groups: folders } = useCategoryGroups('expense');

  // Suggestions derived from current session (memoized for stable reference)
  const suggestions = useMemo(
    () => session?.suggestions ?? [],
    [session?.suggestions],
  );

  /**
   * Process a raw text input string.
   * Parses merchant+amount, computes suggestions via engine, infers stage.
   * Dispatches a new session to Redux.
   */
  function processInput(rawInput: string) {
    const parsed = parseQuickAdd(rawInput);
    const scored = computeSuggestions({
      merchant: parsed.merchant ?? (rawInput.trim() || undefined),
      items: folders,
      memory,
    });
    const stage = inferStage(parsed.amount, scored);

    dispatch(setSession({
      rawInput,
      detectedMerchant: parsed.merchant,
      detectedAmount: parsed.amount,
      suggestions: scored,
      stage,
    }));
  }

  /** Explicitly request split mode — called when user taps "Split" button. */
  function requestSplit() {
    dispatch(advanceStage('split'));
  }

  /** Advance to confirm after user selects a category. */
  function confirmCategory() {
    dispatch(advanceStage('confirm'));
  }

  /** Clear the session (call after save or discard). */
  function clear() {
    dispatch(clearSession());
  }

  return {
    session,
    suggestions,
    processInput,
    requestSplit,
    confirmCategory,
    clear,
  };
}
