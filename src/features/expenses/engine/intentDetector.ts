/**
 * LAYER: input intent detector — lightweight deterministic classification.
 *
 * Differentiates input intent BEFORE the expense ranking pipeline runs.
 * Not all quick-add inputs are expenses:
 *   "salary 15000"  → income
 *   "transfer 500"  → transfer
 *   "rent paid"     → recurring/bill
 *
 * Design constraints:
 *   - Purely deterministic: keyword prefix matching, no NLP/AI
 *   - Returns null for expense (the default, most common case)
 *   - Supports both Russian and English keywords
 *   - Confidence: 'certain' (direct noun) vs 'likely' (verb/context hint)
 *
 * Intent detection does NOT affect:
 *   - Expense ranking pipeline
 *   - Category suggestions
 *   - Session stage machine
 * It is purely an advisory signal for the UX layer to offer faster routing.
 */

export type InputIntent = 'income' | 'transfer' | 'recurring';

export interface DetectedIntent {
  intent: InputIntent;
  confidence: 'certain' | 'likely';
  matchedKeyword: string;
}

// ── Keyword tables ────────────────────────────────────────────────────────────
// Each entry is a prefix — matches "зарплата", "зарплате", "зарплату" etc.

const INCOME_CERTAIN = [
  'зарплата', 'зарплат', 'зп', 'salary',
  'аванс', 'получка', 'получк',
  'cashback', 'кэшбэк', 'кешбэк',
  'дивиденд', 'dividend',
  'выплата', 'выплат',
  'стипенд',
];

const INCOME_LIKELY = [
  'доход', 'income',
  'получил', 'получила',
  'пришло', 'пришла', 'пришел',
  'заработал', 'заработала',
  'гонорар',
  'премия', 'прем',
];

const TRANSFER_CERTAIN = [
  'transfer', 'перевод', 'перевел', 'перевела',
  'перекинул', 'перекинула',
  'переслал', 'переслала',
];

const RECURRING_LIKELY = [
  'аренда', 'аренд', 'rent',
  'коммунал', 'жкх',
  'ипотека', 'ипотек', 'mortgage',
  'подписк', 'subscri',
  'абонент',
  'кредит', 'credit',
];

// ── Matching helpers ──────────────────────────────────────────────────────────

function tokenPrefixMatch(tokens: string[], prefixes: string[]): string | null {
  for (const token of tokens) {
    for (const prefix of prefixes) {
      if (token.startsWith(prefix)) return prefix;
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect non-expense input intent from raw quick-add string.
 * Returns null when input is best treated as an expense (the common case).
 *
 * Examples:
 *   "зарплата 15000"  → { intent: 'income', confidence: 'certain', matchedKeyword: 'зарплат' }
 *   "salary 5000"     → { intent: 'income', confidence: 'certain', matchedKeyword: 'salary' }
 *   "получил 3000"    → { intent: 'income', confidence: 'likely',  matchedKeyword: 'получил' }
 *   "перевод 500"     → { intent: 'transfer', confidence: 'certain', matchedKeyword: 'перевод' }
 *   "аренда 12000"    → { intent: 'recurring', confidence: 'likely', matchedKeyword: 'аренд' }
 *   "кофе 50"         → null (expense)
 */
export function detectIntent(rawInput: string): DetectedIntent | null {
  if (!rawInput.trim()) return null;

  const tokens = rawInput.toLowerCase().trim().split(/\s+/);

  // Income — certain (direct noun/noun phrase)
  const incomeCertain = tokenPrefixMatch(tokens, INCOME_CERTAIN);
  if (incomeCertain) {
    return { intent: 'income', confidence: 'certain', matchedKeyword: incomeCertain };
  }

  // Transfer — certain
  const transferCertain = tokenPrefixMatch(tokens, TRANSFER_CERTAIN);
  if (transferCertain) {
    return { intent: 'transfer', confidence: 'certain', matchedKeyword: transferCertain };
  }

  // Recurring/bill — likely
  const recurringLikely = tokenPrefixMatch(tokens, RECURRING_LIKELY);
  if (recurringLikely) {
    return { intent: 'recurring', confidence: 'likely', matchedKeyword: recurringLikely };
  }

  // Income — likely (verb forms, contextual)
  const incomeLikely = tokenPrefixMatch(tokens, INCOME_LIKELY);
  if (incomeLikely) {
    return { intent: 'income', confidence: 'likely', matchedKeyword: incomeLikely };
  }

  return null; // default: treat as expense
}

// ── Display helpers ───────────────────────────────────────────────────────────

export const INTENT_LABELS: Record<InputIntent, string> = {
  income: 'Похоже на доход',
  transfer: 'Похоже на перевод',
  recurring: 'Похоже на платёж/счёт',
};

export const INTENT_ROUTE: Record<InputIntent, string | null> = {
  income: '/income/new',
  transfer: null,    // no dedicated transfer page yet
  recurring: '/recurring',
};
