/**
 * LAYER: intent classifier — deterministic rule-based intent recognition.
 *
 * Classifies user input within a conversation session context.
 * No NLP. No embeddings. No ML. Explicit keyword rules only.
 *
 * Intent priority (first match wins):
 *   1. CANCEL          — explicit cancel keywords
 *   2. CONFIRM         — confirm keywords when session is in 'confirming' state
 *   3. UNDO            — explicit undo keywords when session has history
 *   4. CHANGE_AMOUNT   — amount keyword + numeric value, non-idle session
 *   5. CHANGE_CATEGORY — category correction keyword, non-idle session
 *   6. MODIFY_SPLIT    — split keywords when split draft is active
 *   7. ADD_EXPENSE     — default: input contains a number (amount)
 *
 * Architecture invariants:
 *   - Pure functions. No mutations. No Redux.
 *   - Deterministic: same input + same session → same intent always.
 *   - All keyword sets are explicit — no partial matching except where noted.
 *   - classifyIntent() never throws — always returns a result.
 *   - Keyword sets are closed: add new variants here explicitly.
 */

import type { ConversationSession } from '../types/conversationSession';

// ── Intent types ──────────────────────────────────────────────────────────────

export type ConversationIntent =
  | 'ADD_EXPENSE'
  | 'MODIFY_SPLIT'
  | 'CONFIRM'
  | 'CANCEL'
  | 'UNDO'
  | 'CHANGE_CATEGORY'
  | 'CHANGE_AMOUNT';

export interface IntentResult {
  intent: ConversationIntent;
  confidence: number;
  matchedKeywords: string[];
  isAmbiguous: boolean;
}

// ── Keyword sets ──────────────────────────────────────────────────────────────

const CANCEL_KW = new Set([
  'отмена', 'отменить', 'отмени', 'cancel', 'стоп', 'stop', 'нет', 'no',
]);

const CONFIRM_KW = new Set([
  'да', 'yes', 'ок', 'ok', 'ладно', 'подтвердить', 'подтверждаю', 'подтверди',
  'сохранить', 'confirm', 'сохрани', 'верно', 'правильно', 'точно',
]);

const UNDO_KW = new Set([
  'назад', 'undo', 'back', 'вернуть', 'верни', 'исправить', 'исправь',
]);

const CHANGE_AMOUNT_KW = new Set([
  'сумма', 'amount', 'цена', 'стоимость', 'стоит',
]);

const CHANGE_CATEGORY_KW = new Set([
  'категория', 'category', 'другая', 'другую', 'изменить', 'поменяй',
  'неверно', 'неправильно', 'не та', 'не ту',
]);

const SPLIT_KW = new Set([
  'сплит', 'split', 'разделить', 'раздели', 'еще', 'ещё',
  'добавить', 'плюс', 'also', 'и еще', 'и ещё', 'тоже',
]);

const AMOUNT_PATTERN = /\b\d+(?:[.,]\d{1,2})?\b/;

// ── Public API ────────────────────────────────────────────────────────────────

export function classifyIntent(
  input: string,
  session: ConversationSession,
): IntentResult {
  const normalized = input.toLowerCase().trim();
  const tokens = normalized.split(/\s+/);

  // 1. CANCEL — valid in any non-idle state
  const cancelMatch = tokens.filter((t) => CANCEL_KW.has(t));
  if (cancelMatch.length > 0 && session.status !== 'idle') {
    return { intent: 'CANCEL', confidence: 0.95, matchedKeywords: cancelMatch, isAmbiguous: false };
  }

  // 2. CONFIRM — valid only in 'confirming' state
  const confirmMatch = tokens.filter((t) => CONFIRM_KW.has(t));
  if (confirmMatch.length > 0 && session.status === 'confirming') {
    return { intent: 'CONFIRM', confidence: 0.95, matchedKeywords: confirmMatch, isAmbiguous: false };
  }

  // 3. UNDO — valid when session has history and is open
  const undoMatch = tokens.filter((t) => UNDO_KW.has(t));
  if (undoMatch.length > 0 && session.history.length > 0 && session.status !== 'idle') {
    return { intent: 'UNDO', confidence: 0.85, matchedKeywords: undoMatch, isAmbiguous: false };
  }

  // 4. CHANGE_AMOUNT — correction keyword + number present, non-idle
  const amountKwMatch = tokens.filter((t) => CHANGE_AMOUNT_KW.has(t));
  const hasNumber = AMOUNT_PATTERN.test(normalized);
  if (amountKwMatch.length > 0 && hasNumber && session.status !== 'idle') {
    return {
      intent: 'CHANGE_AMOUNT',
      confidence: 0.80,
      matchedKeywords: amountKwMatch,
      isAmbiguous: false,
    };
  }

  // 5. CHANGE_CATEGORY — correction keyword, non-idle
  const catKwMatch = tokens.filter((t) => CHANGE_CATEGORY_KW.has(t));
  if (catKwMatch.length > 0 && session.status !== 'idle') {
    return {
      intent: 'CHANGE_CATEGORY',
      confidence: 0.75,
      matchedKeywords: catKwMatch,
      isAmbiguous: false,
    };
  }

  // 6. MODIFY_SPLIT — split keywords AND split draft is active
  const splitKwMatch = tokens.filter((t) => SPLIT_KW.has(t));
  if (splitKwMatch.length > 0 && session.splitDraft) {
    return {
      intent: 'MODIFY_SPLIT',
      confidence: 0.80,
      matchedKeywords: splitKwMatch,
      isAmbiguous: false,
    };
  }

  // 7. ADD_EXPENSE — default when input has a number
  if (hasNumber) {
    return { intent: 'ADD_EXPENSE', confidence: 0.70, matchedKeywords: [], isAmbiguous: false };
  }

  // Ambiguous — no strong signals
  return {
    intent: 'ADD_EXPENSE',
    confidence: 0.30,
    matchedKeywords: [],
    isAmbiguous: true,
  };
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function intentIs(result: IntentResult, ...kinds: ConversationIntent[]): boolean {
  return kinds.includes(result.intent);
}

export function isModificationIntent(result: IntentResult): boolean {
  return intentIs(result, 'MODIFY_SPLIT', 'CHANGE_CATEGORY', 'CHANGE_AMOUNT', 'UNDO');
}

export function isDestructiveIntent(result: IntentResult): boolean {
  return intentIs(result, 'CANCEL');
}

export function isTerminalIntent(result: IntentResult): boolean {
  return intentIs(result, 'CONFIRM', 'CANCEL');
}
