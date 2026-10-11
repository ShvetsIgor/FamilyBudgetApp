import { resolveChatAuthorization } from '@/features/ai/chatAuth';
import { ExpenseParserCapacityError } from '@/features/ai/expenseParser/parseExpenseText';
import { missingCategoryMessage } from '@/features/ai/expenseParser/categoryClarification';
import { readLimitedJson, SiriRequestError, todayKeyFor } from '@/features/ai/siriRequest';
import { consumeAiQuota, consumeChatRequestQuota, recordAiCooldown } from '@/features/ai/siriRateLimit';
import { loadSiriContext, SiriProfileError } from '@/features/ai/siriContext';
import { isAppManagedSavingsCategory } from '@/features/categories/policy/categoryPolicy';
import { parseReceiptImage } from '@/features/ai/receiptParser/parseReceiptImage';
import { sanitizeReceipt, type ReceiptRejection } from '@/features/ai/receiptParser/receipt';
import { reportProviderCapacity, reportServerFailure } from '@/shared/lib/serverMonitoring';

export const runtime = 'nodejs';
const ROUTE = 'receipt_parse';

/** The client compresses to ~0.5 MB; this leaves room, and stops anything abusive. */
const MAX_IMAGE_BYTES = 1_500_000;
const MAX_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4096;
const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
const limited = (error: 'request_rate_limited' | 'rate_limited' | 'ai_capacity', retryAfter: number) =>
  json({ ok: false, error, retryAfter }, 429, { 'Retry-After': String(retryAfter) });

const REJECTION_TEXT: Record<'ru' | 'en', Record<ReceiptRejection, string>> = {
  ru: {
    unreadable: 'Не получилось прочитать чек. Сфотографируй его ровно и при хорошем свете или введи сумму текстом.',
    no_total: 'Не нашёл на чеке итоговую сумму. Сфотографируй низ чека целиком или введи сумму текстом.',
    currency: 'Чек в валюте, которую приложение пока не поддерживает. Введи расход текстом в ₪, $, CA$ или ₽.',
  },
  en: {
    unreadable: 'Couldn’t read the receipt. Take a straight, well-lit photo or type the amount instead.',
    no_total: 'Couldn’t find the total on the receipt. Photograph the whole bottom of it or type the amount.',
    currency: 'The receipt is in a currency the app doesn’t support yet. Type the expense in ₪, $, CA$ or ₽.',
  },
};

/**
 * Reads a receipt photo into a draft for the chat's receipt card. Like the
 * text route it only parses: nothing is saved until the user assigns every
 * amount a category and taps Save. The photo itself is never stored.
 */
export async function POST(request: Request): Promise<Response> {
  let uid;
  try { uid = await resolveChatAuthorization(request.headers.get('authorization')); }
  catch (error) {
    reportServerFailure({ route: ROUTE, stage: 'auth', error });
    return json({ ok: false, error: 'auth_unavailable' }, 503);
  }
  if (!uid) return json({ ok: false, error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });

  let image: string;
  let todayKey: string;
  try {
    const body = await readLimitedJson(request, MAX_BODY_BYTES) as Record<string, unknown> | null;
    const match = typeof body?.image === 'string' ? DATA_URL.exec(body.image) : null;
    if (!match || match[2].length * 3 / 4 > MAX_IMAGE_BYTES) throw new SiriRequestError(400, 'A JPEG, PNG or WebP image is required.');
    image = body!.image as string;
    todayKey = todayKeyFor(body!.timeZone);
  } catch (error) {
    return json({ ok: false, error: 'invalid_request' }, error instanceof SiriRequestError ? error.status : 400);
  }

  // Metered before any account read, as in the text route; one photo is one AI call
  try {
    const requests = await consumeChatRequestQuota(uid);
    if (!requests.allowed) return limited('request_rate_limited', requests.retryAfter);
    const quota = await consumeAiQuota(uid);
    if (!quota.allowed) return limited(quota.reason === 'global' ? 'ai_capacity' : 'rate_limited', quota.retryAfter);
  } catch (error) {
    reportServerFailure({ route: ROUTE, stage: 'rate_limit', error });
    return json({ ok: false, error: 'rate_limit_unavailable' }, 503);
  }

  let context;
  try { context = await loadSiriContext(uid); }
  catch (error) {
    if (error instanceof SiriProfileError) return json({ ok: false, error: 'profile_required' }, 409);
    reportServerFailure({ route: ROUTE, stage: 'context', error });
    return json({ ok: false, error: 'context_unavailable' }, 503);
  }
  if (!context.categories.some((category) => !isAppManagedSavingsCategory(category))) {
    return json({ ok: false, error: 'category_required', reason: 'no_categories',
      message: missingCategoryMessage(context.language, null, 'chat') }, 422);
  }

  const categories = context.categories.filter((category) => !isAppManagedSavingsCategory(category));
  let raw;
  try {
    raw = await parseReceiptImage({ imageDataUrl: image, todayKey, language: context.language,
      categories: categories.map(({ id, name }) => ({ id, name })) });
  } catch (error) {
    if (error instanceof ExpenseParserCapacityError) {
      reportProviderCapacity(ROUTE);
      await recordAiCooldown(error.retryAfter);
      return limited('ai_capacity', error.retryAfter);
    }
    reportServerFailure({ route: ROUTE, stage: 'parser', error });
    return json({ ok: false, error: 'parser_unavailable' }, 503);
  }

  const result = sanitizeReceipt(raw, { categoryIds: categories.map((c) => c.id), defaultCurrency: context.currency, todayKey });
  if (!result.ok) {
    return json({ ok: false, error: 'receipt_unreadable', reason: result.reason,
      message: REJECTION_TEXT[context.language][result.reason] }, 422);
  }
  return json({ ok: true, receipt: result.receipt });
}
