import type { Currency, Language } from '@/shared/types';
import { toLocalDateKey } from '@/shared/utils/dateKey';
import { missingCategoryMessage } from './categoryClarification';
import {
  buildExpenseParserJsonSchema,
  PARSER_CURRENCIES,
  type ParsedExpenseResult,
  type ParserCurrency,
} from './schema';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-20b';
const GROQ_REQUEST_TIMEOUT_MS = 15_000;

const DEFAULT_CLARIFICATION_FALLBACK: Record<Language, string> = {
  en: "I couldn't make out the amount — could you say it again?",
  ru: 'Не удалось разобрать сумму — повторите, пожалуйста?',
};

const CURRENCY_CLARIFICATION: Record<Language, string> = {
  en: 'Which currency was the expense in? Supported currencies are ILS, USD, CAD and RUB.',
  ru: 'В какой валюте был расход? Поддерживаются ILS, USD, CAD и RUB.',
};

const DATE_CLARIFICATION: Record<Language, string> = {
  en: 'What date was the expense? Please specify the date.',
  ru: 'Когда был расход? Уточните дату, пожалуйста.',
};

/** Server-only — thrown for transport/config failures, never for "the model said something odd" (see sanitize). */
export class ExpenseParserError extends Error {
  readonly status?: number;
  constructor(message: string, options?: ErrorOptions & { status?: number }) {
    super(message, options);
    this.status = options?.status;
  }
}

/** Groq answered 429: callers report capacity to the user, not an outage. */
export class ExpenseParserCapacityError extends ExpenseParserError {
  constructor(readonly retryAfter: number) { super('Groq rate limit reached', { status: 429 }); }
}

/** Seconds or an HTTP date, clamped to 1..3600; anything unreadable means 60. */
export function retryAfterSeconds(header: string | null, now = Date.now()): number {
  const value = header?.trim() ?? '';
  const seconds = /^\d+(\.\d+)?$/.test(value) ? Number(value) : value ? (Date.parse(value) - now) / 1000 : NaN;
  return Number.isFinite(seconds) ? Math.min(3600, Math.max(1, Math.ceil(seconds))) : 60;
}

export interface ParseExpenseCategoryOption {
  id: string;
  /** Display name in the active language — shown to the model, never invented by it. */
  name: string;
}

export interface ParseExpenseTextInput {
  text: string;
  /** Active (non-library) categories only — same contract as the chat clarify flow. */
  categories: ParseExpenseCategoryOption[];
  /** User's own profile currency. Never hardcode 'ILS' here — see schema.ts. */
  defaultCurrency: Currency;
  /** Constrains clarificationQuestion's output language; the model may still READ ru/en/he input. */
  language: Language;
  /** Injection point for deterministic tests; defaults to real today. */
  todayKey?: string;
}

export async function parseExpenseText(input: ParseExpenseTextInput): Promise<ParsedExpenseResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ExpenseParserError('GROQ_API_KEY is not configured');
  }
  if (!input.text || !input.text.trim()) {
    throw new ExpenseParserError('parseExpenseText requires non-empty text');
  }

  const todayKey = input.todayKey ?? toLocalDateKey(new Date());
  const categoryIds = input.categories.map((c) => c.id);
  const jsonSchema = buildExpenseParserJsonSchema(categoryIds);

  const controller = new AbortController();
  // Keep the deadline active through response-body reading, not just headers.
  const timeout = setTimeout(() => controller.abort(), GROQ_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: buildSystemPrompt(input, todayKey) },
          { role: 'user', content: input.text },
        ],
        response_format: { type: 'json_schema', json_schema: jsonSchema },
      }),
    });
    if (response.status === 429) {
      throw new ExpenseParserCapacityError(retryAfterSeconds(response.headers.get('retry-after')));
    }
    if (!response.ok) {
      throw new ExpenseParserError(`Groq request failed: HTTP ${response.status}`, { status: response.status });
    }

    const payload: unknown = await response.json();
    const rawContent = (payload as { choices?: { message?: { content?: unknown } }[] })
      ?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string') {
      throw new ExpenseParserError('Groq response missing message content');
    }

    return sanitizeParsedResult(rawContent, input.defaultCurrency, input.language, categoryIds);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ExpenseParserError('Groq request timed out after 15 seconds', { cause: err });
    }
    if (err instanceof ExpenseParserError) throw err;
    throw new ExpenseParserError('Groq request or response failed', { cause: err });
  } finally {
    clearTimeout(timeout);
  }
}

function buildSystemPrompt(input: ParseExpenseTextInput, todayKey: string): string {
  const categoryLines = input.categories.length > 0
    ? input.categories.map((c) => `- ${c.id}: ${c.name}`).join('\n')
    : '(the user currently has no active categories — categoryId must be null)';

  return [
    'You extract a single expense from a short message written by the owner of a personal/family budget app.',
    `Today's local date is ${todayKey} (YYYY-MM-DD). Resolve relative dates ("yesterday", "вчера") against it.`,
    'The message may be in Russian, English, or Hebrew.',
    '',
    'Rules:',
    '1. Never invent an amount. If none is stated or implied, amount must be null.',
    '2. currency: only set it if the message states or clearly implies one; otherwise null — a default is applied outside this step, not by you.',
    'If an explicitly stated currency is not ILS, USD, CAD or RUB, return currency null and needsClarification true. Never convert or replace it with another currency.',
    '3. merchant: a normalized merchant/company name (e.g. "Шуферсаль" -> "Shufersal"), or null if none is mentioned.',
    '4. categoryId: choose ONLY from the list below by its id, or null if none fits or none are available. Never invent a category id. Never force an unrelated expense into the nearest category just to save it.',
    'If the user explicitly names a category, respect that choice. If it is absent from the active list, do not substitute a different category.',
    `When no active category fits, return categoryId null, needsClarification true and a short suggestedCategoryName in ${input.language === 'ru' ? 'Russian' : 'English'}. This is only a suggestion for the user to add or activate in the app. If a category fits or the category is merely ambiguous, suggestedCategoryName must be null.`,
    '5. date: an explicit or clearly implied YYYY-MM-DD, or null if the message gives no date (the app defaults to today itself).',
    '6. confidence: your own 0–1 confidence that this can be safely recorded as-is.',
    '7. If the amount is missing or the message is too ambiguous to safely create an expense, set needsClarification true.',
    'This endpoint supports one expense only. Income, transfers, refunds and multiple separate expenses must ask for clarification; never turn income into an expense, sum separate purchases or silently drop one of them.',
    `8. clarificationQuestion: a short question in ${input.language === 'ru' ? 'Russian' : 'English'}, only when needsClarification is true, otherwise null.`,
    '',
    'Active categories (id: name):',
    categoryLines,
  ].join('\n');
}

/**
 * Converts the model's raw JSON text into a trustworthy `ParsedExpenseResult`.
 *
 * Groq's `strict: true` schema keeps the shape honest most of the time, but
 * this function treats it as untrusted anyway — a network hiccup, a provider
 * change, or a model that ignores the schema must degrade to "ask the user",
 * never throw an exception into the API route or (worse) fabricate a number.
 * This is also where requirement "never guess the amount" becomes a code
 * guarantee instead of a prompt request: a null amount forces
 * needsClarification true regardless of what the model itself claimed.
 */
function sanitizeParsedResult(
  rawContent: string,
  defaultCurrency: Currency,
  language: Language,
  allowedCategoryIds: readonly string[],
): ParsedExpenseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(rawContent);
  } catch {
    return fallbackClarification(language);
  }
  if (!raw || typeof raw !== 'object') return fallbackClarification(language);
  const r = raw as Record<string, unknown>;

  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount > 0
    ? r.amount
    : null;

  const extractedCurrency = typeof r.currency === 'string'
    && (PARSER_CURRENCIES as readonly string[]).includes(r.currency)
    ? (r.currency as ParserCurrency)
    : null;
  const invalidCurrency = r.currency !== null && extractedCurrency === null;
  // Currency defaulting is deterministic app logic (req. 3), not a model
  // decision — and the default is whatever currency the caller passed in for
  // THIS user, never a hardcoded 'ILS' literal. Only an explicit null permits
  // defaulting; invalid/missing fields and unresolved currencies stay null.
  const currency = amount === null || invalidCurrency
    || (r.currency === null && r.needsClarification === true)
    ? null
    : (extractedCurrency ?? defaultCurrency);

  const merchant = typeof r.merchant === 'string' && r.merchant.trim() ? r.merchant.trim() : null;
  const description = typeof r.description === 'string' && r.description.trim() ? r.description.trim() : null;
  // Re-checked against the SAME list this request was built from, even though
  // the strict JSON schema already constrains it — a provider hiccup or a
  // model ignoring the schema must not slip an invented id through to the
  // API route's own (separately re-fetched) validation.
  const rawCategoryId = typeof r.categoryId === 'string' && r.categoryId.trim() ? r.categoryId : null;
  const suggestedCategoryName = typeof r.suggestedCategoryName === 'string' && r.suggestedCategoryName.trim()
    ? r.suggestedCategoryName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 80) || null
    : null;
  // Conflicting suggestion + ID is a refusal, never permission to silently save.
  const categoryId = !suggestedCategoryName && rawCategoryId && allowedCategoryIds.includes(rawCategoryId) ? rawCategoryId : null;
  const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
  // Only an explicit null means no date was mentioned. Preserve a malformed
  // or missing field as a refusal, so validation cannot default it to today.
  const invalidDate = r.date !== null && date === null;
  const confidence = typeof r.confidence === 'number' && Number.isFinite(r.confidence)
    ? Math.min(1, Math.max(0, r.confidence))
    : 0;

  const needsClarification = amount === null || invalidCurrency || invalidDate || categoryId === null || r.needsClarification === true;
  const invalidFieldQuestion = invalidCurrency
    ? CURRENCY_CLARIFICATION[language]
    : invalidDate ? DATE_CLARIFICATION[language]
      : categoryId === null && (suggestedCategoryName || r.needsClarification !== true)
        ? missingCategoryMessage(language, suggestedCategoryName) : null;
  const clarificationQuestion = needsClarification
    ? (invalidFieldQuestion && amount !== null
      ? invalidFieldQuestion
      : typeof r.clarificationQuestion === 'string' && r.clarificationQuestion.trim()
        ? r.clarificationQuestion.trim()
        : DEFAULT_CLARIFICATION_FALLBACK[language])
    : null;

  return {
    type: 'expense',
    amount, currency, merchant, description, categoryId, suggestedCategoryName, date,
    confidence, needsClarification, clarificationQuestion,
  };
}

function fallbackClarification(language: Language): ParsedExpenseResult {
  return {
    type: 'expense',
    amount: null,
    currency: null,
    merchant: null,
    description: null,
    categoryId: null,
    suggestedCategoryName: null,
    date: null,
    confidence: 0,
    needsClarification: true,
    clarificationQuestion: DEFAULT_CLARIFICATION_FALLBACK[language],
  };
}
