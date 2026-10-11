import 'server-only';
import type { Language } from '@/shared/types';
import {
  ExpenseParserCapacityError,
  ExpenseParserError,
  retryAfterSeconds,
  type ParseExpenseCategoryOption,
} from '../expenseParser/parseExpenseText';
import { PARSER_CURRENCIES } from '../expenseParser/schema';

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** The vision-capable model on this account's Groq plan; override when Groq rotates models. */
const DEFAULT_VISION_MODEL = 'qwen/qwen3.8-27b';
/** Images take longer than text; still well inside the client's own deadline. */
const RECEIPT_TIMEOUT_MS = 30_000;

export interface ParseReceiptInput {
  /** `data:image/jpeg;base64,…` — already size- and type-checked by the route */
  imageDataUrl: string;
  categories: ParseExpenseCategoryOption[];
  language: Language;
  todayKey: string;
}

function systemPrompt({ categories, language, todayKey }: ParseReceiptInput): string {
  return [
    'You read a photo of a shop receipt for a personal budget app and answer with ONE JSON object, nothing else:',
    '{"merchant": string|null, "date": "YYYY-MM-DD"|null, "currency": string|null, "total": number|null,',
    ' "items": [{"name": string, "amount": number, "categoryId": string|null}]}',
    '',
    'Rules:',
    '1. total: the final amount actually paid (after discounts), as printed. Never compute or guess it; null if unreadable.',
    `2. currency: one of ${PARSER_CURRENCIES.join(', ')} when the receipt shows it (₪/NIS/ש"ח → ILS, $ → USD unless clearly Canadian → CAD, ₽ → RUB); the printed code if it is another currency; null if not shown.`,
    `3. date: the purchase date as YYYY-MM-DD, or null. Today is ${todayKey}; a receipt is never from the future.`,
    '4. merchant: the shop name as printed, or null.',
    '5. items: each purchased line with its final line amount (quantity × price, after line discounts). Skip totals, subtotals, VAT/tax lines, payment and change lines. If lines are unreadable, return an empty list — never invent lines.',
    '6. categoryId: ONLY an id from the list below when the line clearly belongs to it, otherwise null. Never invent ids.',
    `7. Line names stay in the receipt's language, shortened to a few words. The user reads ${language === 'ru' ? 'Russian' : 'English'}.`,
    '',
    'Categories (id: name):',
    categories.length > 0 ? categories.map((c) => `- ${c.id}: ${c.name}`).join('\n') : '(none — categoryId must be null)',
  ].join('\n');
}

/** The model's raw JSON object; `sanitizeReceipt` decides what of it is usable. */
export async function parseReceiptImage(input: ParseReceiptInput): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new ExpenseParserError('GROQ_API_KEY is not configured');
  const model = process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_VISION_MODEL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RECEIPT_TIMEOUT_MS);
  try {
    const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(input) },
          { role: 'user', content: [
            { type: 'text', text: 'Read this receipt.' },
            { type: 'image_url', image_url: { url: input.imageDataUrl } },
          ] },
        ],
      }),
    });
    if (response.status === 429) throw new ExpenseParserCapacityError(retryAfterSeconds(response.headers.get('retry-after')));
    if (!response.ok) throw new ExpenseParserError(`Groq vision request failed: HTTP ${response.status}`, { status: response.status });
    const payload = await response.json() as { choices?: { message?: { content?: unknown } }[] };
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new ExpenseParserError('Groq vision response missing message content');
    // Some models wrap JSON in a code fence despite json_object
    const json = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { return JSON.parse(json); } catch { return null; }
  } catch (err) {
    if (controller.signal.aborted) throw new ExpenseParserError('Groq vision request timed out', { cause: err });
    if (err instanceof ExpenseParserError) throw err;
    throw new ExpenseParserError('Groq vision request or response failed', { cause: err });
  } finally {
    clearTimeout(timeout);
  }
}
